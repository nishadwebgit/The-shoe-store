# Nishoes: shoe store frontend (React + TypeScript)

A frontend-only footwear e-commerce storefront for **Nishoes**, a fictional multi-brand Colombo shoe store. It runs entirely on local mock data
and browser `localStorage`, and is structured so the mock services can be swapped for an **ASP.NET Core Web API** later.

> Demo only. No real payments, orders or authentication. Passwords are never stored.

## Quick start

Requires Node.js 20.19+ or 22.12+ (Vite 8).

```bash
cd "C:\Nish.Projects\The Shoue Store"
npm install
npm run dev          # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Type-check (`tsc -b`) and build to `dist/` |
| `npm run preview` | Serve the production build locally (http://localhost:4173) |
| `npm run typecheck` | TypeScript project type-check only |
| `npm run lint` | Lint with oxlint (React, TypeScript and correctness rules) |
| `npm run check` | Type-check, lint and build in one go |

### Demo data to try

- **Account:** register on the site (stored by the API). In offline mock mode, use `demo@nishoes.lk` with any 8+ character password.
- **Discount codes:** `NISHOES10` (10% off), `WELCOME1500` (LKR 1,500 off over LKR 15,000), `FREESHIP` (free standard delivery).
- **Sold-out product:** Dr. Martens Tall Lace-Up Boot. Many products also have individual sold-out or low-stock sizes.
- Shop data lives in SQL Server; browser storage (keys start with `nishoes:v1:`) only holds the guest bag token, guest wishlist and preferences.

## Features

- **Home:** announcement bar, sticky header with live search suggestions, account/wishlist/bag counts, hero, "Shop in your size"
  picker (saves your size), categories, featured / new / best-seller / sale / recommended rails, monsoon promo, offer banner,
  brand list, service promises, newsletter, full footer.
- **Catalogue (`/shop`):** search, filters (size first, then gender, category, brand, colour, price, rating, availability) with
  live counts and disabled zero-result options, applied-filter chips, clear all, six sort options, load-more pagination,
  mobile filter drawer, empty states. All state lives in the URL, so refresh, share and Back all work.
- **Product page:** gallery with arrows and thumbnails, colour variants (in URL), button-style sizes with sold-out and
  low-stock markers, fit advice, size guide drawer, quantity capped at stock, add to bag, buy now, wishlist, delivery date
  estimates, description/specs/materials and care, reviews with fit summary, related and recently viewed.
- **Bag:** quantity changes within stock, remove, save for later, discount codes, free-shipping meter, totals, persistence.
- **Wishlist:** synced across cards, product page and wishlist page; persisted; move to bag with size selection.
- **Checkout:** 3 steps (details, delivery, review), guest-first, member prefill, validation with error summary, delivery
  methods with estimated dates (express limited by district), simulated payment, terms, order confirmation with order number.
- **Account:** register, sign in, profile (with saved shoe size), saved address, order history, order details, sign out.
- **Content:** About, Contact (validated form), FAQ, Shipping, Returns, Privacy, Terms, custom 404.

## Project structure

```
src/
  App.tsx                 Routes (less-visited pages are lazy-loaded)
  main.tsx                Entry: fonts, global styles
  config/                 brand.ts (store identity), appConfig.ts (API URL, currency, shipping, delivery, discount codes)
  types/                  Domain types / DTO contracts (Product, Variant, Cart, Order, Customer…)
  data/                   Mock catalogue, colourways, categories, size guide, FAQs, districts
  services/
    interfaces.ts         IProductService, ICartService, IWishlistService, IAuthService, IOrderService…
    index.ts              Service registry: chooses mock or HTTP implementations
    mock/                 localStorage-backed implementations used today
    http/                 fetch-based implementations for the future ASP.NET Core API
  features/catalogue/     Query/filter/sort/facet logic, URL state hook, filter panel, product helpers
  context/                React providers (cart, wishlist, auth, preferences, toasts)
  hooks/                  useCart/useWishlist/useAuth…, useAsync, useDocumentTitle
  components/             ui/ (Button, Dialog, FormField…), product/, cart/, layout/, order/
  layouts/                MainLayout (announcement, header, footer, mini-cart)
  pages/                  Home, Shop, Product, Cart, Wishlist, Checkout, Order confirmation, account/, info/
  utils/                  format (currency, dates), pricing (totals, shipping, delivery dates), validation, storage
  styles/                 tokens.css (design tokens), base, components, layout, pages
