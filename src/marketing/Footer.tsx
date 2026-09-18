import { Icon } from '../components/Icon';
import { BRAND } from '../core/content';

export function Footer() {
  return (
    <footer className="footer">
      <div className="shell">
        <div className="row" style={{ flexWrap: 'wrap', gap: 20 }}>
          <span className="brand">
            <span style={{ color: 'var(--gold-300)' }}>
              <Icon name="logo" size={20} />
            </span>
            {BRAND.name}
          </span>
          <span>© {new Date().getFullYear()} · Демонстрационен проект</span>
        </div>

        <p className="disclaimer">{BRAND.legalNote}</p>
      </div>
    </footer>
  );
}
