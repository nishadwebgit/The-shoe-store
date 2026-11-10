import { Link } from 'react-router-dom';
import { brand } from '../../config/brand';
import { Logo } from './Logo';
import { Newsletter } from './Newsletter';

const currentYear = new Date().getFullYear();

const columns = [
  {
    title: 'Shop',
    links: [
      { label: 'New arrivals', to: '/shop?collection=new' },
      { label: 'Men', to: '/shop?gender=men' },
      { label: 'Women', to: '/shop?gender=women' },
      { label: 'Kids', to: '/shop?gender=kids' },
      { label: 'Running', to: '/shop?category=running' },
      { label: 'Sale', to: '/shop?sale=1' },
    ],
  },
  {
    title: 'Help',
    links: [
      { label: 'Contact us', to: '/contact' },
      { label: 'FAQs', to: '/help/faq' },
      { label: 'Shipping & delivery', to: '/help/shipping' },
      { label: 'Returns & exchanges', to: '/help/returns' },
      { label: 'Track an order', to: '/account/orders' },
    ],
  },
  {
    title: 'Nishoes',
    links: [
      { label: 'About us', to: '/about' },
      { label: 'Privacy policy', to: '/legal/privacy' },
      { label: 'Terms & conditions', to: '/legal/terms' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <Newsletter />
        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <Logo inverted />
            <p>{brand.shortDescription}</p>
            <address>
              {brand.address}
              <br />
              <a href={`tel:${brand.phone.replace(/\s/g, '')}`}>{brand.phone}</a>
              <br />
              <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>
              <br />
              {brand.hours}
            </address>
          </div>
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title} className="site-footer__col">
              <h2 className="site-footer__heading">{col.title}</h2>
              <ul>
                {col.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div className="site-footer__col">
            <h2 className="site-footer__heading">Follow</h2>
            <ul>
              {brand.social.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer">
                    {s.label}
                    <span className="visually-hidden"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="site-footer__base">
          <p>
            © {currentYear} {brand.legalName}. Prices in Sri Lankan rupees, including VAT.
          </p>
          <p>Demo storefront: no real orders or payments are processed.</p>
        </div>
      </div>
    </footer>
  );
}
