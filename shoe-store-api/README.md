# Nishoes API (shoe-store-api)

ASP.NET Core Web API for the **Nishoes** React storefront in the parent folder. It replaces the frontend's mock data
and simulated operations with a SQL Server database: catalogue, inventory, guest and customer carts, wishlists,
JWT authentication, checkout with server-side pricing, and order history.

```
C:\Nish.Projects\The Shoue Store
├── src/ ...                  React + TypeScript storefront (Vite)
├── package.json
└── shoe-store-api/           ← this solution
    ├── ShoeStore.Api/            Controllers, middleware, auth, Swagger, startup
    ├── ShoeStore.Application/    DTOs, services (use cases), validation, pricing rules
    ├── ShoeStore.Domain/         Entities and enums
    ├── ShoeStore.Infrastructure/ EF Core DbContext, configurations, migrations, seeding, password hashing
    ├── ShoeStore.Tests/          xUnit tests (pricing and delivery rules)
    ├── dev-api.cmd / dev-api.ps1 One-click dev runner (build, test, migrate, run, rebuild on change)
    └── ShoeStore.sln
```

## Technology

| Area | Choice |
| --- | --- |
| Framework | ASP.NET Core Web API, **.NET 9** (the SDK installed on this machine; see *Upgrading to .NET 10*) |
| Data | Entity Framework Core 9 + Microsoft SQL Server, code-first migrations |
| Auth | JWT Bearer access tokens (15 min) + rotating refresh tokens in an HttpOnly cookie |
| Passwords | ASP.NET Core Identity `PasswordHasher` (PBKDF2, per-password salt) |
| Validation | FluentValidation, returned as RFC 7807 `ValidationProblemDetails` |
| Docs | Swashbuckle (Swagger UI) with a Bearer "Authorize" button |
| Logging | Microsoft `ILogger` (structured), request-logging middleware |
| Tests | xUnit |

Dependencies are deliberately few: no AutoMapper (hand-written mapping in `Application/Services/Mapping.cs`),
no repository layer on top of EF Core's `DbContext`.

## Architecture

- **Domain**: entities (`Product`, `ProductVariant`, `Cart`, `Order`, …) and enums. No framework dependencies.
- **Application**: one service per use case area (`ProductService`, `CartService`, `CheckoutService`, `CustomerServices`,
  `OrderAndShippingServices`), DTOs that mirror the React app's TypeScript types (`src/types/index.ts`), validators, and
  the pricing rules (`Pricing.cs`). Business logic lives here, never in controllers.
- **Infrastructure**: `AppDbContext`, Fluent API configurations, migrations, the idempotent `DbSeeder`, password hashing.
- **Api**: thin controllers, JWT and token services, global exception handler (turns application exceptions into
  ProblemDetails with safe messages), rate limiting, CORS, Swagger, health check (`/health`).

### Database (entity overview)

```
Brand 1─* Product *─* Category            (ProductCategory join)
Product 1─* ProductColour 1─* ProductImage
Product 1─* ProductVariant *─1 Size        (variant = colour + size, holds StockQuantity + RowVersion)
Product 1─* ProductHighlight | ProductSpecification | ProductReview
Customer 1─* CustomerAddress | RefreshToken
Customer 1─1 Cart 1─* CartItem *─1 ProductVariant      (guest carts use an AnonymousToken instead of a customer)
Customer 1─1 Wishlist 1─* WishlistItem *─1 Product     (unique per customer + product)
Customer 1─* Order 1─* OrderItem                        (OrderItem snapshots name, brand, colour, size, image, unit price)
Order 1─1 OrderAddress, Order 1─* OrderStatusHistory
Coupon, ShippingMethod                                  (lookup tables used by pricing)
```

- Money is `decimal(18,2)`; timestamps are UTC (`CreatedUtc` / `ModifiedUtc` on auditable entities).
- Orders keep their own copies of product details and prices, so later catalogue changes never alter history.
  Deleting a product or customer never cascades into orders (`Restrict` / `SetNull`).
