import { CloudRain, PackageCheck, RotateCcw, Store, Truck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ProductRail } from '../components/product/ProductRail';
import { ButtonLink } from '../components/ui/Button';
import { ErrorState } from '../components/ui/Feedback';
import { appConfig } from '../config/appConfig';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { usePreferences } from '../hooks/useStore';
import { services } from '../services';
import { formatPrice } from '../utils/format';
import { sizedImage } from '../utils/images';

/** Product featured in the hero. Its name, price and photo are loaded from the catalogue (the API in API mode). */
const HERO_PRODUCT_SLUG = 'vans-old-skool-p017';
/** Product shown in the monsoon promo (photo loaded from the catalogue). */
const PROMO_PRODUCT_SLUG = 'salomon-xt-trail-shoe-p026';
const adultSizes = ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

function SizeBar() {
  const { preferredSize, setPreferredSize } = usePreferences();
  const navigate = useNavigate();
  const choose = (size: string) => {
    setPreferredSize(size);
    navigate(`/shop?size=${size}&stock=1`);
  };
  return (
    <section className="size-bar" aria-labelledby="size-bar-title">
      <div className="container size-bar__inner">
        <div className="size-bar__copy">
          <h2 id="size-bar-title" className="size-bar__title">
            Shop in your size
          </h2>
          <p>Pick your UK size once. We’ll only show shoes we can send you, and preselect it on every product page.</p>
        </div>
        <div className="size-bar__sizes" role="group" aria-label="Choose your UK size">
          {adultSizes.map((s) => (
            <button key={s} type="button" className={`size-bar__size${preferredSize === s ? ' is-selected' : ''}`} onClick={() => choose(s)} aria-pressed={preferredSize === s}>
              {s}
            </button>
          ))}
          <Link to="/shop?gender=kids" className="size-bar__kids">
            Kids’ sizes
          </Link>
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  useDocumentTitle();
  const { recentlyViewed } = usePreferences();
  const featured = useAsync(() => services.products.getCollection('featured', 4), []);
  const newIn = useAsync(() => services.products.getCollection('new', 4), []);
  const best = useAsync(() => services.products.getCollection('best-sellers', 4), []);
  const sale = useAsync(() => services.products.getCollection('sale', 4), []);
  const recs = useAsync(() => services.products.getRecommendations(recentlyViewed.slice(0, 4), 4), [recentlyViewed.slice(0, 4).join(',')]);
  const brands = useAsync(() => services.products.getBrands(), []);
  const categories = useAsync(() => services.products.getCategories(), []);
  const hero = useAsync(() => services.products.getProductBySlug(HERO_PRODUCT_SLUG), []);
  const heroProduct = hero.data;
  const promo = useAsync(() => services.products.getProductBySlug(PROMO_PRODUCT_SLUG), []);

  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero__inner">
          <div className="hero__copy">
            <h1 id="hero-title" className="hero__title display">
              Shoes for the way Sri Lanka moves
            </h1>
            <p className="hero__lede">
              Nike, adidas, New Balance, ASICS, Vans and more, plus our own Colombo label. Delivered to all 25 districts, with free size exchanges.
            </p>
            <div className="hero__actions">
              <ButtonLink to="/shop?collection=new" variant="accent" size="lg">
                Shop new arrivals
              </ButtonLink>
              <ButtonLink to="/shop?category=running" variant="inverse" size="lg">
                Shop running
              </ButtonLink>
            </div>
          </div>
          <figure className="hero__figure">
            {heroProduct ? (
              <>
                <img
                  src={sizedImage(heroProduct.colours[0].images[0], 1000)}
                  alt={`${heroProduct.name} in ${heroProduct.colours[0].name}`}
                  width={800}
                  height={600}
                />
                <figcaption>
                  <Link to={`/product/${heroProduct.slug}?colour=${heroProduct.colours[0].id}`} className="hero__tag">
                    <span>{heroProduct.name}</span>
                    <span className="hero__tag-price">{formatPrice(heroProduct.price)}</span>
                  </Link>
                </figcaption>
              </>
            ) : (
              <span className="skeleton hero__placeholder" aria-hidden="true" />
            )}
          </figure>
        </div>
      </section>

      <SizeBar />

      <div className="container home__sections">
        <section aria-labelledby="cat-title">
          <div className="rail__head">
            <h2 className="section-title" id="cat-title">
              Shop by category
            </h2>
            <Link to="/shop" className="text-link">
              All shoes
            </Link>
          </div>
          {categories.error && <ErrorState message={categories.error} onRetry={categories.reload} />}
          <ul className="category-grid">
            {!categories.data &&
              categories.loading &&
              Array.from({ length: 8 }, (_, i) => (
                <li key={i} aria-hidden="true">
                  <span className="skeleton category-tile__placeholder" />
                </li>
              ))}
            {categories.data?.map((c) => (
              <li key={c.id}>
                <Link to={`/shop?${new URLSearchParams(c.query).toString()}`} className="category-tile">
                  <img src={c.image} alt="" loading="lazy" />
                  <span className="category-tile__label">{c.label}</span>
                  <span className="category-tile__desc">{c.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <ProductRail id="featured" title="Featured" description="The pairs our staff are wearing this month." products={featured.data} loading={featured.loading} error={featured.error} onRetry={featured.reload} viewAll={{ to: '/shop?collection=featured', label: 'See all featured' }} />

        <section className="promo" aria-labelledby="promo-title">
          <div className="promo__copy">
            <p className="promo__kicker">
              <CloudRain size={18} aria-hidden="true" /> Northeast monsoon, November to February
            </p>
            <h2 id="promo-title" className="promo__title display">
              Monsoon season, sorted
            </h2>
            <p>Water-resistant trail shoes, quick-dry sandals and grippy outsoles for wet tiles and flooded crossings.</p>
            <div className="promo__actions">
              <ButtonLink to="/shop?category=trail" variant="primary">
                Shop trail
              </ButtonLink>
              <ButtonLink to="/shop?category=sandals" variant="secondary">
                Shop sandals
              </ButtonLink>
            </div>
          </div>
          {promo.data ? (
            <img className="promo__img" src={sizedImage(promo.data.colours[0].images[0], 900)} alt={`${promo.data.name} on a muddy trail`} />
          ) : (
            <span className="skeleton promo__img hero__placeholder" aria-hidden="true" />
          )}
        </section>

        <ProductRail id="new" title="New arrivals" products={newIn.data} loading={newIn.loading} error={newIn.error} onRetry={newIn.reload} viewAll={{ to: '/shop?collection=new', label: 'See all new' }} />

        <ProductRail id="best" title="Best sellers" description="Most bought in Sri Lanka over the last 90 days." products={best.data} loading={best.loading} error={best.error} onRetry={best.reload} viewAll={{ to: '/shop?sort=popular', label: 'See what’s trending' }} />

        <section className="offer" aria-labelledby="offer-title">
          <div>
            <h2 id="offer-title" className="offer__title">
              10% off your first pair
            </h2>
            <p>
              Use code <strong className="offer__code">NISHOES10</strong> at checkout. Plus free standard delivery on orders over {formatPrice(appConfig.shipping.freeShippingThreshold)}.
            </p>
          </div>
          <ButtonLink to="/shop?sale=1" variant="primary">
            Shop the sale
          </ButtonLink>
        </section>

        <ProductRail id="sale" title="On sale now" products={sale.data} loading={sale.loading} error={sale.error} onRetry={sale.reload} viewAll={{ to: '/shop?sale=1', label: 'See all sale' }} />

        <ProductRail id="recs" title={recentlyViewed.length ? 'Recommended for you' : 'Top rated'} description={recentlyViewed.length ? 'Based on the shoes you’ve looked at.' : 'Our highest-rated shoes right now.'} products={recs.data} loading={recs.loading} error={recs.error} />

        {brands.data && (
          <section aria-labelledby="brands-title" className="brands">
            <h2 className="section-title" id="brands-title">
              Brands we stock
            </h2>
            <ul className="brands__list">
              {brands.data.map((b) => (
                <li key={b}>
                  <Link to={`/shop?brand=${encodeURIComponent(b)}`}>{b}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <ul className="promises" aria-label="Why shop with us">
          <li>
            <Truck size={24} aria-hidden="true" />
            <strong>Island-wide delivery</strong>
            <span>Free over {formatPrice(appConfig.shipping.freeShippingThreshold)}</span>
          </li>
          <li>
            <RotateCcw size={24} aria-hidden="true" />
            <strong>Free size exchanges</strong>
            <span>Within 30 days</span>
          </li>
          <li>
            <Store size={24} aria-hidden="true" />
            <strong>Collect in Colombo</strong>
            <span>Ward Place, Colombo 07</span>
          </li>
          <li>
            <PackageCheck size={24} aria-hidden="true" />
            <strong>Express 1–2 days</strong>
            <span>Colombo, Gampaha, Kalutara</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
