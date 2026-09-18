/**
 * Клиент към FexoGold API.
 *
 * Сумите пътуват като цели числа (центове, микрограмове) — същите единици
 * като в `core/money.ts`, за да няма превръщане по пътя, което да внесе
 * грешка от закръгляне.
 */

import type { Cents, Micrograms } from './money';

/** Базов адрес на API-то; сменя се през VITE_API_URL при билд. */
export const API_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

export interface ApiQuote {
  readonly at: number;
  readonly mid_per_ounce: Cents;
  readonly ask_per_gram: Cents;
  readonly bid_per_gram: Cents;
  readonly spread: number;
}

export interface ApiTransaction {
  readonly id: number;
  readonly kind: 'topup' | 'card' | 'sell';
  readonly title: string;
  readonly at: number;
  readonly amount: Cents;
  readonly fee: Cents;
  readonly gold_delta: Micrograms;
  readonly price_per_gram: Cents;
  readonly gold_after: Micrograms;
}

export interface ApiAccount {
  readonly gold: Micrograms;
  readonly deposited: Cents;
  readonly withdrawn: Cents;
  readonly fees_paid: Cents;
  readonly value: Cents;
  readonly unrealised_pnl: Cents;
  readonly card_volume_this_month: Cents;
  readonly quote: ApiQuote;
}

export interface ApiMovement {
  readonly transaction: ApiTransaction;
  readonly account: ApiAccount;
}

export interface ApiToken {
  readonly access_token: string;
  readonly token_type: string;
  readonly expires_in: number;
}

/**
 * Отказ от сървъра с машинно четим код.
 *
 * Кодът, а не текстът, решава какво показва интерфейсът — така съобщенията
 * се променят, без да се пипа логиката.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status: number,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions {
  readonly method?: string;
  readonly body?: unknown;
  readonly token?: string | null;
  /** Ключ за идемпотентност — задължителен за финансовите заявки. */
  readonly idempotencyKey?: string;
  readonly signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, idempotencyKey, signal } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    // Мрежова грешка, а не отказ от сървъра — различават се, защото само
    // първата има смисъл да се повтори.
    throw new ApiError('network_error', 'Сървърът не отговаря.', 0, { cause });
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    // Домейн отказите идват като {code, message}; FastAPI валидацията и
    // HTTPException ги слагат в {detail: ...}.
    const detail =
      payload && typeof payload === 'object' && 'detail' in payload
        ? (payload as { detail: unknown }).detail
        : payload;

    const shape = (detail ?? {}) as {
      code?: string;
      message?: string;
      details?: Record<string, unknown>;
    };

    throw new ApiError(
      shape.code ?? 'http_error',
      shape.message ?? `Грешка ${response.status}.`,
      response.status,
      shape.details ?? {},
    );
  }

  return payload as T;
}

/** Ключ за идемпотентност; `randomUUID` липсва при http на стар браузър. */
const newIdempotencyKey = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const api = {
  health: (signal?: AbortSignal) =>
    request<{ status: string; brand: string }>('/health', { signal }),

  register: (email: string, fullName: string, password: string) =>
    request<ApiToken>('/auth/register', {
      method: 'POST',
      body: { email, full_name: fullName, password },
    }),

  login: (email: string, password: string) =>
    request<ApiToken>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  me: (token: string) =>
    request<{ id: number; email: string; full_name: string }>('/auth/me', { token }),

  price: (signal?: AbortSignal) => request<ApiQuote>('/price', { signal }),

  priceHistory: (points = 90, signal?: AbortSignal) =>
    request<{ quotes: ApiQuote[] }>(`/price/history?points=${points}`, { signal }),

  account: (token: string, signal?: AbortSignal) =>
    request<ApiAccount>('/account', { token, signal }),

  transactions: (token: string, limit = 50, signal?: AbortSignal) =>
    request<ApiTransaction[]>(`/account/transactions?limit=${limit}`, {
      token,
      signal,
    }),

  topUp: (token: string, amount: Cents) =>
    request<ApiMovement>('/account/topup', {
      method: 'POST',
      token,
      body: { amount },
      idempotencyKey: newIdempotencyKey(),
    }),

  cardPayment: (token: string, amount: Cents, merchant: string) =>
    request<ApiMovement>('/account/card-payment', {
      method: 'POST',
      token,
      body: { amount, merchant },
      idempotencyKey: newIdempotencyKey(),
    }),

  sell: (token: string, gold: Micrograms) =>
    request<ApiMovement>('/account/sell', {
      method: 'POST',
      token,
      body: { gold },
      idempotencyKey: newIdempotencyKey(),
    }),
};
