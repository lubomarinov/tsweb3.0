import { useEffect, useState } from 'react';
import { Nav } from './marketing/Nav';
import { Hero } from './marketing/Hero';
import { HowItWorks } from './marketing/HowItWorks';
import { Features } from './marketing/Features';
import { PriceSection } from './marketing/PriceSection';
import { Plans } from './marketing/Plans';
import { Faq } from './marketing/Faq';
import { Footer } from './marketing/Footer';
import { DemoApp } from './demo/DemoApp';
import { useGoldPrice } from './hooks/useGoldPrice';

type Route = 'site' | 'demo';

/**
 * Маршрутизация през hash — достатъчна за две изгледа и работи при статичен
 * хостинг без сървърна конфигурация. Пълноценен рутер би се добавил, когато
 * изгледите станат повече.
 */
const routeFromHash = (): Route =>
  window.location.hash === '#demo' ? 'demo' : 'site';

export default function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const { quote, history, changeRatio } = useGoldPrice();

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // При смяна на изглед връщаме скрола горе — иначе демото се отваря
  // на позицията, до която е бил стигнал сайтът.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [route]);

  const openDemo = () => {
    window.location.hash = 'demo';
  };
  const openSite = () => {
    window.location.hash = '';
  };

  if (route === 'demo') {
    return (
      <>
        <Nav onOpenDemo={openDemo} />
        <DemoApp onBack={openSite} />
        <Footer />
      </>
    );
  }

  return (
    <>
      <Nav onOpenDemo={openDemo} />
      <main>
        <Hero quote={quote} onOpenDemo={openDemo} />
        <HowItWorks />
        <Features />
        <PriceSection quote={quote} history={history} changeRatio={changeRatio} />
        <Plans onOpenDemo={openDemo} />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
