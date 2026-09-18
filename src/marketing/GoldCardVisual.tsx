import { formatEur, formatGrams } from '../core/format';
import { BRAND } from '../core/content';
import type { Cents, Micrograms } from '../core/money';

/**
 * Визуализация на картата. Показва салдото в грамове като основна стойност
 * и евровата равностойност отдолу — точно както е и в приложението, защото
 * това е основното твърдение на продукта.
 */
interface GoldCardVisualProps {
  readonly gold: Micrograms;
  readonly value: Cents;
  readonly holder?: string;
}

export function GoldCardVisual({
  gold,
  value,
  holder = 'ДЕМО ПОТРЕБИТЕЛ',
}: GoldCardVisualProps) {
  return (
    <div className="gold-card">
      <div className="gold-card-top">
        <span className="gold-card-brand">{BRAND.name}</span>
        <span className="gold-card-sub">999,9</span>
      </div>

      <div>
        <div className="gold-card-balance tnum">{formatGrams(gold)}</div>
        <div className="gold-card-sub tnum">≈ {formatEur(value)}</div>
      </div>

      <div className="row">
        <span className="gold-card-number tnum">•••• 4408</span>
        <span className="gold-card-sub">{holder}</span>
      </div>
    </div>
  );
}
