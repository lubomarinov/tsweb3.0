import { useState } from 'react';
import { GoldCardVisual } from '../marketing/GoldCardVisual';
import { PriceChart } from '../components/PriceChart';
import { TransactionList } from './TransactionList';
import { TopUpPanel } from './TopUpPanel';
import { SpendPanel } from './SpendPanel';
import { useAccount } from '../hooks/useAccount';
import { useGoldPrice } from '../hooks/useGoldPrice';
import {
  formatEur,
  formatEurSigned,
  formatGrams,
  formatPercent,
} from '../core/format';
import { portfolioValue, unrealisedPnl } from '../core/ledger';
import { BRAND } from '../core/content';

type Tab = 'topup' | 'spend';

interface DemoAppProps {
  readonly onBack: () => void;
}

export function DemoApp({ onBack }: DemoAppProps) {
  const { quote, history } = useGoldPrice();
  const { account, error, deposit, spend, reset, clearError } = useAccount();
  const [tab, setTab] = useState<Tab>('topup');

  const value = portfolioValue(account, quote);
  const pnl = unrealisedPnl(account, quote);
  const invested = account.deposited - account.withdrawn;
  // Делът има смисъл само ако изобщо има вложени пари.
  const pnlRatio = invested > 0 ? pnl / invested : 0;

  return (
    <div className="demo">
      <div className="shell">
        <div className="row" style={{ marginBottom: 28, flexWrap: 'wrap' }}>
          <div>
            <span className="eyebrow">Демо</span>
            <h2>Симулатор на {BRAND.name}</h2>
            <p className="muted" style={{ marginTop: 6 }}>
              Симулирани котировки и салда. Никакви реални пари не се движат.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={reset}>
              Нулирай
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onBack}>
              Към сайта
            </button>
          </div>
        </div>

        <div className="demo-grid">
          <div style={{ display: 'grid', gap: 20 }}>
            <section className="card">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div className="muted">Наличност злато</div>
                  <div className="balance-big tnum">{formatGrams(account.gold)}</div>
                  <div className="secondary tnum">≈ {formatEur(value)}</div>
                </div>

                {invested > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <div className="muted">Нереализиран резултат</div>
                    <div
                      className="tnum"
                      style={{
                        fontSize: '1.3rem',
                        color: pnl >= 0 ? 'var(--good)' : 'var(--critical)',
                      }}
                    >
                      {formatEurSigned(pnl)}
                    </div>
                    <div className="muted tnum">{formatPercent(pnlRatio)}</div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 22 }}>
                <PriceChart history={history} perGram height={200} />
              </div>

              <div
                className="row"
                style={{ marginTop: 16, flexWrap: 'wrap', gap: 16 }}
              >
                <div>
                  <div className="muted">Заредено общо</div>
                  <div className="tnum">{formatEur(account.deposited)}</div>
                </div>
                <div>
                  <div className="muted">Похарчено</div>
                  <div className="tnum">{formatEur(account.withdrawn)}</div>
                </div>
                <div>
                  <div className="muted">Платени такси</div>
                  <div className="tnum">{formatEur(account.feesPaid)}</div>
                </div>
              </div>
            </section>

            <section className="card">
              <h3 style={{ marginBottom: 6 }}>Движения</h3>
              <TransactionList transactions={account.transactions} />
            </section>
          </div>

          <div style={{ display: 'grid', gap: 20 }}>
            <div className="phone">
              <GoldCardVisual gold={account.gold} value={value} />

              <div className="tabs" style={{ marginTop: 20 }}>
                <button
                  className={`tab ${tab === 'topup' ? 'tab-active' : ''}`}
                  onClick={() => {
                    setTab('topup');
                    clearError();
                  }}
                >
                  Зареди
                </button>
                <button
                  className={`tab ${tab === 'spend' ? 'tab-active' : ''}`}
                  onClick={() => {
                    setTab('spend');
                    clearError();
                  }}
                >
                  Плати
                </button>
              </div>

              {error && (
                <p className="error" style={{ marginBottom: 14 }}>
                  {error.code === 'insufficient_gold'
                    ? 'Недостатъчно злато за това плащане.'
                    : error.code === 'amount_too_small'
                      ? `Минималната сума е ${formatEur(error.min)}.`
                      : `Максималната сума е ${formatEur(error.max)}.`}
                </p>
              )}

              {tab === 'topup' ? (
                <TopUpPanel quote={quote} onSubmit={(amount) => deposit(amount, quote)} />
              ) : (
                <SpendPanel
                  account={account}
                  quote={quote}
                  onSubmit={(amount, merchant) => spend(amount, quote, merchant)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
