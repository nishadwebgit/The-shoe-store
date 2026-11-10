import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Footer } from '../components/layout/Footer';
import { Header } from '../components/layout/Header';
import { MiniCart } from '../components/layout/MiniCart';
import { Spinner } from '../components/ui/Feedback';
import { appConfig } from '../config/appConfig';
import { formatPrice } from '../utils/format';

function ScrollManager() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

export function AnnouncementBar() {
  return (
    <div className="announcement">
      <p className="container">
        Free island-wide delivery over {formatPrice(appConfig.shipping.freeShippingThreshold)}. Free size exchanges within 30 days.
      </p>
    </div>
  );
}

export function MainLayout() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <ScrollManager />
      <AnnouncementBar />
      <Header />
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<Spinner label="Loading page" />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <MiniCart />
    </>
  );
}
