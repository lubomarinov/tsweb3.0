import {
  feeOf,
  type Cents,
  type Micrograms,
  MICROGRAMS_PER_GRAM,
} from './money';
import type { GoldQuote } from './goldPrice';

/**
 * Счетоводна книга на злато-обезпечената сметка.
 *
 * Модел на продукта: клиентът НЕ държи евро салдо. Всяко зареждане купува
 * злато веднага; всяко плащане с картата продава точно толкова злато,
 * колкото трябва, за да покрие сумата в момента на авторизация.
 *
 * Всички функции тук са чисти (pure): взимат състояние + събитие и връщат
 * ново състояние. Затова са тестваеми без UI и се преизползват дословно
 * от React Native клиента.
 */

export type TxKind =
  /** Зареждане с евро → покупка на злато. */
  | 'topup'
  /** Плащане с картата → продажба на злато. */
  | 'card'
  /** Ръчна продажба на злато → изплащане в евро. */
  | 'sell';

export interface Transaction {
  readonly id: string;
  readonly kind: TxKind;
  readonly at: number;
  /** Описание за изписване в историята. */
  readonly title: string;
  /** Брутна сума в евроцентове (това, което клиентът внася или плаща). */
  readonly amount: Cents;
  /** Удържана такса в евроцентове. */
  readonly fee: Cents;
  /** Злато, купено (+) или продадено (−) в микрограмове. */
  readonly goldDelta: Micrograms;
  /** Курсът за грам, приложен към сделката (евроцентове за грам). */
  readonly pricePerGram: Cents;
}

export interface Account {
  /** Наличност злато в микрограмове. */
  readonly gold: Micrograms;
  /** Сума на всички зареждания в евроцентове — база за пресмятане на P&L. */
  readonly deposited: Cents;
  /** Сума на всички изтеглени/похарчени евро. */
  readonly withdrawn: Cents;
  /** Сума на платените такси — показва се прозрачно в демото. */
  readonly feesPaid: Cents;
  readonly transactions: readonly Transaction[];
}

export const EMPTY_ACCOUNT: Account = {
  gold: 0,
  deposited: 0,
  withdrawn: 0,
  feesPaid: 0,
  transactions: [],
};

/**
 * Такси на продукта.
 *
 * Зареждането е без такса — платформата печели от спреда (виж `SPREAD`).
 * Плащането с картата също минава по спред; допълнителната такса се начислява
 * само над безплатния месечен лимит, както при повечето мулти-валутни карти.
 */
export const FEES = {
  /** Такса при зареждане (върху брутната сума). */
  topup: 0,
  /** Такса при плащане с карта над безплатния лимит. */
  cardOverLimit: 0.005,
  /** Безплатен месечен оборот по картата в евроцентове (1 000,00 EUR). */
  freeMonthlyCardVolume: 100_000 as Cents,
  /** Такса при ръчна продажба на злато обратно в евро. */
  sell: 0.0025,
} as const;

/** Минимално и максимално зареждане в евроцентове. */
export const TOPUP_MIN: Cents = 10_00;
export const TOPUP_MAX: Cents = 1_000_000; // 10 000,00 EUR

let sequence = 0;
const nextId = (): string => {
  sequence += 1;
  return `tx_${sequence.toString(36)}_${Date.now().toString(36)}`;
};

/**
 * Колко микрограма злато се получават за дадена сума по дадена цена за грам.
 *
 * Умножаваме ПРЕДИ да разделим: така делението е единствената операция със
 * закръгляне и резултатът е същият като на сървъра, който смята с цели числа.
 * Междинната стойност е под 2^53, защото зареждането е с горен лимит.
 */
export function goldForAmount(amount: Cents, pricePerGram: Cents): Micrograms {
  if (pricePerGram <= 0) return 0;
  // Закръгляме НАДОЛУ — платформата никога не издава злато, което не е купила.
  return Math.floor((amount * MICROGRAMS_PER_GRAM) / pricePerGram);
}

/** Колко евроцента струва дадено количество злато по дадена цена за грам. */
export function amountForGold(gold: Micrograms, pricePerGram: Cents): Cents {
  return Math.round((gold * pricePerGram) / MICROGRAMS_PER_GRAM);
}

/** Пазарна стойност на сметката, ако се ликвидира сега (по bid цената). */
export function portfolioValue(account: Account, quote: GoldQuote): Cents {
  return amountForGold(account.gold, quote.bidPerGram);
}

/**
 * Нереализиран резултат: колко струва златото сега спрямо нетно вложеното.
 * Отрицателна стойност е напълно възможна — златото пада, както и се качва.
 */
export function unrealisedPnl(account: Account, quote: GoldQuote): Cents {
  const invested = account.deposited - account.withdrawn;
  return portfolioValue(account, quote) - invested;
}

