import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from './context/AppProviders';
import { MainLayout } from './layouts/MainLayout';
import { CartPage } from './pages/CartPage';
import { HomePage } from './pages/HomePage';
import { ProductPage } from './pages/ProductPage';
import { ShopPage } from './pages/ShopPage';
import { WishlistPage } from './pages/WishlistPage';

// Less-visited routes are code-split to keep the first load small.
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const PaymentReturnPage = lazy(() => import('./pages/PaymentPages').then((m) => ({ default: m.PaymentReturnPage })));
const PaymentCancelPage = lazy(() => import('./pages/PaymentPages').then((m) => ({ default: m.PaymentCancelPage })));
const OrderConfirmationPage = lazy(() => import('./pages/OrderConfirmationPage').then((m) => ({ default: m.OrderConfirmationPage })));
const auth = () => import('./pages/account/AuthPages');
const SignInPage = lazy(() => auth().then((m) => ({ default: m.SignInPage })));
const RegisterPage = lazy(() => auth().then((m) => ({ default: m.RegisterPage })));
const account = () => import('./pages/account/AccountPages');
const RequireAuth = lazy(() => account().then((m) => ({ default: m.RequireAuth })));
const AccountLayout = lazy(() => account().then((m) => ({ default: m.AccountLayout })));
const ProfilePage = lazy(() => account().then((m) => ({ default: m.ProfilePage })));
const OrdersPage = lazy(() => account().then((m) => ({ default: m.OrdersPage })));
const AccountOrderPage = lazy(() => account().then((m) => ({ default: m.AccountOrderPage })));
const info = () => import('./pages/info/InfoPages');
const AboutPage = lazy(() => info().then((m) => ({ default: m.AboutPage })));
const ContactPage = lazy(() => info().then((m) => ({ default: m.ContactPage })));
const FaqPage = lazy(() => info().then((m) => ({ default: m.FaqPage })));
const ShippingPage = lazy(() => info().then((m) => ({ default: m.ShippingPage })));
const ReturnsPage = lazy(() => info().then((m) => ({ default: m.ReturnsPage })));
const PrivacyPage = lazy(() => info().then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => info().then((m) => ({ default: m.TermsPage })));
const NotFoundPage = lazy(() => info().then((m) => ({ default: m.NotFoundPage })));
// The Owner Portal is a separate area with its own layout (and its own code chunk).
const AdminApp = lazy(() => import('./admin/AdminApp'));

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <Routes>
          <Route
            path="admin/*"
            element={
              <Suspense fallback={null}>
                <AdminApp />
              </Suspense>
            }
          />
          <Route element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="shop" element={<ShopPage />} />
            <Route path="product/:slug" element={<ProductPage />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="wishlist" element={<WishlistPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="order/:orderNumber" element={<OrderConfirmationPage />} />
            <Route path="payment/return" element={<PaymentReturnPage />} />
            <Route path="payment/cancel" element={<PaymentCancelPage />} />
            <Route path="sign-in" element={<SignInPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route element={<RequireAuth />}>
              <Route path="account" element={<AccountLayout />}>
                <Route index element={<ProfilePage />} />
                <Route path="orders" element={<OrdersPage />} />
                <Route path="orders/:orderNumber" element={<AccountOrderPage />} />
              </Route>
            </Route>
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="help/faq" element={<FaqPage />} />
            <Route path="help/shipping" element={<ShippingPage />} />
            <Route path="help/returns" element={<ReturnsPage />} />
            <Route path="legal/privacy" element={<PrivacyPage />} />
            <Route path="legal/terms" element={<TermsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AppProviders>
    </BrowserRouter>
  );
}
