import { describe, expect, it } from 'vitest';
import {
  EMPTY_ACCOUNT,
  FEES,
  TOPUP_MAX,
  TOPUP_MIN,
  cardPayment,
  cardVolumeThisMonth,
  portfolioValue,
  sellGold,
  topUp,
  unrealisedPnl,
  type Account,
} from './ledger';
import { quoteFromMid } from './goldPrice';
import { eur, toGrams } from './money';

/** Котировка при 3 415,00 EUR/oz ≈ 109,80 EUR/g mid. */
const quote = quoteFromMid(341_500, Date.UTC(2026, 8, 18));

/** Помощник: разопакова успешен резултат или гърми с ясно съобщение. */
const ok = (result: ReturnType<typeof topUp>): Account => {
  if (!result.ok) throw new Error(`очакван успех, получена грешка: ${result.error.code}`);
  return result.account;
};

describe('зареждане', () => {
  it('превръща 1 000 € в злато по ask цената', () => {
    const account = ok(topUp(EMPTY_ACCOUNT, eur(1000), quote));

    // Очакваните грамове: 100 000 цента / ask цена за грам.
    const expectedGrams = 100_000 / quote.askPerGram;
    expect(toGrams(account.gold)).toBeCloseTo(expectedGrams, 4);

    expect(account.deposited).toBe(eur(1000));
    expect(account.feesPaid).toBe(0); // зареждането е без такса
    expect(account.transactions).toHaveLength(1);
    expect(account.transactions[0].pricePerGram).toBe(quote.askPerGram);
  });

  it('никога не издава повече злато, отколкото е купено', () => {
    const account = ok(topUp(EMPTY_ACCOUNT, eur(1000), quote));
    const costOfIssuedGold = (account.gold / 1_000_000) * quote.askPerGram;
    expect(costOfIssuedGold).toBeLessThanOrEqual(eur(1000));
  });

  it('отхвърля суми извън лимитите', () => {
    expect(topUp(EMPTY_ACCOUNT, TOPUP_MIN - 1, quote)).toMatchObject({
      ok: false,
      error: { code: 'amount_too_small' },
    });
    expect(topUp(EMPTY_ACCOUNT, TOPUP_MAX + 1, quote)).toMatchObject({
      ok: false,
      error: { code: 'amount_too_large' },
    });
  });
});

describe('плащане с карта', () => {
  const funded = ok(topUp(EMPTY_ACCOUNT, eur(1000), quote));

  it('продава точно толкова злато, колкото покрива сумата', () => {
    const result = cardPayment(funded, eur(50), quote, 'Кауфланд');
    if (!result.ok) throw new Error(result.error.code);

    const soldGold = -result.transaction.goldDelta;
    const proceeds = (soldGold / 1_000_000) * quote.bidPerGram;

    // Продаденото злато трябва да покрива сумата (закръгляване нагоре).
    expect(proceeds).toBeGreaterThanOrEqual(eur(50));
    expect(proceeds).toBeLessThan(eur(50) + quote.bidPerGram / 1000);
    expect(result.account.gold).toBe(funded.gold - soldGold);
  });

  it('не начислява такса под безплатния месечен лимит', () => {
    const result = cardPayment(funded, eur(200), quote, 'Билла');
    if (!result.ok) throw new Error(result.error.code);
    expect(result.transaction.fee).toBe(0);
  });

  it('начислява такса само върху частта над лимита', () => {
    // Зареждаме достатъчно, за да покрием оборот над лимита.
    let account = ok(topUp(EMPTY_ACCOUNT, eur(5000), quote));

    const underLimit = cardPayment(account, FEES.freeMonthlyCardVolume, quote, 'Мебели');
    if (!underLimit.ok) throw new Error(underLimit.error.code);
    expect(underLimit.transaction.fee).toBe(0);
    account = underLimit.account;

    // Следващите 100 € са изцяло над лимита → такса 0,5%.
    const overLimit = cardPayment(account, eur(100), quote, 'Техномаркет');
    if (!overLimit.ok) throw new Error(overLimit.error.code);
    expect(overLimit.transaction.fee).toBe(Math.ceil(eur(100) * FEES.cardOverLimit));
  });

  it('отказва плащане при недостатъчно злато', () => {
    const result = cardPayment(funded, eur(5000), quote, 'Яхта');
    expect(result).toMatchObject({ ok: false, error: { code: 'insufficient_gold' } });
  });

  it('брои оборота само за текущия месец', () => {
    const now = Date.UTC(2026, 8, 18);
    const lastMonth = Date.UTC(2026, 7, 20);

    const old = cardPayment(funded, eur(300), quote, 'Стара покупка', lastMonth);
    if (!old.ok) throw new Error(old.error.code);

    expect(cardVolumeThisMonth(old.account, now)).toBe(0);
  });
});

describe('стойност на портфейла', () => {
  it('отчита спреда като моментална загуба след покупка', () => {
    const account = ok(topUp(EMPTY_ACCOUNT, eur(1000), quote));

    // Купено по ask, оценено по bid → веднага сме "на минус" със спреда.
    expect(portfolioValue(account, quote)).toBeLessThan(eur(1000));
    expect(unrealisedPnl(account, quote)).toBeLessThan(0);
  });

  it('следва цената на златото нагоре', () => {
    const account = ok(topUp(EMPTY_ACCOUNT, eur(1000), quote));
    const higher = quoteFromMid(quote.midPerOunce * 1.1, quote.at + 1000);

    expect(portfolioValue(account, higher)).toBeGreaterThan(
      portfolioValue(account, quote),
    );
    expect(unrealisedPnl(account, higher)).toBeGreaterThan(0);
  });

  it('следва цената на златото надолу', () => {
    const account = ok(topUp(EMPTY_ACCOUNT, eur(1000), quote));
    const lower = quoteFromMid(quote.midPerOunce * 0.9, quote.at + 1000);

    expect(unrealisedPnl(account, lower)).toBeLessThan(
      unrealisedPnl(account, quote),
    );
  });
});

describe('продажба на злато', () => {
  it('изплаща по bid цената и удържа такса', () => {
    const account = ok(topUp(EMPTY_ACCOUNT, eur(1000), quote));
    const result = sellGold(account, account.gold, quote);
    if (!result.ok) throw new Error(result.error.code);

    expect(result.account.gold).toBe(0);
    expect(result.transaction.fee).toBe(
      Math.ceil(result.transaction.amount * FEES.sell),
    );
  });

  it('отказва продажба над наличността', () => {
    const account = ok(topUp(EMPTY_ACCOUNT, eur(100), quote));
    expect(sellGold(account, account.gold + 1, quote)).toMatchObject({
      ok: false,
      error: { code: 'insufficient_gold' },
    });
  });
});

describe('цялостен сценарий', () => {
  it('зареждане на 1 000 €, серия плащания, златото остава консистентно', () => {
    let account = ok(topUp(EMPTY_ACCOUNT, eur(1000), quote));
    const startGold = account.gold;
    let spentGold = 0;

    for (const [merchant, amount] of [
      ['Лидл', 42.35],
      ['Shell', 78.9],
      ['Booking.com', 210.0],
    ] as const) {
      const result = cardPayment(account, eur(amount), quote, merchant);
      if (!result.ok) throw new Error(result.error.code);
      spentGold += -result.transaction.goldDelta;
      account = result.account;
    }

    // Наличността = стартово злато минус всичко продадено, без изтичане.
    expect(account.gold).toBe(startGold - spentGold);
    expect(account.transactions).toHaveLength(4);
    expect(account.gold).toBeGreaterThan(0);
  });
});
