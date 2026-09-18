import { useState } from 'react';
import { formatEur, formatGrams } from '../core/format';
import {
  FEES,
  cardVolumeThisMonth,
  type Account,
} from '../core/ledger';
import { eur, MICROGRAMS_PER_GRAM, type Cents } from '../core/money';
import type { GoldQuote } from '../core/goldPrice';

/** Типични плащания, за да се пробва картата с едно докосване. */
const MERCHANTS: readonly { name: string; amount: number }[] = [
  { name: 'Кафе', amount: 3.4 },
  { name: 'Супермаркет', amount: 62.8 },
  { name: 'Гориво', amount: 95 },
  { name: 'Самолетен билет', amount: 340 },
];

interface SpendPanelProps {
  readonly account: Account;
  readonly quote: GoldQuote;
  readonly onSubmit: (amount: Cents, merchant: string) => void;
}

export function SpendPanel({ account, quote, onSubmit }: SpendPanelProps) {
  const [amount, setAmount] = useState('62.80');
  const [merchant, setMerchant] = useState('Супермаркет');

  const parsed = Number.parseFloat(amount.replace(',', '.'));
  const cents = Number.isFinite(parsed) ? eur(parsed) : 0;

  // Същата сметка като в книгата — таксата важи само над безплатния лимит.
  // Часът идва от котировката, а не от `Date.now()`: показаната такса трябва
  // да е изчислена по същия часовник като курса до нея, а и рендерът остава чист.
  const usedThisMonth = cardVolumeThisMonth(account, quote.at);
  const remainingFree = Math.max(FEES.freeMonthlyCardVolume - usedThisMonth, 0);
  const chargeable = Math.max(cents - remainingFree, 0);
  const fee = Math.ceil(chargeable * FEES.cardOverLimit);
  const goldNeeded =
    cents > 0
      ? Math.ceil(((cents + fee) * MICROGRAMS_PER_GRAM) / quote.bidPerGram)
      : 0;

  const enough = goldNeeded > 0 && goldNeeded <= account.gold;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (enough) onSubmit(cents, merchant);
      }}
    >
      <div className="field">
        <label htmlFor="spend-merchant">Търговец</label>
        <input
          id="spend-merchant"
          className="input"
          value={merchant}
          onChange={(event) => setMerchant(event.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="spend-amount">Сума на плащането (EUR)</label>
        <input
          id="spend-amount"
          className="input"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>

      <div className="chips" style={{ marginBottom: 16 }}>
        {MERCHANTS.map((preset) => (
          <button
            type="button"
            key={preset.name}
            className={`chip ${merchant === preset.name ? 'chip-active' : ''}`}
            onClick={() => {
              setMerchant(preset.name);
              setAmount(preset.amount.toFixed(2));
            }}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div className="quote-box">
        <div className="row">
          <span className="muted">Курс продава</span>
          <span className="tnum">{formatEur(quote.bidPerGram)} / г</span>
        </div>
        <div className="row">
          <span className="muted">
            Такса
            {remainingFree > 0 &&
              ` · остават ${formatEur(remainingFree)} без такса`}
          </span>
          <span className="tnum">{formatEur(fee)}</span>
        </div>
        <div className="row">
          <span className="secondary">Продава се злато</span>
          <strong className="tnum" style={{ color: 'var(--gold-300)' }}>
            {formatGrams(goldNeeded)}
          </strong>
        </div>
      </div>

      <button className="btn btn-primary btn-block" type="submit" disabled={!enough}>
        Плати с картата
      </button>

      {!enough && cents > 0 && (
        <p className="muted" style={{ marginTop: 10 }}>
          Наличното злато ({formatGrams(account.gold)}) не покрива плащането.
          Зареди сметката първо.
        </p>
      )}
    </form>
  );
}
