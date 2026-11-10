import { useState } from 'react';
import { Heart, Menu, Search, ShoppingBag, User } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth, useCart, useWishlist } from '../../hooks/useStore';
import { Dialog } from '../ui/Dialog';
import { Logo } from './Logo';
import { SearchBox } from './SearchBox';

const primaryNav = [
  { label: 'New in', to: '/shop?collection=new' },
  { label: 'Men', to: '/shop?gender=men' },
  { label: 'Women', to: '/shop?gender=women' },
  { label: 'Kids', to: '/shop?gender=kids' },
  { label: 'Running', to: '/shop?category=running' },
  { label: 'Sale', to: '/shop?sale=1' },
];

function isNavActive(to: string, pathname: string, search: string): boolean {
  const [path, query] = to.split('?');
  return pathname === path && search.replace(/^\?/, '') === (query ?? '');
}

function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="count-badge" aria-hidden="true">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function Header() {
  const { totals, setDrawerOpen } = useCart();
  const { ids } = useWishlist();
  const { customer } = useAuth();
  const location = useLocation();
  // Panels are tied to the location they were opened on, so navigating closes them.
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [searchKey, setSearchKey] = useState<string | null>(null);
  const menuOpen = menuKey === location.key;
  const searchOpen = searchKey === location.key;
  const setMenuOpen = (open: boolean) => setMenuKey(open ? location.key : null);
  const setSearchOpen = (open: boolean) => setSearchKey(open ? location.key : null);

  const bagLabel = `Bag, ${totals.itemCount} ${totals.itemCount === 1 ? 'item' : 'items'}`;

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <button type="button" className="icon-button site-header__menu" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
          <Menu size={24} />
        </button>

        <Logo />

        <nav className="primary-nav" aria-label="Main">
          <ul>
            {primaryNav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={() => `primary-nav__link${isNavActive(item.to, location.pathname, location.search) ? ' is-active' : ''}${item.label === 'Sale' ? ' primary-nav__link--sale' : ''}`}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-header__search">
          <SearchBox />
        </div>

        <div className="site-header__actions">
          <button type="button" className="icon-button site-header__search-toggle" aria-label="Search" aria-expanded={searchOpen} onClick={() => setSearchOpen(!searchOpen)}>
            <Search size={22} />
          </button>
          <Link to={customer ? '/account' : '/sign-in'} className="icon-button" aria-label={customer ? `Account for ${customer.firstName}` : 'Sign in'}>
            <User size={22} />
          </Link>
          <Link to="/wishlist" className="icon-button" aria-label={`Wishlist, ${ids.length} ${ids.length === 1 ? 'item' : 'items'}`}>
            <Heart size={22} />
            <CountBadge count={ids.length} />
          </Link>
          <button type="button" className="icon-button" aria-label={bagLabel} onClick={() => setDrawerOpen(true)}>
            <ShoppingBag size={22} />
            <CountBadge count={totals.itemCount} />
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="site-header__mobile-search container">
          <SearchBox autoFocus onNavigate={() => setSearchOpen(false)} />
        </div>
      )}

      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" variant="drawer-left" size="sm">
        <nav aria-label="Mobile">
          <ul className="mobile-nav">
            {primaryNav.map((item) => (
              <li key={item.to}>
                <Link to={item.to}>{item.label}</Link>
              </li>
            ))}
          </ul>
          <ul className="mobile-nav mobile-nav--secondary">
            <li>
              <Link to="/shop?category=trail">Trail & hiking</Link>
            </li>
            <li>
              <Link to="/shop?category=sandals">Sandals</Link>
            </li>
            <li>
              <Link to="/shop?category=formal">Formal & loafers</Link>
            </li>
            <li>
              <Link to={customer ? '/account' : '/sign-in'}>{customer ? 'My account' : 'Sign in or register'}</Link>
            </li>
            <li>
              <Link to="/account/orders">Track an order</Link>
            </li>
            {customer?.role === 'admin' && (
              <li>
                <Link to="/admin">Owner Portal</Link>
              </li>
            )}
            <li>
              <Link to="/help/faq">Help & FAQs</Link>
            </li>
          </ul>
        </nav>
      </Dialog>
    </header>
  );
}
