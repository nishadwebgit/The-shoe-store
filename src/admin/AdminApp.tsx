import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Boxes,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PackagePlus,
  Settings,
  ShoppingBag,
  Store,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '../components/layout/Logo';
import { ButtonLink } from '../components/ui/Button';
import { EmptyState, Spinner } from '../components/ui/Feedback';
import { appConfig } from '../config/appConfig';
import { useAuth } from '../hooks/useStore';
import './admin.css';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const ProductEditorPage = lazy(() => import('./pages/ProductEditorPage'));
const ReceiveStockPage = lazy(() => import('./pages/ReceiveStockPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const StockHistoryPage = lazy(() => import('./pages/StockHistoryPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

const nav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Products', icon: ShoppingBag, end: true },
  { to: '/admin/products/new', label: 'Add new product', icon: PackagePlus, end: true },
  { to: '/admin/receive-stock', label: 'Receive new stock', icon: Truck },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { to: '/admin/stock-history', label: 'Stock history', icon: History },
  { to: '/admin/orders', label: 'Customer orders', icon: ClipboardList },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

/** Owner Portal entry: checks the signed-in account is an owner, then renders the portal layout and routes. */
export default function AdminApp() {
  return (
    <Routes>
      <Route element={<RequireOwner />}>
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/new" element={<ProductEditorPage />} />
          <Route path="products/:id" element={<ProductEditorPage />} />
          <Route path="receive-stock" element={<ReceiveStockPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="stock-history" element={<StockHistoryPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:orderNumber" element={<OrderDetailPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

function RequireOwner() {
  const { customer, ready } = useAuth();
  const location = useLocation();

  if (appConfig.useMockServices) {
    return (
      <div className="container page-pad">
        <EmptyState title="The Owner Portal needs the Nishoes API" action={<ButtonLink to="/">Back to the shop</ButtonLink>}>
          This build uses demo data. Run the API and set VITE_USE_MOCK_SERVICES=false to manage products, stock and orders.
        </EmptyState>
      </div>
    );
  }
  if (!ready) return <Spinner label="Checking your access" />;
  if (!customer) return <Navigate to={`/sign-in?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (customer.role !== 'admin') {
    return (
      <div className="container page-pad">
        <EmptyState title="This area is for store owners" action={<ButtonLink to="/">Back to the shop</ButtonLink>}>
          You’re signed in as {customer.email}, which isn’t an owner account. If you run the store, ask whoever manages the server to add your
          email to the owner list.
        </EmptyState>
      </div>
    );
  }
  return <Outlet />;
}

function AdminLayout() {
  const { customer, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastPath, setLastPath] = useState(location.pathname);
  if (location.pathname !== lastPath) {
    // Close the mobile menu after navigating.
    setLastPath(location.pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    document.documentElement.classList.add('admin-mode');
    return () => document.documentElement.classList.remove('admin-mode');
  }, []);

  return (
    <div className={`ap${menuOpen ? ' ap--menu-open' : ''}`}>
      <aside className="ap-sidebar" aria-label="Owner Portal">
        <div className="ap-sidebar__brand">
          <Link to="/admin" aria-label="Owner Portal home">
            <Logo />
          </Link>
          <span className="ap-sidebar__tag">Owner Portal</span>
          <button type="button" className="icon-button ap-sidebar__close" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X size={22} />
          </button>
        </div>
        <nav className="ap-nav">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `ap-nav__link${isActive ? ' is-active' : ''}`}>
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="ap-sidebar__foot">
          <Link to="/" className="ap-nav__link">
            <Store size={19} aria-hidden="true" />
            <span>View the shop</span>
          </Link>
          <button
            type="button"
            className="ap-nav__link"
            onClick={async () => {
              navigate('/');
              await signOut();
            }}
          >
            <LogOut size={19} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <div className="ap-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <div className="ap-main">
        <header className="ap-topbar">
          <button type="button" className="icon-button ap-topbar__menu" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <span className="ap-topbar__title">Owner Portal</span>
          <span className="ap-topbar__user">
            <span className="ap-avatar" aria-hidden="true">
              {customer?.firstName?.[0]}
              {customer?.lastName?.[0]}
            </span>
            <span className="ap-topbar__name">
              {customer?.firstName} {customer?.lastName}
            </span>
          </span>
        </header>
        <main className="ap-content" id="main">
          <Suspense fallback={<Spinner label="Loading" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
