import { GoldCardVisual } from './GoldCardVisual';
import { formatEur, formatGrams, formatPercent } from '../core/format';
import { goldForAmount } from '../core/ledger';
import { eur } from '../core/money';
import type { GoldQuote } from '../core/goldPrice';
import { SPREAD } from '../core/goldPrice';

interface HeroProps {
  readonly quote: GoldQuote;
  readonly onOpenDemo: () => void;
}

export function Hero({ quote, onOpenDemo }: HeroProps) {
  // Показваме конкретния пример от продукта: 1 000 € → грамове по текущия курс.
  const exampleAmount = eur(1000);
  const exampleGold = goldForAmount(exampleAmount, quote.askPerGram);

  return (
    <header className="hero" id="top">
      <div className="shell hero-inner">
        <div>
          <span className="eyebrow">Злато-обезпечена сметка</span>
          <h1>
            Зареждаш 1 000 €.
            <br />
            Държиш{' '}
            <span style={{ color: 'var(--gold-300)' }} className="tnum">
              {formatGrams(exampleGold)}
            </span>{' '}
            злато.
          </h1>

          <p className="lede">
            Всяко зареждане купува инвестиционно злато по спот курса в същата
            секунда. Всяко плащане с картата продава точно толкова метал,
            колкото покрива сметката — по курса в момента на плащането.
          </p>

          <div className="hero-actions">
            <button className="btn btn-primary" onClick={onOpenDemo}>
              Пробвай демото
            </button>
            <a className="btn btn-ghost" href="#how">
              Как работи
            </a>
          </div>

          <div className="hero-stats">
            <div>
              <div className="stat-value tnum">{formatEur(quote.askPerGram)}</div>
              <div className="stat-label">за грам, купува</div>
            </div>
            <div>
              <div className="stat-value tnum">{formatEur(quote.bidPerGram)}</div>
              <div className="stat-label">за грам, продава</div>
            </div>
            <div>
              <div className="stat-value tnum">{formatPercent(SPREAD)}</div>
              <div className="stat-label">спред във всяка посока</div>
            </div>
          </div>
        </div>

        <GoldCardVisual
          gold={exampleGold}
          value={Math.round((exampleGold / 1_000_000) * quote.bidPerGram)}
        />
      </div>
    </header>
  );
}
