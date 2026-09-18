import { Icon, type IconName } from '../components/Icon';
import { FEATURES } from '../core/content';

export function Features() {
  return (
    <section className="section" id="features">
      <div className="shell">
        <div className="section-head">
          <span className="eyebrow">Функции</span>
          <h2>Всекидневна сметка, обезпечена с метал</h2>
        </div>

        <div className="grid grid-2 grid-3-lg">
          {FEATURES.map((feature) => (
            <article className="card" key={feature.title}>
              <div className="feature-icon">
                <Icon name={feature.icon as IconName} />
              </div>
              <h3>{feature.title}</h3>
              <p className="secondary" style={{ marginTop: 10 }}>
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
