/**
 * Точна аритметика за пари и злато.
 *
 * Никога не пазим пари или грамове като float — закръгляването на float
 * създава "изчезващи" стотинки в счетоводната книга. Вместо това:
 *   - парите се пазят в евроцентове (integer)
 *   - златото се пази в микрограмове (integer, 1 g = 1_000_000 µg)
 *
 * Файлът няма никакви зависимости от DOM или React → използва се
 * непроменен и от React Native клиента.
 */

/** Евроцентове. 1 EUR = 100. */
export type Cents = number;

/** Микрограмове злато. 1 g = 1_000_000 µg. */
export type Micrograms = number;

export const CENTS_PER_EUR = 100;
export const MICROGRAMS_PER_GRAM = 1_000_000;

/** Грамове в една тройунция — стандартът, по който се котира златото. */
export const GRAMS_PER_TROY_OUNCE = 31.1034768;

export const eur = (amount: number): Cents => Math.round(amount * CENTS_PER_EUR);
export const toEur = (cents: Cents): number => cents / CENTS_PER_EUR;

export const grams = (amount: number): Micrograms =>
  Math.round(amount * MICROGRAMS_PER_GRAM);
export const toGrams = (ug: Micrograms): number => ug / MICROGRAMS_PER_GRAM;

/**
 * Процентна такса върху сума. Закръгля се НАГОРЕ до цял цент, за да не може
 * серия от микро-транзакции да се използва за избягване на таксата.
 */
export const feeOf = (amount: Cents, rate: number): Cents =>
  Math.ceil(amount * rate);

/** Ограничава стойност в интервал — ползва се при валидация на въвеждане. */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);
