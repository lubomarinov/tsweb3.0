import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  api,
  type ApiAccount,
  type ApiQuote,
  type ApiTransaction,
} from '../core/api';
import type { Cents, Micrograms } from '../core/money';

/**
 * Състояние на демото, когато то работи срещу бекенда.
 *
 * Тук няма нито една сметка — всички числа идват от сървъра. Клиентската
 * книга (`core/ledger`) остава само за самостоятелния режим и за да покаже
 * какво ще стане преди потвърждение.
 */

const TOKEN_STORAGE_KEY = 'fexogold.token';

/** Колко често се опреснява котировката. */
const PRICE_POLL_MS = 4000;

export type BackendStatus = 'checking' | 'online' | 'offline';

export interface BackendState {
  readonly status: BackendStatus;
  readonly token: string | null;
  readonly account: ApiAccount | null;
  readonly transactions: readonly ApiTransaction[];
  readonly history: readonly ApiQuote[];
  readonly quote: ApiQuote | null;
  readonly error: ApiError | null;
  readonly busy: boolean;
  readonly register: (
    email: string,
    fullName: string,
    password: string,
  ) => Promise<boolean>;
  readonly login: (email: string, password: string) => Promise<boolean>;
  readonly logout: () => void;
  readonly topUp: (amount: Cents) => Promise<boolean>;
  readonly pay: (amount: Cents, merchant: string) => Promise<boolean>;
  readonly sell: (gold: Micrograms) => Promise<boolean>;
  readonly clearError: () => void;
}

/** Токенът се пази в localStorage, за да преживее презареждане на страницата. */
const readStoredToken = (): string | null => {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    // Забранени бисквитки/хранилище — работим без запомняне.
    return null;
  }
};

const storeToken = (token: string | null): void => {
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Без запомняне — не е причина сесията да пропадне.
  }
};

export function useBackend(): BackendState {
  const [status, setStatus] = useState<BackendStatus>('checking');
  const [token, setToken] = useState<string | null>(readStoredToken);
  const [account, setAccount] = useState<ApiAccount | null>(null);
  const [transactions, setTransactions] = useState<readonly ApiTransaction[]>([]);
  const [history, setHistory] = useState<readonly ApiQuote[]>([]);
  const [quote, setQuote] = useState<ApiQuote | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  // Пази последния валиден токен достъпен в обработчиците, без те да се
  // пресъздават при всяка негова промяна. Синхронизира се в ефект, защото
  // писането в ref по време на рендер чупи бъдещия конкурентен рендер.
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // Проверка дали бекендът изобщо е вдигнат.
  useEffect(() => {
    const controller = new AbortController();

    api
      .health(controller.signal)
      .then(() => setStatus('online'))
      .catch(() => {
        if (!controller.signal.aborted) setStatus('offline');
      });

    return () => controller.abort();
  }, []);

  // Историята на цената се тегли веднъж — тя е за графиката.
  useEffect(() => {
    if (status !== 'online') return;
    const controller = new AbortController();

    api
      .priceHistory(90, controller.signal)
      .then((response) => setHistory(response.quotes))
      .catch(() => undefined);

    return () => controller.abort();
  }, [status]);

  // Котировката се опреснява периодично; новата точка се долепя към графиката.
  useEffect(() => {
    if (status !== 'online') return;

    let cancelled = false;
    const controller = new AbortController();

    const poll = () => {
      api
        .price(controller.signal)
        .then((next) => {
          if (cancelled) return;
          setQuote(next);
          setHistory((previous) => {
            const last = previous[previous.length - 1];
            if (last && last.at === next.at) return previous;
            // Отрязваме отпред, за да не расте серията без край.
            return [...previous, next].slice(-180);
          });
        })
        .catch(() => undefined);
    };

    poll();
    const timer = setInterval(poll, PRICE_POLL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [status]);

  /** Презарежда сметката и историята — след вход и след всяка сделка. */
  const refresh = useCallback(async (activeToken: string) => {
    try {
      const [nextAccount, nextTransactions] = await Promise.all([
        api.account(activeToken),
        api.transactions(activeToken),
      ]);
      setAccount(nextAccount);
      setTransactions(nextTransactions);
      setQuote(nextAccount.quote);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        // Изтекъл или отхвърлен токен — връщаме се към екрана за вход.
        storeToken(null);
        setToken(null);
        setAccount(null);
        setTransactions([]);
        return;
      }
      setError(cause as ApiError);
    }
  }, []);

  useEffect(() => {
    if (status !== 'online' || !token) return;
    // `refresh` пише в състоянието едва след като заявките се върнат, не
    // синхронно — това е точно случаят, за който ефектът съществува.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh(token);
  }, [status, token, refresh]);

  /** Обвивка около заявките: пази `busy` и грешката на едно място. */
  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | null> => {
      setBusy(true);
      setError(null);
      try {
        return await action();
      } catch (cause) {
        setError(
          cause instanceof ApiError
            ? cause
            : new ApiError('unknown', 'Неочаквана грешка.', 0),
        );
        return null;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const adoptToken = useCallback(
    (accessToken: string) => {
      storeToken(accessToken);
      setToken(accessToken);
      void refresh(accessToken);
    },
    [refresh],
  );

  const register = useCallback(
    async (email: string, fullName: string, password: string) => {
      const result = await run(() => api.register(email, fullName, password));
      if (result) adoptToken(result.access_token);
      return result !== null;
    },
    [run, adoptToken],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await run(() => api.login(email, password));
      if (result) adoptToken(result.access_token);
      return result !== null;
    },
    [run, adoptToken],
  );

  const logout = useCallback(() => {
    storeToken(null);
    setToken(null);
    setAccount(null);
    setTransactions([]);
    setError(null);
  }, []);

  /** Прилага резултата от сделка, без да пита сървъра втори път. */
  const applyMovement = useCallback(
    async (action: (activeToken: string) => Promise<{ account: ApiAccount }>) => {
      const activeToken = tokenRef.current;
      if (!activeToken) return false;

      const result = await run(() => action(activeToken));
      if (!result) return false;

      setAccount(result.account);
      setQuote(result.account.quote);
      // Историята се тегли наново: сървърът е авторитетът за подредбата.
      void api
        .transactions(activeToken)
        .then(setTransactions)
        .catch(() => undefined);
      return true;
    },
    [run],
  );

  const topUp = useCallback(
    (amount: Cents) => applyMovement((t) => api.topUp(t, amount)),
    [applyMovement],
  );

  const pay = useCallback(
    (amount: Cents, merchant: string) =>
      applyMovement((t) => api.cardPayment(t, amount, merchant)),
    [applyMovement],
  );

  const sell = useCallback(
    (gold: Micrograms) => applyMovement((t) => api.sell(t, gold)),
    [applyMovement],
  );

  const clearError = useCallback(() => setError(null), []);

  return useMemo(
    () => ({
      status,
      token,
      account,
      transactions,
      history,
      quote,
      error,
      busy,
      register,
      login,
      logout,
      topUp,
      pay,
      sell,
      clearError,
    }),
    [
      status,
      token,
      account,
      transactions,
      history,
      quote,
      error,
      busy,
      register,
      login,
      logout,
      topUp,
      pay,
      sell,
      clearError,
    ],
  );
}