- Indexes cover slugs, product codes, SKUs, brand/category lookups, order numbers, customer email and cart tokens.
- Inventory is per variant. Checkout reserves stock with a conditional `UPDATE … WHERE StockQuantity >= @qty` inside a
  transaction, so two shoppers can never buy the last pair; the loser gets a 409 with a clear message.
  Coupon usage limits are enforced the same way.

## Prerequisites

- .NET SDK 9.0 or newer (`dotnet --list-sdks`)
- SQL Server (this machine has SQL Server 2022, default instance `MSSQLSERVER`) or LocalDB
- Node.js 20.19+ / 22.12+ for the storefront

## Quick start (Windows)

**Easiest:** double-click `dev-api.cmd`. It installs the `dotnet-ef` local tool, creates a development JWT key in user
secrets, builds, runs the tests, creates or applies migrations, seeds the catalogue and starts the API at
**http://localhost:5080/swagger**. It rebuilds and restarts when you change source files. Logs go to `logs\`.

**Manually:**

```powershell
cd "C:\Nish.Projects\The Shoue Store\shoe-store-api"
dotnet tool restore                                        # installs dotnet-ef (local tool)
dotnet user-secrets set "Jwt:SigningKey" "<a random string of 48+ characters>" --project ShoeStore.Api
dotnet restore
dotnet build
dotnet test
dotnet ef database update --project ShoeStore.Infrastructure --startup-project ShoeStore.Api
dotnet run --project ShoeStore.Api --launch-profile http   # http://localhost:5080/swagger
```

In Development, `Database:MigrateOnStartup` and `Database:SeedOnStartup` are `true`, so `dotnet run` alone also
creates the database, applies migrations and seeds it.

Then start the storefront from the parent folder:

```powershell
cd "C:\Nish.Projects\The Shoue Store"
npm install          # first time only
npm run dev          # or double-click start-dev.cmd → http://localhost:5180
```

## Configuration

| Setting | Where | Notes |
| --- | --- | --- |
| `ConnectionStrings:DefaultConnection` | `appsettings.Development.json` | `Server=localhost;Database=NishoesStore;Trusted_Connection=True;TrustServerCertificate=True` (Windows auth, no password). For LocalDB use `Server=(localdb)\MSSQLLocalDB;…`. Production: environment variable `ConnectionStrings__DefaultConnection` or a secret store. |
| `Jwt:SigningKey` | user secrets (dev) / environment (prod) | Required outside Development (32+ characters). Never commit it. |
| `Jwt:Issuer`, `Jwt:Audience` | `appsettings.json` | `nishoes-api` / `nishoes-web` |
| `Auth:*` | `appsettings.json` | Access token 15 min, refresh 14 days, lockout after 5 failed logins for 15 min |
| `Pricing:*` | `appsettings.json` | Currency LKR, free-shipping threshold LKR 25,000, max 10 per line |
| `Cors:AllowedOrigins` | `appsettings.Development.json` | `http://localhost:5180`, `http://localhost:5173`. No wildcard; credentials allowed only for these. |
| `Database:MigrateOnStartup`, `SeedOnStartup` | per environment | `true` in Development, `false` by default elsewhere |

### Migrations

```powershell
# create a migration after changing entities or configurations
dotnet ef migrations add <Name> --project ShoeStore.Infrastructure --startup-project ShoeStore.Api --output-dir Persistence/Migrations
# apply
dotnet ef database update --project ShoeStore.Infrastructure --startup-project ShoeStore.Api
# drop the dev database and start again (re-seeds on next run)
dotnet ef database drop --project ShoeStore.Infrastructure --startup-project ShoeStore.Api
```

### Seed data

`DbSeeder` loads `Infrastructure/Seed/catalog-seed.json` (the same 39 products, 16 brands, 8 categories, colours,
Unsplash image URLs and 328 stocked variants as the storefront) plus sizes, sample reviews, shipping methods
(standard LKR 450, express LKR 1,200 for Colombo/Gampaha/Kalutara, store pickup free) and coupons (`NISHOES10`,
`WELCOME1500`, `FREESHIP`). It inserts only what is missing, so restarts never create duplicates. No customer or admin
accounts or passwords are seeded; register through the storefront or Swagger.

## API

