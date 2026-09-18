import { useMemo, useState } from 'react';
import { GoldCardVisual } from '../marketing/GoldCardVisual';
import { PriceChart } from '../components/PriceChart';
import { TransactionList } from './TransactionList';
import { TopUpPanel } from './TopUpPanel';
import { SpendPanel } from './SpendPanel';
import { AuthPanel } from './AuthPanel';
import { useAccount } from '../hooks/useAccount';
import { useGoldPrice } from '../hooks/useGoldPrice';
import { useBackend } from '../hooks/useBackend';
import { accountFromApi, quoteFromApi } from '../core/adapters';
import {
  formatEur,
  formatEurSigned,
  formatGrams,
  formatPercent,
} from '../core/format';
import { EMPTY_ACCOUNT, portfolioValue, unrealisedPnl } from '../core/ledger';
import { BRAND } from '../core/content';
import { API_URL } from '../core/api';

type Tab = 'topup' | 'spend';

interface DemoAppProps {
  readonly onBack: () => void;
}

/** Съобщения по код на грешката, а не по текста от сървъра. */
const ERROR_MESSAGES: Record<string, string> = {
  insufficient_gold: 'Недостатъчно злато за това плащане.',
  amount_too_small: 'Сумата е под минимума.',
  amount_too_large: 'Сумата е над максимума.',
  network_error: 'Сървърът не отговаря.',
};

export function DemoApp({ onBack }: DemoAppProps) {
  const backend = useBackend();
  const local = useAccount();
  const localPrice = useGoldPrice();
  const [tab, setTab] = useState<Tab>('topup');

  const online = backend.status === 'online';
  const signedIn = online && backend.token !== null && backend.account !== null;

  // Двата режима се свеждат до една форма на данните, за да не се раздвоява
  // изгледът. Разликата остава само в това кой е авторитетът.
  const view = useMemo(() => {
    if (online && backend.account) {
      return {
        account: accountFromApi(backend.account, backend.transactions),
        quote: quoteFromApi(backend.account.quote),
        history: backend.history.map(quoteFromApi),
        value: backend.account.value,
        pnl: backend.account.unrealised_pnl,
      };
    }

    // Преди вход показваме празна сметка, но с реалния курс от сървъра,
    // ако той вече е отговорил.
    const quote =
      online && backend.quote ? quoteFromApi(backend.quote) : localPrice.quote;
    const history =
      online && backend.history.length > 0
        ? backend.history.map(quoteFromApi)
        : localPrice.history;
    const account = online ? EMPTY_ACCOUNT : local.account;

    return {
      account,
      quote,
      history,
      value: portfolioValue(account, quote),
      pnl: unrealisedPnl(account, quote),
    };
  }, [
    online,
    backend.account,
    backend.transactions,
    backend.history,
    backend.quote,
    local.account,
    localPrice.quote,
    localPrice.history,
  ]);

  const invested = view.account.deposited - view.account.withdrawn;
  const pnlRatio = invested > 0 ? view.pnl / invested : 0;

  const errorCode = online ? backend.error?.code : local.error?.code;
  const errorText = errorCode
    ? (ERROR_MESSAGES[errorCode] ??
      (online ? backend.error?.message : 'Грешка.'))
    : null;

  const clearError = online ? backend.clearError : local.clearError;

  const handleTopUp = (amount: number) => {
    if (online) void backend.topUp(amount);
    else local.deposit(amount, view.quote);
  };

  const handleSpend = (amount: number, merchant: string) => {
    if (online) void backend.pay(amount, merchant);
    else local.spend(amount, view.quote, merchant);
  };

  const handleReset = () => {
    if (online) backend.logout();
    else local.reset();
  };

  return (
    <div className="demo">
      <div className="shell">
        <div className="row" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
          <div>
            <span className="eyebrow">Демо</span>
            <h2>{BRAND.name}</h2>
            <p className="muted" style={{ marginTop: 6 }}>
              Симулирани котировки и салда. Никакви реални пари не се движат.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleReset}>
              {online && signedIn ? 'Изход' : 'Нулирай'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onBack}>
              Към сайта
            </button>
          </div>
        </div>

        {/* Кой смята — сървърът или браузърът. Важно е да е видимо, защото
            в двата режима салдото се пази на различно място. */}
        <p
          className="quote-box"
          style={{ display: 'block', marginBottom: 24, maxWidth: '70ch' }}
        >
          {backend.status === 'checking' && 'Проверявам връзката с бекенда…'}
          {backend.status === 'online' && (
            <>
              <strong style={{ color: 'var(--gold-300)' }}>Свързано с бекенда</strong>{' '}
              <span className="muted">
                · {API_URL} · сметката и курсът идват от сървъра, който записва
                всяко движение
              </span>
            </>
          )}
          {backend.status === 'offline' && (
            <>
              <strong>Самостоятелен режим</strong>{' '}
              <span className="muted">
                · бекендът на {API_URL} не отговаря, затова всичко се смята в
                браузъра и се губи при презареждане
              </span>
            </>
          )}
        </p>

        <div className="demo-grid">
          <div style={{ display: 'grid', gap: 20 }}>
            <section className="card">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div className="muted">Наличност злато</div>
                  <div className="balance-big tnum">
                    {formatGrams(view.account.gold)}
                  </div>
                  <div className="secondary tnum">≈ {formatEur(view.value)}</div>
                </div>

                {invested > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <div className="muted">Нереализиран резултат</div>
                    <div
                      className="tnum"
                      style={{
                        fontSize: '1.3rem',
                        color: view.pnl >= 0 ? 'var(--good)' : 'var(--critical)',
                      }}
                    >
                      {formatEurSigned(view.pnl)}
                    </div>
                    <div className="muted tnum">{formatPercent(pnlRatio)}</div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 22 }}>
                <PriceChart history={view.history} perGram height={200} />
              </div>

              <div
                className="row"
                style={{ marginTop: 16, flexWrap: 'wrap', gap: 16 }}
              >
                <div>
                  <div className="muted">Заредено общо</div>
                  <div className="tnum">{formatEur(view.account.deposited)}</div>
                </div>
                <div>
                  <div className="muted">Похарчено</div>
                  <div className="tnum">{formatEur(view.account.withdrawn)}</div>
                </div>
                <div>
                  <div className="muted">Платени такси</div>
                  <div className="tnum">{formatEur(view.account.feesPaid)}</div>
                </div>
              </div>
            </section>

            <section className="card">
              <h3 style={{ marginBottom: 6 }}>Движения</h3>
              <TransactionList transactions={view.account.transactions} />
            </section>
          </div>

          <div style={{ display: 'grid', gap: 20 }}>
            <div className="phone">
              <GoldCardVisual gold={view.account.gold} value={view.value} />

              {online && !signedIn ? (
                <div style={{ marginTop: 20 }}>
                  <AuthPanel
                    busy={backend.busy}
                    error={backend.error}
                    onLogin={backend.login}
                    onRegister={backend.register}
                    onClearError={backend.clearError}
                  />
                </div>
              ) : (
                <>
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

                  {errorText && (
                    <p className="error" style={{ marginBottom: 14 }}>
                      {errorText}
                    </p>
                  )}

                  {tab === 'topup' ? (
                    <TopUpPanel quote={view.quote} onSubmit={handleTopUp} />
                  ) : (
                    <SpendPanel
                      account={view.account}
                      quote={view.quote}
                      onSubmit={handleSpend}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
