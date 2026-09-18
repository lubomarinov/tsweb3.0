import { Icon, type IconName } from '../components/Icon';
import {
  formatDateTime,
  formatEur,
  formatGramsSigned,
} from '../core/format';
import type { Transaction } from '../core/ledger';

const ICONS: Record<Transaction['kind'], IconName> = {
  topup: 'arrow-down',
  card: 'card',
  sell: 'arrow-up',
};

interface TransactionListProps {
  readonly transactions: readonly Transaction[];
}

export function TransactionList({ transactions }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <p className="muted">
        Още няма движения. Зареди сметката, за да купиш първите си грамове.
      </p>
    );
  }

  return (
    <div>
      {transactions.map((tx) => (
        <div className="tx" key={tx.id}>
          <span className="tx-icon">
            <Icon name={ICONS[tx.kind]} size={17} />
          </span>

          <div className="tx-main">
            <div className="tx-title">{tx.title}</div>
            <div className="tx-meta tnum">
              {formatDateTime(tx.at)} · {formatEur(tx.pricePerGram)}/г
              {tx.fee > 0 && ` · такса ${formatEur(tx.fee)}`}
            </div>
          </div>

          <div className="tx-amounts">
            <div className="tnum">
              {tx.kind === 'topup' ? '+' : '−'}
              {formatEur(tx.amount)}
            </div>
            <div
              className="tx-meta tnum"
              style={{
                color: tx.goldDelta >= 0 ? 'var(--good)' : 'var(--ink-muted)',
              }}
            >
              {formatGramsSigned(tx.goldDelta)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