Base path `/api/v1`. JSON is camelCase; errors are RFC 7807 ProblemDetails (`title`, `detail`, `status`, `code`, and
`errors` for validation). 🔒 = requires a Bearer token.

| Module | Endpoints |
| --- | --- |
| Authentication | `POST auth/register`, `POST auth/login`, `POST auth/refresh` (cookie), `POST auth/logout`, `POST auth/change-password` 🔒 |
| Customers 🔒 | `GET/PUT customers/profile`, `GET/POST customers/addresses`, `PUT/DELETE customers/addresses/{id}`, `PUT customers/addresses/{id}/default` |
| Products | `GET products` (search, filters, sort, paging, facets), `GET products/search`, `GET products/featured`, `/new-arrivals`, `/best-sellers`, `/sale`, `/recommendations`, `GET products/{idOrSlug}`, `/related`, `/reviews`, `/variants`, `/stock?colour=&size=` |
| Categories & brands | `GET categories`, `GET categories/{code}`, `GET categories/{code}/products`, `GET brands`, `GET brands/{idOrSlug}`, `GET brands/{idOrSlug}/products` |
| Inventory | `GET sizes`, `POST inventory/check` |
| Cart | `GET cart`, `DELETE cart`, `POST cart/items`, `PUT/DELETE cart/items/{sku}`, `POST/DELETE cart/coupon`, `POST cart/merge` 🔒 |
| Wishlist 🔒 | `GET wishlist`, `DELETE wishlist`, `POST wishlist/items`, `DELETE wishlist/items/{productId}`, `POST wishlist/merge` |
| Coupons & shipping | `GET coupons/{code}?subtotal=`, `GET shipping-methods?subtotal=&district=&couponCode=` |
| Checkout | `POST checkout/quote`, `POST checkout` |
| Orders | `GET orders` 🔒 (paged), `GET orders/{orderNumber}`, `/status`, `/items` (owner only; guests add `?email=`) |

Product filters (`GET /products`): `search`, `gender`, `category`, `brand`, `size`, `colour` (comma-separated lists),
`minPrice`, `maxPrice`, `minRating`, `inStock`, `onSale`, `collection` (`new`, `best-sellers`, `featured`),
`sort` (`featured`, `newest`, `popular`, `price-asc`, `price-desc`, `rating`), `ids`, `page`, `pageSize` (max 48).
Paged responses contain `items`, `page`, `pageSize`, `totalCount`, `totalPages` (and `facets` for products).

### Swagger

Open **http://localhost:5080/swagger** (Development only). Endpoints are grouped by module with summaries.

1. Call `POST /api/v1/auth/register` (or `login`) and copy `accessToken` from the response.
2. Click **Authorize**, paste the token into **Bearer**, and call protected endpoints.
3. Guest cart calls return a `cartToken`; paste it into **CartToken** (`X-Cart-Token` header) to keep using that cart.

## Authentication and security

- Access token: HS256 JWT, 15 minutes, validated for issuer, audience, signature and lifetime (30 s clock skew).
- Refresh token: random 64 bytes, stored only as a SHA-256 hash, rotated on every refresh, revoked on logout and
  password change. Sent as an `HttpOnly`, `SameSite=Strict` cookie scoped to `/api/v1/auth` (`Secure` outside dev HTTP).
- Customers can only reach their own cart, wishlist, addresses and orders; ids come from the token, never the request.
  Another customer's order returns 404 (no information leak). Guest orders require the checkout email.
- Owner Portal endpoints require an owner account (role re-checked in the database on every request).
- Lockout after 5 failed logins; rate limits on auth (10/min/IP) and checkout (20/min/IP).
- Checkout ignores any client prices or totals. The server re-prices from the catalogue, validates the coupon,
  delivery method and district, reserves stock atomically and records the order in one transaction.
- The global exception handler never returns stack traces, SQL or configuration; logs omit passwords and tokens.
- **Card payments use PayHere hosted checkout** (see *Payments* below). Card details are typed on PayHere's page and
  never reach this API. The merchant secret lives only in user secrets / environment variables.

## Payments (PayHere)

Flow:

