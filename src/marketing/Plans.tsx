import { Icon } from '../components/Icon';
import { PLANS } from '../core/content';

interface PlansProps {
  readonly onOpenDemo: () => void;
}

export function Plans({ onOpenDemo }: PlansProps) {
  return (
    <section className="section" id="plans">
      <div className="shell">
        <div className="section-head">
          <span className="eyebrow">Планове</span>
          <h2>Плащаш за по-тесен спред, не за достъп</h2>
          <p className="lede">
            Всички планове държат метала по един и същи начин. Разликата е в
            спреда, лимитите и съхранението.
          </p>
        </div>

        <div className="grid grid-3">
          {PLANS.map((plan) => (
            <article
              className={`card plan ${plan.featured ? 'plan-featured' : ''}`}
              key={plan.id}
            >
              {plan.featured && <span className="badge">Най-избиран</span>}

              <div>
                <h3>{plan.name}</h3>
                <p className="muted" style={{ marginTop: 4 }}>
                  {plan.summary}
                </p>
              </div>

              <div>
                <span className="plan-price tnum">{plan.price}</span>{' '}
                <span className="muted">{plan.period}</span>
              </div>

              <ul className="plan-perks">
                {plan.perks.map((perk) => (
                  <li key={perk}>
                    <Icon name="check" size={15} />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`btn btn-block ${plan.featured ? 'btn-primary' : 'btn-ghost'}`}
                style={{ marginTop: 'auto' }}
                onClick={onOpenDemo}
              >
                Виж в демото
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
