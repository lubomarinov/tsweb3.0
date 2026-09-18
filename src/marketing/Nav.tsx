import { Icon } from '../components/Icon';
import { BRAND } from '../core/content';

interface NavProps {
  readonly onOpenDemo: () => void;
}

export function Nav({ onOpenDemo }: NavProps) {
  return (
    <nav className="nav">
      <div className="shell nav-inner">
        <a className="brand" href="#top">
          <span style={{ color: 'var(--gold-300)' }}>
            <Icon name="logo" size={22} />
          </span>
          {BRAND.name}
        </a>

        <div className="nav-links">
          <a href="#how">Как работи</a>
          <a href="#features">Функции</a>
          <a href="#price">Цена на златото</a>
          <a href="#plans">Планове</a>
          <a href="#faq">Въпроси</a>
        </div>

        <div className="nav-actions">
          <button className="btn btn-ghost btn-sm" onClick={onOpenDemo}>
            Отвори демото
          </button>
        </div>
      </div>
    </nav>
  );
}
