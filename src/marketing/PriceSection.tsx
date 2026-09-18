import { PriceChart } from '../components/PriceChart';
import { Icon } from '../components/Icon';
import { formatEur, formatPercent, perOunceFromPerGram } from '../core/format';
import type { GoldQuote } from '../core/goldPrice';

interface PriceSectionProps {
  readonly quote: GoldQuote;
  readonly history: readonly GoldQuote[];
  readonly changeRatio: number;
}

export function PriceSection({ quote, history, changeRatio }: PriceSectionProps) {
  const up = changeRatio >= 0;

  return (
    <section className="section" id="price">
      <div className="shell">
        <div className="section-head">
          <span className="eyebrow">Курс</span>
          <h2>Цената, по която се конвертира</h2>
          <p className="lede">
            Един и същ курс се вижда на сайта, в приложението и в извлечението.
            Спредът е единственият приход на платформата от обмяната.
          </p>
        </div>

        <div className="card">
          <div className="row" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
            <div>
              <div className="muted">Злато, mid цена за тройунция</div>
              <div className="ticker">
                <span className="ticker-price tnum">
                  {formatEur(quote.midPerOunce)}
                </span>
                <span className={`delta ${up ? 'delta-up' : 'delta-down'}`}>
                  <Icon name={up ? 'arrow-up' : 'arrow-down'} size={13} />
                  <span className="tnum">{formatPercent(Math.abs(changeRatio))}</span>
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div className="muted">За грам</div>
              <div className="tnum" style={{ fontSize: '1.1rem' }}>
                купува {formatEur(quote.askPerGram)} · продава{' '}
                {formatEur(quote.bidPerGram)}
              </div>
              <div className="muted tnum">
                ≈ {formatEur(perOunceFromPerGram(quote.askPerGram))} за унция
              </div>
            </div>
          </div>

          <PriceChart history={history} />

          <p className="muted" style={{ marginTop: 14 }}>
            Симулирани котировки за демонстрационни цели. Посочи графиката,
            за да видиш стойността за конкретен ден.
          </p>
        </div>
      </div>
    </section>
  );
}