```

## Design system

Tokens live in `src/styles/tokens.css`: navy-ink `#13203a`, white and cool mist surfaces, and one accent, **Ceylon saffron**
`#f2a900` (used as a fill with ink text, never as text on white, to keep AA contrast). Typography is **Archivo** (self-hosted
variable font with a width axis): expanded heavy cuts for display, normal width for body. The store name, contact details and
social links are in `src/config/brand.ts`.

### Product photos and brands

The catalogue lists 39 products across 16 brands (Nike, Jordan, adidas, New Balance, Converse, Vans, PUMA, ASICS,
HOKA, Salomon, Reebok, Dr. Martens, Timberland, Birkenstock, Crocs and the store's own Nishoes label). Each colourway
uses a real photo of that shoe from [Unsplash](https://unsplash.com), free to use under the
[Unsplash License](https://unsplash.com/license). Photos are loaded from Unsplash's image CDN
(`images.unsplash.com`), which also produces the 4:3 crops, close-up gallery views and responsive sizes;
see `src/utils/images.ts`. Shoes whose photo shows no visible brand are listed under the Nishoes label rather than
guessing a brand. Product descriptions are written for this demo, and prices are illustrative.

Before using this commercially, note that the Unsplash License covers the photographs, not the brands shown in them.
Selling real brands needs authorised stock and, for product imagery, photos from the brand or your distributor.
`ProductImage` shows a placeholder if any image fails to load (for example, when offline).

## Backend (ASP.NET Core Web API)

The storefront runs against the **Nishoes API** in `shoe-store-api/` (ASP.NET Core, EF Core, SQL Server). See
`shoe-store-api/README.md` for setup, endpoints and Swagger. Start the API first (double-click
`shoe-store-api\dev-api.cmd`, or `dotnet run --project ShoeStore.Api` → http://localhost:5080/swagger), then the storefront.

How the frontend talks to it:

- `.env` sets `VITE_USE_MOCK_SERVICES=false`, `VITE_API_BASE_URL=/api/v1` and `VITE_API_PROXY_TARGET=http://localhost:5080`.
  The Vite dev server proxies `/api` to the API, so requests are same-origin and the refresh-token cookie works.
- `src/services/http/apiClient.ts` is the single fetch client: access token in memory only, one shared token refresh
  on 401, `X-Cart-Token` for guest bags, and API errors (ProblemDetails) shown as friendly messages.
- `src/services/http/httpServices.ts` implements every service interface against the API. `src/services/index.ts`
  picks mock or HTTP services, so pages and components didn't change.
- Signing in or registering merges the guest bag and wishlist into the account.
- Bag and checkout totals, delivery fees, dates and district rules come from the server; the order is priced by the API.
- The newsletter and contact forms stay local, because the API has no endpoints for them yet.

Run the storefront offline on mock data with `VITE_USE_MOCK_SERVICES=true` in `.env.local`
(demo account `demo@nishoes.lk`, any 8+ character password).

## Owner Portal

A store-management area at **`/admin`**. It covers the dashboard, products and photos, a "Receive new stock" wizard,
inventory with audited adjustments, stock history, customer orders (Pending → Confirmed → Processing → Ready for dispatch →
Shipped → Delivered), customers and settings. Only accounts whose email is listed in the API's `Admin:OwnerEmails` can
use it. See **[OWNER_PORTAL.md](OWNER_PORTAL.md)** for the owner's guide, database changes, API endpoints and design notes.
The portal needs the API; it isn't available with `VITE_USE_MOCK_SERVICES=true`.

## Accessibility and quality notes

Semantic landmarks, skip link, visible focus styles, native `<dialog>` for drawers and modals (focus trap, Escape), labelled
form fields with inline errors and an error summary, `aria-live` updates, reduced-motion support, and AA colour contrast.

## Known limitations

- The storefront needs the API running (or `VITE_USE_MOCK_SERVICES=true` for offline mock mode).
- Payment is simulated; no payment gateway.
- Newsletter sign-ups and contact messages are not sent to the API yet.
- Guest wishlists live in the browser until the shopper signs in.
- Reviews are generated samples; the rating breakdown is approximated from the average rating.
- Product photos load from Unsplash's CDN, so they need an internet connection (a placeholder shows when offline).
- Product details are written for the demo and may not match each manufacturer's exact specifications.
- Stock is reduced in the database when an order is placed (in mock mode, only in your browser).