1. `POST /api/v1/checkout` with `paymentMethod: "payhere"` creates the order with `paymentStatus: "pending"` and
   reserves stock for `PayHere:PaymentWindowMinutes` (default 30).
2. `POST /api/v1/payments/payhere/checkout` `{ orderNumber, email? }` returns PayHere's checkout URL and the form fields,
   including the server-computed `hash` = `UPPER(MD5(merchant_id + order_id + amount + currency + UPPER(MD5(secret))))`.
   The storefront posts the form; the shopper pays on PayHere's page.
3. PayHere calls `POST /api/v1/payments/payhere/notify` (form-encoded). The API verifies `md5sig`, the merchant id,
   amount and currency, stores a `PaymentTransactions` row (no card data) and moves the order to `paid` (status 2),
   `failed` (-2, retry allowed), keeps it pending (0 / -1) or marks it `refunded` (-3 chargeback). Repeats are harmless.
4. The shopper returns to `/payment/return?order=…`, which polls the order until the notification has arrived.
   Arriving on the return page never marks anything paid.
5. `PaymentExpiryWorker` runs every minute: unpaid card orders past their window are cancelled, their stock and
   coupon use are released. A payment that arrives later re-reserves stock if possible, otherwise the order is flagged
   for a refund in its history.

`GET /api/v1/payments/options` tells the storefront which methods to show. `paymentMethod: "simulated"` (demo, no money)
is only accepted when `Payments:AllowSimulated` is true (Development only).

Configuration (never put the secret in appsettings or source control):

```powershell
cd shoe-store-api
dotnet user-secrets set "PayHere:MerchantId" "<sandbox merchant id>" --project ShoeStore.Api
dotnet user-secrets set "PayHere:MerchantSecret" "<sandbox merchant secret for domain localhost>" --project ShoeStore.Api
dotnet user-secrets set "PayHere:NotifyUrl" "https://<your-tunnel>/api/v1/payments/payhere/notify" --project ShoeStore.Api
```

| Key | Default | Notes |
| --- | --- | --- |
| `PayHere:UseSandbox` | `true` | `false` sends shoppers to the live gateway. Use live credentials only in production. |
| `PayHere:NotifyUrl` | — | Must be publicly reachable. PayHere can't call `localhost`. |
| `PayHere:FrontendBaseUrl` | `http://localhost:5180` | Used for the return and cancel URLs. |
| `PayHere:PaymentWindowMinutes` | `30` | How long stock stays reserved for an unpaid card order. |
| `Payments:AllowSimulated` | `false` (`true` in Development) | Enables demo orders. |

Local testing needs a tunnel so PayHere can reach the notify endpoint, for example
`cloudflared tunnel --url http://localhost:5080` (prints an `https://….trycloudflare.com` URL; it changes on every run,
so update `PayHere:NotifyUrl` and restart the API). Without a tunnel the payment succeeds at PayHere but the order stays
`pending` and is cancelled when the window ends. Sandbox test cards: Visa `4916217501611292`, Mastercard
`5307732125531191`, Amex `346781005510225`, any future expiry date and any CVV.

Going live: create a live PayHere account, add your real domain under *Domains & Credentials*, put the live merchant id
and secret in your production secret store, set `UseSandbox=false`, `NotifyUrl` to your HTTPS API and
`FrontendBaseUrl` to your site, and set `Payments:AllowSimulated=false`.

## Owner Portal (admin API)

`/api/v1/admin/*` serves the React Owner Portal: products and images, stock receipts, inventory adjustments and the stock
ledger, suppliers, settings, order fulfilment and customers. Every endpoint uses the `OwnerPortal` policy: the Admin role in
the JWT, plus a check on each request that the account is still an admin in the database.

| Setting | Default | Notes |
| --- | --- | --- |
| `Admin:OwnerEmails` | `[]` | Emails of owner accounts. Matching accounts get the Admin role at startup and at sign-in; any other Admin is demoted. No passwords in configuration. |
| `Storage:LocalRootPath` | `uploads` | Folder for uploaded product images (relative to `ShoeStore.Api`). Ignored by git. |
| `Storage:PublicBaseUrl` | `/media` | URL path the images are served from (or a CDN base URL with a cloud `IFileStorage`). |
| `Storage:MaxImageBytes` | `5242880` | Largest upload (5 MB). |

