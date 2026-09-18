import { STEPS } from '../core/content';

export function HowItWorks() {
  return (
    <section className="section" id="how">
      <div className="shell">
        <div className="section-head">
          <span className="eyebrow">Как работи</span>
          <h2>Четири стъпки, нула банкови часове</h2>
          <p className="lede">
            Между зареждането и метала в трезора няма човек, който да въвежда
            нареждане на ръка. Конверсията е автоматична и се записва с курса,
            по който е станала.
          </p>
        </div>

        <div className="steps">
          {STEPS.map((step) => (
            <div className="step" key={step.number}>
              <span className="step-number tnum">{step.number}</span>
              <h3>{step.title}</h3>
              <p className="secondary" style={{ marginTop: 8 }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
