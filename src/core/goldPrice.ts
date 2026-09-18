import { GRAMS_PER_TROY_OUNCE, type Cents } from './money';

/**
 * Ценови поток за злато.
 *
 * ВАЖНО: това е ДЕМО. Котировките тук са симулирани, а не реални пазарни
 * данни. `GoldPriceSource` е интерфейсът, през който продукционният клиент
 * би се закачил за реален доставчик (LBMA fixing, Metals-API, борсов feed) —
 * целият останал код работи срещу интерфейса и не се променя.
 */
export interface GoldQuote {
  /** Момент на котировката (ms epoch). */
  readonly at: number;
  /** Средна (mid) цена за тройунция в евроцентове. */
  readonly midPerOunce: Cents;
  /** Цена, на която потребителят КУПУВА грам (ask) — в евроцентове. */
  readonly askPerGram: Cents;
  /** Цена, на която потребителят ПРОДАВА грам (bid) — в евроцентове. */
  readonly bidPerGram: Cents;
}

export interface GoldPriceSource {
  /** Последна известна котировка. */
  current(): GoldQuote;
  /** Абонамент за нови котировки; връща функция за отписване. */
  subscribe(listener: (quote: GoldQuote) => void): () => void;
  /** История за графиката, най-старата точка първа. */
  history(): readonly GoldQuote[];
}

/**
 * Спред между купува и продава. Това е приходът на платформата от обмяната —
 * точно както обменното бюро печели от разликата, а не от такса.
 */
export const SPREAD = 0.004; // 0.4% от mid цената във всяка посока

/** Изгражда котировка (bid/ask) от mid цена за унция. */
export function quoteFromMid(midPerOunce: Cents, at: number): GoldQuote {
  const midPerGram = midPerOunce / GRAMS_PER_TROY_OUNCE;
  return {
    at,
    midPerOunce: Math.round(midPerOunce),
    askPerGram: Math.round(midPerGram * (1 + SPREAD)),
    bidPerGram: Math.round(midPerGram * (1 - SPREAD)),
  };
}

/**
 * Начална mid цена за тройунция в евроцентове — само за демото.
 * 341_500 цента = 3 415,00 EUR/oz ≈ 109,80 EUR/g.
 */
export const DEMO_OPENING_PRICE_PER_OUNCE: Cents = 341_500;

/**
 * Детерминиран псевдо-случаен генератор (mulberry32).
 * Детерминиран е нарочно: при едно и също seed демото показва една и съща
 * крива, така че екранните снимки и тестовете са възпроизводими.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimulatedFeedOptions {
  /** Брой исторически точки, които да се генерират предварително. */
  points?: number;
  /** Интервал между точките в милисекунди. */
  stepMs?: number;
  /** Seed за възпроизводимост. */
  seed?: number;
  /** Дневна волатилност (стандартно отклонение на дохода). */
  volatility?: number;
  /** Лек възходящ дрейф на цената за периода. */
  drift?: number;
}

/**
 * Симулиран ценови поток: случайно блуждаене с лек възходящ дрейф.
 *
 * Не претендира да моделира реален пазар — целта е графиката и конверсиите
 * в демото да се движат правдоподобно.
 */
export function createSimulatedFeed(
  options: SimulatedFeedOptions = {},
): GoldPriceSource & { tick: (now?: number) => GoldQuote; stop: () => void } {
  const {
    points = 90,
    stepMs = 24 * 60 * 60 * 1000,
    seed = 20260918,
    volatility = 0.0075,
    drift = 0.0006,
  } = options;

  const rand = mulberry32(seed);
  /** Box–Muller: превръща равномерни числа в нормално разпределени. */
  const gauss = () => {
    const u = Math.max(rand(), Number.EPSILON);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };

  const now = Date.now();
  const series: GoldQuote[] = [];
  let mid = DEMO_OPENING_PRICE_PER_OUNCE;

  // Строим историята назад във времето, за да завърши тя в "сега".
  for (let i = points - 1; i >= 0; i -= 1) {
    mid = mid * (1 + drift + gauss() * volatility);
    series.push(quoteFromMid(mid, now - i * stepMs));
  }

  const listeners = new Set<(quote: GoldQuote) => void>();
  let timer: ReturnType<typeof setInterval> | undefined;

  const tick = (at: number = Date.now()): GoldQuote => {
    // Вътредневните движения са по-малки от дневните.
    mid = mid * (1 + gauss() * volatility * 0.12);
    const quote = quoteFromMid(mid, at);
    series.push(quote);
    if (series.length > points * 4) series.splice(0, series.length - points * 4);
    listeners.forEach((listener) => listener(quote));
    return quote;
  };

  return {
    current: () => series[series.length - 1],
    history: () => series,
    tick,
    subscribe(listener) {
      listeners.add(listener);
      // Таймерът се пуска при първия абонат и спира при последния отписал се,
      // за да не тече в празен ход на фон.
      if (!timer) timer = setInterval(() => tick(), 4000);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
      listeners.clear();
    },
  };
}
