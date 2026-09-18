/**
 * Превръща отговорите на API-то в типовете на клиентското ядро.
 *
 * Така изгледите работят с една форма на данните независимо дали демото е
 * свързано със сървъра, или симулира всичко в браузъра. Единствената реална
 * разлика е единицата за време: API-то връща секунди, ядрото ползва
 * милисекунди, защото такива иска `Intl` и `Date`.
 */

import type { ApiAccount, ApiQuote, ApiTransaction } from './api';
import type { GoldQuote } from './goldPrice';
import type { Account, Transaction, TxKind } from './ledger';

export const quoteFromApi = (quote: ApiQuote): GoldQuote => ({
  at: quote.at * 1000,
  midPerOunce: quote.mid_per_ounce,
  askPerGram: quote.ask_per_gram,
  bidPerGram: quote.bid_per_gram,
});

export const transactionFromApi = (tx: ApiTransaction): Transaction => ({
  id: String(tx.id),
  kind: tx.kind as TxKind,
  at: tx.at * 1000,
  title: tx.title,
  amount: tx.amount,
  fee: tx.fee,
  goldDelta: tx.gold_delta,
  pricePerGram: tx.price_per_gram,
});

export const accountFromApi = (
  account: ApiAccount,
  transactions: readonly ApiTransaction[],
): Account => ({
  gold: account.gold,
  deposited: account.deposited,
  withdrawn: account.withdrawn,
  feesPaid: account.fees_paid,
  transactions: transactions.map(transactionFromApi),
});
