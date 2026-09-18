import { useCallback, useState } from 'react';
import {
  EMPTY_ACCOUNT,
  cardPayment,
  sellGold,
  topUp,
  type Account,
  type LedgerError,
} from '../core/ledger';
import type { GoldQuote } from '../core/goldPrice';
import type { Cents, Micrograms } from '../core/money';

/**
 * Тънка обвивка на чистата счетоводна книга.
 *
 * Цялата аритметика живее в `core/ledger` — тук стои само React състоянието
 * и последната грешка за показване. React Native клиентът би имал свой
 * еквивалент на този файл и нищо друго различно.
 */
export interface AccountApi {
  readonly account: Account;
  readonly error: LedgerError | null;
  readonly deposit: (amount: Cents, quote: GoldQuote) => boolean;
  readonly spend: (amount: Cents, quote: GoldQuote, merchant: string) => boolean;
  readonly sell: (gold: Micrograms, quote: GoldQuote) => boolean;
  readonly reset: () => void;
  readonly clearError: () => void;
}

export function useAccount(initial: Account = EMPTY_ACCOUNT): AccountApi {
  const [account, setAccount] = useState<Account>(initial);
  const [error, setError] = useState<LedgerError | null>(null);

  /** Прилага резултат от книгата: при успех сменя състоянието, иначе грешката. */
  const apply = useCallback(
    (result: ReturnType<typeof topUp>): boolean => {
      if (result.ok) {
        setAccount(result.account);
        setError(null);
        return true;
      }
      setError(result.error);
      return false;
    },
    [],
  );

  const deposit = useCallback(
    (amount: Cents, quote: GoldQuote) => apply(topUp(account, amount, quote)),
    [account, apply],
  );

  const spend = useCallback(
    (amount: Cents, quote: GoldQuote, merchant: string) =>
      apply(cardPayment(account, amount, quote, merchant)),
    [account, apply],
  );

  const sell = useCallback(
    (gold: Micrograms, quote: GoldQuote) => apply(sellGold(account, gold, quote)),
    [account, apply],
  );

  const reset = useCallback(() => {
    setAccount(EMPTY_ACCOUNT);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { account, error, deposit, spend, sell, reset, clearError };
}
