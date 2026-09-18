import { useEffect, useMemo, useState } from 'react';
import {
  createSimulatedFeed,
  type GoldQuote,
} from '../core/goldPrice';

/**
 * Абонамент за ценовия поток.
 *
 * Потокът се създава веднъж за целия живот на модула, а не на всеки рендер —
 * иначе всеки компонент би виждал различна история и графиката щеше да
 * "скача" при всяка промяна на състоянието.
 */
const feed = createSimulatedFeed();

export interface GoldPriceState {
  readonly quote: GoldQuote;
  readonly history: readonly GoldQuote[];
  /** Промяна спрямо първата точка в историята, като дял (0.043 = +4,3%). */
  readonly changeRatio: number;
}

export function useGoldPrice(): GoldPriceState {
  const [quote, setQuote] = useState<GoldQuote>(() => feed.current());

  useEffect(() => feed.subscribe(setQuote), []);

  return useMemo(() => {
    const history = feed.history();
    const first = history[0];
    const changeRatio =
      first && first.midPerOunce > 0
        ? (quote.midPerOunce - first.midPerOunce) / first.midPerOunce
        : 0;
    // `quote` е в зависимостите, защото историята се обновява заедно с него.
    return { quote, history, changeRatio };
  }, [quote]);
}