Every change to `ProductVariants.StockQuantity` goes through `InventoryLedger`, which does one conditional UPDATE and
writes one `InventoryTransactions` row. That covers checkout, payment expiry, cancellations, receipts and adjustments.
See [../OWNER_PORTAL.md](../OWNER_PORTAL.md) for the full endpoint list, tables and rules.

## Frontend integration

The storefront's service layer (`src/services`) has mock and HTTP implementations behind the same interfaces;
`src/services/index.ts` chooses one. Changes made to connect it:

- `.env`: `VITE_USE_MOCK_SERVICES=false`, `VITE_API_BASE_URL=/api/v1`, `VITE_API_PROXY_TARGET=http://localhost:5080`.
- `vite.config.ts`: dev-server proxy for `/api`, so calls are same-origin (no CORS preflight; the refresh cookie works).
- `src/services/http/apiClient.ts`: fetch client. Access token held in memory only, one shared refresh on 401,
  `X-Cart-Token` for guests, ProblemDetails → friendly messages.
- `src/services/http/httpServices.ts`: products, inventory, cart, wishlist, auth/customers, checkout and orders.
- On sign-in or registration the guest bag (`cart/merge`) and local wishlist (`wishlist/merge`) move to the account.
- Bag and checkout totals, delivery fees, delivery dates and express availability come from the API
  (`checkout/quote`, `shipping-methods`). Order placement sends only the shopper's choices.
- Newsletter and contact forms remain local; the API has no endpoints for them yet.
- Set `VITE_USE_MOCK_SERVICES=true` in `.env.local` to run the storefront offline on mock data.

## Verification performed

On this machine (logs in `logs\`):

- `dotnet build`: succeeded (0 errors, 2 warnings). `dotnet test`: 21 passed, 0 failed.
- `dotnet ef migrations add InitialCreate` and migration on startup against SQL Server 2022: applied; seeded
  39 products and 328 variants. `dotnet ef migrations has-pending-model-changes`: none.
- Swagger document served with 54 operations.

Against the running API through the storefront at http://localhost:5180 (browser-driven):

- Catalogue from SQL Server (39 products), filters, product pages, guest bag stored server-side.
- Invalid and valid coupons (`NISHOES10` → 10% calculated by the server), delivery options per district.
- Registration (bag and wishlist merged), checkout as a member: order created, stock reduced 9 → 8, bag emptied.
- Order history; unauthenticated or wrong-email access to an order → 404; `/orders`, `/wishlist` without a token → 401.
- Wrong password, weak password and duplicate email messages; session restored after page reload via the refresh cookie;
  sign-out revokes the refresh token (refresh → 401); profile update saved.
- Quantity limited by stock (409 message from the API), guest checkout with express delivery, guest confirmation after reload.

## Known limitations

- No admin endpoints yet for managing products, stock or order status (the `Admin` role and `OrderStatusHistory` are in place).
- Newsletter and contact messages are not stored by the API.
- Tests cover pricing and delivery rules; there are no automated integration tests against a test database yet.
- Targets .NET 9 because that is the installed SDK.

## Upgrading to .NET 10 LTS

Install the .NET 10 SDK, set `<TargetFramework>net10.0</TargetFramework>` in `Directory.Build.props`, update the
`Microsoft.*` package versions from `9.0.*` to `10.0.*` and `dotnet-ef` in `.config/dotnet-tools.json`, then build and test.

## Next steps

- **Payments:** add PayHere's Retrieval API (OAuth app credentials) so the return page can confirm a payment even if a
  notification is lost, an admin view for orders flagged for refund, and email receipts.
- **Production:** HTTPS only, secrets in Azure Key Vault or environment variables, `MigrateOnStartup=false` with
  migrations applied by the deployment pipeline (`dotnet ef migrations bundle`), restricted CORS origins, a reverse proxy
  that forwards client IPs for rate limiting, centralised logs (e.g. Application Insights), and database backups.