/** Оборот по картата за текущия календарен месец — база за безплатния лимит. */
export function cardVolumeThisMonth(account: Account, now: number): Cents {
  const start = new Date(now);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const from = start.getTime();
  return account.transactions
    .filter((tx) => tx.kind === 'card' && tx.at >= from)
    .reduce((sum, tx) => sum + tx.amount, 0);
}

export type LedgerError =
  | { code: 'amount_too_small'; min: Cents }
  | { code: 'amount_too_large'; max: Cents }
  | { code: 'insufficient_gold'; requiredGold: Micrograms; availableGold: Micrograms };

export type LedgerResult =
  | { ok: true; account: Account; transaction: Transaction }
  | { ok: false; error: LedgerError };

/**
 * Зареждане: клиентът внася евро, платформата купува злато по ask цената.
 */
export function topUp(
  account: Account,
  amount: Cents,
  quote: GoldQuote,
  now: number = Date.now(),
): LedgerResult {
  if (amount < TOPUP_MIN) {
    return { ok: false, error: { code: 'amount_too_small', min: TOPUP_MIN } };
  }
  if (amount > TOPUP_MAX) {
    return { ok: false, error: { code: 'amount_too_large', max: TOPUP_MAX } };
  }

  const fee = feeOf(amount, FEES.topup);
  const net = amount - fee;
  const bought = goldForAmount(net, quote.askPerGram);

  const transaction: Transaction = {
    id: nextId(),
    kind: 'topup',
    at: now,
    title: 'Зареждане и покупка на злато',
    amount,
    fee,
    goldDelta: bought,
    pricePerGram: quote.askPerGram,
  };

  return {
    ok: true,
    transaction,
    account: {
      ...account,
      gold: account.gold + bought,
      deposited: account.deposited + amount,
      feesPaid: account.feesPaid + fee,
      transactions: [transaction, ...account.transactions],
    },
  };
}

/**
 * Плащане с картата: продава се точно толкова злато, колкото покрива
 * сумата плюс таксата, по bid цената в момента на авторизация.
 */
export function cardPayment(
  account: Account,
  amount: Cents,
  quote: GoldQuote,
  merchant: string,
  now: number = Date.now(),
): LedgerResult {
  if (amount <= 0) {
    return { ok: false, error: { code: 'amount_too_small', min: 1 } };
  }

  // Таксата се начислява само върху частта над безплатния месечен лимит.
  const usedThisMonth = cardVolumeThisMonth(account, now);
  const remainingFree = Math.max(FEES.freeMonthlyCardVolume - usedThisMonth, 0);
  const chargeable = Math.max(amount - remainingFree, 0);
  const fee = feeOf(chargeable, FEES.cardOverLimit);

  const total = amount + fee;
  const requiredGold = Math.ceil((total * MICROGRAMS_PER_GRAM) / quote.bidPerGram);

  if (requiredGold > account.gold) {
    return {
      ok: false,
      error: {
        code: 'insufficient_gold',
        requiredGold,
        availableGold: account.gold,
      },
    };
  }

  const transaction: Transaction = {
    id: nextId(),
    kind: 'card',
    at: now,
    title: merchant,
    amount,
    fee,
    goldDelta: -requiredGold,
    pricePerGram: quote.bidPerGram,
  };

  return {
    ok: true,
    transaction,
    account: {
      ...account,
      gold: account.gold - requiredGold,
      withdrawn: account.withdrawn + total,
      feesPaid: account.feesPaid + fee,
      transactions: [transaction, ...account.transactions],
    },
  };
}

/**
 * Ръчна продажба на злато обратно в евро (например към банкова сметка).
 */
export function sellGold(
  account: Account,
  gold: Micrograms,
  quote: GoldQuote,
  now: number = Date.now(),
): LedgerResult {
  if (gold <= 0) {
    return { ok: false, error: { code: 'amount_too_small', min: 1 } };
  }
  if (gold > account.gold) {
    return {
      ok: false,
      error: {
        code: 'insufficient_gold',
        requiredGold: gold,
        availableGold: account.gold,
      },
    };
  }

  const gross = amountForGold(gold, quote.bidPerGram);
  const fee = feeOf(gross, FEES.sell);

  const transaction: Transaction = {
    id: nextId(),
    kind: 'sell',
    at: now,
    title: 'Продажба на злато',
    amount: gross,
    fee,
    goldDelta: -gold,
    pricePerGram: quote.bidPerGram,
  };

  return {
    ok: true,
    transaction,
    account: {
      ...account,
      gold: account.gold - gold,
      withdrawn: account.withdrawn + gross - fee,
      feesPaid: account.feesPaid + fee,
      transactions: [transaction, ...account.transactions],
    },
  };
}
