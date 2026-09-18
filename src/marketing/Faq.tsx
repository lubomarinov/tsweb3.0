import { FAQ } from '../core/content';

export function Faq() {
  return (
    <section className="section" id="faq">
      <div className="shell">
        <div className="section-head">
          <span className="eyebrow">Въпроси</span>
          <h2>Това, което трябва да знаеш преди да заредиш</h2>
        </div>

        <div>
          {FAQ.map((item) => (
            <details className="faq-item" key={item.question}>
              <summary>{item.question}</summary>
              <p className="faq-answer">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
