import { GRAMS_PER_TROY_OUNCE, toEur, toGrams, type Cents, type Micrograms } from './money';

/**
 * Форматиране за българска локализация.
 *
 * Intl форматерите се създават веднъж на модул — инстанцирането им е скъпо
 * и в списък с транзакции би се случвало на всеки ред.
 */

const money = new Intl.NumberFormat('bg-BG', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const moneyPrecise = new Intl.NumberFormat('bg-BG', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const gramsFmt = new Intl.NumberFormat('bg-BG', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const percentFmt = new Intl.NumberFormat('bg-BG', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateTimeFmt = new Intl.DateTimeFormat('bg-BG', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const dateFmt = new Intl.DateTimeFormat('bg-BG', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export const formatEur = (cents: Cents): string => money.format(toEur(cents));

export const formatEurPrecise = (cents: Cents): string =>
  moneyPrecise.format(toEur(cents));

/** Подписана сума: винаги с + или − отпред, за история на транзакции. */
export const formatEurSigned = (cents: Cents): string =>
  `${cents >= 0 ? '+' : '−'}${money.format(Math.abs(toEur(cents)))}`;

export const formatGrams = (ug: Micrograms): string =>
  `${gramsFmt.format(toGrams(ug))} г`;

export const formatGramsSigned = (ug: Micrograms): string =>
  `${ug >= 0 ? '+' : '−'}${gramsFmt.format(Math.abs(toGrams(ug)))} г`;

export const formatPercent = (ratio: number): string => percentFmt.format(ratio);

export const formatDateTime = (at: number): string => dateTimeFmt.format(at);

export const formatDate = (at: number): string => dateFmt.format(at);

/** Цена за унция от цена за грам — показва се до котировката за справка. */
export const perOunceFromPerGram = (perGram: Cents): Cents =>
  Math.round(perGram * GRAMS_PER_TROY_OUNCE);
