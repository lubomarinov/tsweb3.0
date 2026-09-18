import { useState } from 'react';
import { formatEur, formatGrams } from '../core/format';
import { goldForAmount, TOPUP_MAX, TOPUP_MIN } from '../core/ledger';
import { eur, type Cents } from '../core/money';
import type { GoldQuote } from '../core/goldPrice';

const PRESETS: readonly number[] = [100, 500, 1000, 2500];

interface TopUpPanelProps {
  readonly quote: GoldQuote;
  readonly onSubmit: (amount: Cents) => void;
}

export function TopUpPanel({ quote, onSubmit }: TopUpPanelProps) {
  const [amount, setAmount] = useState('1000');

  const parsed = Number.parseFloat(amount.replace(',', '.'));
  const cents = Number.isFinite(parsed) ? eur(parsed) : 0;
  const valid = cents >= TOPUP_MIN && cents <= TOPUP_MAX;
  const gold = valid ? goldForAmount(cents, quote.askPerGram) : 0;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onSubmit(cents);
      }}
    >
      <div className="field">
        <label htmlFor="topup-amount">Сума за зареждане (EUR)</label>
        <input
          id="topup-amount"
          className="input"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>

      <div className="chips" style={{ marginBottom: 16 }}>
        {PRESETS.map((preset) => (
          <button
            type="button"
            key={preset}
            className={`chip ${parsed === preset ? 'chip-active' : ''}`}
            onClick={() => setAmount(String(preset))}
          >
            {preset} €
          </button>
        ))}
      </div>

      {/* Курсът и количеството се показват ПРЕДИ потвърждение — това е
          основното обещание на продукта за прозрачност. */}
      <div className="quote-box">
        <div className="row">
          <span className="muted">Курс купува</span>
          <span className="tnum">{formatEur(quote.askPerGram)} / г</span>
        </div>
        <div className="row">
          <span className="muted">Такса за зареждане</span>
          <span className="tnum">{formatEur(0)}</span>
        </div>
        <div className="row">
          <span className="secondary">Получаваш</span>
          <strong className="tnum" style={{ color: 'var(--gold-300)' }}>
            {formatGrams(gold)}
          </strong>
        </div>
      </div>

      <button className="btn btn-primary btn-block" type="submit" disabled={!valid}>
        Зареди и купи злато
      </button>

      {!valid && amount !== '' && (
        <p className="muted" style={{ marginTop: 10 }}>
          Сумата трябва да е между {formatEur(TOPUP_MIN)} и {formatEur(TOPUP_MAX)}.
        </p>
      )}
    </form>
  );
}
