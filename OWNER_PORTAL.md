# Nishoes Owner Portal

The Owner Portal is the store-management area of Nishoes, at **`/admin`** (for example http://localhost:5180/admin).
From it the owner receives new stock, maintains products and photos, manages inventory and processes customer orders.

## 1. Getting access

Owner accounts are ordinary customer accounts whose email address is listed in the API configuration:

```json
"Admin": { "OwnerEmails": [ "owner@yourstore.lk" ] }
```

1. Add the email to `Admin:OwnerEmails`. In development use `shoe-store-api/ShoeStore.Api/appsettings.Development.json`; in production use an environment variable such as `Admin__OwnerEmails__0`.
2. Register with that email on the shop's normal **Create account** page (or use an existing account).
3. Sign in. The account gets the owner (Admin) role automatically, and **Owner Portal** appears in the account menu.

No passwords are stored in configuration. Removing an email takes effect immediately: the API re-checks the role in the
database on every Owner Portal request, and the account returns to a normal customer the next time the API starts or the
person signs in. Customers who open `/admin` see a "This area is for store owners" message, and the admin APIs answer
`403`. Signed-out callers get `401`.

## 2. Everyday use (for the store owner)

| Task | Where | How |
| --- | --- | --- |
| See how the shop is doing | **Dashboard** | Product, stock and order totals, 14-day sales chart, low and out-of-stock sizes, new deliveries, latest stock changes and orders. |
| A delivery arrives | **Receive new stock** | 1 Find the product (or create it). 2 Enter supplier, invoice number, date, cost and optional new selling price. 3 Type the pairs received per colour and size; the current stock is shown under each box. 4 Add or reorder photos. 5 Check the summary and **Confirm**. Quantities are **added** to existing stock (10 + 15 = 25). |
| Add a product without stock yet | **Add new product** | Details, prices, categories, colours, sizes and photos. Sizes start at 0 pairs, so the product shows as sold out until you receive stock. |
| Change a product | **Products** → name | Edit details, prices, colours, sizes and photos. Toggle **Active** to hide it from the shop, and use the star to feature it on the home page. |
| Photos | Product form or wizard step 4 | Drag photos in or click **Add images** (JPG, PNG or WebP, up to 5 MB, 12 per colour). Use the arrows to reorder, the star to make a photo the primary one, and the bin to remove it. |
| Fix a stock count | **Inventory** → **Adjust** | Choose Damaged, Lost, Customer return or Count correction, the number of pairs and a reason (required). Stock can't go below zero. |
| Low-stock alerts | **Inventory** ("alert at ≤ n") or **Settings** | Set the store-wide threshold, or a custom one for a single size. |
| Who changed what | **Stock history** | Every stock movement (receipts, sales, cancellations, adjustments) with before → after, the person and the reason. The **Stock receipts** tab lists deliveries. |
| Process orders | **Customer orders** → order | Use the buttons to move the order on: Confirm → Start processing → Ready for dispatch → Mark as shipped (add the courier and tracking number as a note) → Mark as delivered. **Cancel order** needs a reason and puts the items back in stock. |
| Customers | **Customers** | Registered customers, their order count and how much they've spent. |
| Suppliers | **Settings** → Suppliers | Suppliers are added automatically when you type a new name while receiving stock; you can also add and edit them here. |

**Payment and fulfilment are separate.** Changing an order's status never marks it as paid. Card orders become **Paid**
only when PayHere confirms the payment. An unpaid order can be confirmed and processed, but it can't be moved to
**Ready for dispatch** (or beyond) until it has been paid. If an order the store cancelled is paid later, it stays
cancelled and its history says "Refund it in the PayHere portal".

## 3. How stock stays accurate

* Stock is kept per **variant** (one product + colour + size, i.e. one SKU) in `ProductVariants.StockQuantity`.
* All stock changes go through one place, `InventoryLedger`. Each change is a single conditional SQL `UPDATE`
  (`… WHERE StockQuantity + change >= 0`), so two people can't oversell the last pair and stock can't go negative. A check
  constraint on the table enforces the same rule. Each change also writes one `InventoryTransactions` row.
* **Checkout** reserves stock once (a `Sale` transaction). Moving an order through fulfilment never touches stock again,
  so nothing is ever deducted twice.
* **Cancelling** an open order, or the 30-minute expiry of an unpaid card order, returns the items (`Released`).
* **Receiving stock** creates a `StockReceipt` with one line per variant, adds the quantities and writes a `Received`
  transaction per line, all in one database transaction. Each submission carries a `clientRequestId`. Sending it again,
  even twice at the same moment, returns the original receipt instead of adding the stock twice. The same supplier
  invoice number can't be recorded twice.
* Product edits never change stock. Sizes and colours that still hold stock can't be removed until they're adjusted to 0.
* Products that have been ordered, or that still have stock, can't be deleted; deactivate them instead. Order history and
  stock history keep their own copies of product names, SKUs and sizes, so deleting a product never breaks them.

## 4. Database changes

Migration `20261109165757_Update20261109222749` only **adds** tables, columns and indexes; it drops or rewrites nothing.

| Table / column | Purpose |
| --- | --- |
| `Suppliers` | Supplier name (unique), contact, phone, email, notes, active flag. |
| `StockReceipts` | One delivery: number (`GRN-yyMM-0001`), `ClientRequestId` (unique), supplier and invoice (unique per supplier), received date, product snapshot, unit cost, selling price, notes, total quantity, who recorded it. |
| `StockReceiptItems` | Per-variant lines: SKU/colour/size snapshot, quantity, stock before and after. |
| `InventoryTransactions` | Stock ledger: variant (+ snapshot), type (`Received`, `Sale`, `Released`, `Correction`, `Damaged`, `Lost`, `Returned`), change, before, after, reason, reference (order or receipt number), who and when. Check constraints keep `after = before + change` and both ≥ 0. |
| `StoreSettings` | Single row: store-wide low-stock threshold (default 3) and when the demo catalogue was seeded. |
| `AdminAuditLogs` | Owner actions: product created/updated/status/deleted, stock received/adjusted, thresholds, suppliers, settings, order status changes. |
| `ProductVariants.LowStockThreshold` | Optional per-size threshold. |
| `ProductImages.StorageKey` | Set for images uploaded through the portal (so their files can be deleted when no longer used). |
| `OrderStatusHistory.ChangedById / ChangedByName` | Who changed an order's status (null = automatic). |
| `OrderStatus` values | New `Pending`, `Confirmed` and `ReadyForDispatch`. New orders start as `Pending`; existing `Processing` orders carry on as they were. |

The demo catalogue is now seeded only once (`StoreSettings.CatalogSeededUtc`), so products the owner deletes don't come back
when the API restarts.

## 5. Image storage

Images are uploaded with `POST /api/v1/admin/media/images` (multipart `file`). The server:

* accepts at most 5 MB (`Storage:MaxImageBytes`);
* checks the file's real contents (JPEG, PNG or WebP signature), not just its name;
* gives it a random name.

Files are saved by the `IFileStorage` implementation. The default `LocalFileStorage` writes to
`ShoeStore.Api/uploads/products/yyyy/MM/` and the API serves them at `/media/...`. They're served with `nosniff`, a
restrictive CSP and long caching, and only image types are served. The Vite dev server forwards `/media` to the API.

To use cloud storage (for example Azure Blob Storage), implement `IFileStorage` (`SaveAsync`, `DeleteAsync`, `KeyFromUrl`),
register it in `ShoeStore.Infrastructure/DependencyInjection.cs` and set `Storage:PublicBaseUrl` to the CDN or container URL.
Products only accept image URLs produced by the configured storage (or images they already have).

## 6. API endpoints (all under `/api/v1/admin`, owner only)

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/dashboard` | Dashboard figures, 14-day sales, low stock, recent receipts, movements and orders |
| GET | `/lookups` | Brands, categories, sizes, colour families, suppliers, product types, threshold, next product code |
| GET | `/products` | Search/filter (`search`, `brandId`, `category`, `status`, `stock`, `sort`, `page`, `pageSize`) |
| GET | `/products/{id}` | Product with colours, images, variants and stock, audit info, delete eligibility |
| POST | `/products` | Create product (sizes become zero-stock variants) |
| PUT | `/products/{id}` | Update details, colours, sizes and images (no stock changes) |
| PATCH | `/products/{id}/status` | `{ isActive?, isFeatured? }` |
| POST | `/products/{id}/colours` | Add a colourway |
| DELETE | `/products/{id}` | Delete (only if no stock and never ordered) |
| POST | `/media/images` | Upload one image → `{ url, key, size, contentType }` |
| POST | `/stock-receipts` | Receive stock (idempotent by `clientRequestId`) |
| GET | `/stock-receipts`, `/stock-receipts/{id}` | Receipt history and detail |
| GET | `/inventory` | Variant stock (`search`, `brandId`, `category`, `productId`, `stock`, `size`, `sort`) incl. held quantity |
| POST | `/inventory/{variantId}/adjustments` | `{ type: correction\|damaged\|lost\|returned, change, reason }` |
| PUT | `/inventory/{variantId}/threshold` | `{ threshold: number \| null }` |
| GET | `/inventory/transactions` | Stock ledger (`search`, `type`, `variantId`, `productId`, `from`, `to`) |
| GET/POST/PUT | `/suppliers`, `/suppliers/{id}` | Suppliers |
| GET/PUT | `/settings` | Low-stock threshold and owner accounts |
| GET | `/orders`, `/orders/counts`, `/orders/{orderNumber}` | Orders with filters, counts per status, full detail |
| POST | `/orders/{orderNumber}/status` | `{ status, note? }`: next step or `cancelled` (reason required) |
| GET | `/customers` | Registered customers with order totals |

All endpoints are documented in Swagger (http://localhost:5080/swagger, **Owner portal** group).

## 7. Files

**Backend (new):**
* `ShoeStore.Domain/Entities/Inventory.cs`
* `ShoeStore.Application/Dtos/AdminDtos.cs`
* `ShoeStore.Application/Validation/AdminValidators.cs`
* `ShoeStore.Application/Services/OrderWorkflow.cs`
* `ShoeStore.Application/Services/InventoryLedger.cs`
* `ShoeStore.Application/Services/Admin/` (`AdminSupport`, `AdminProductService`, `StockReceiptService`, `InventoryAdminService`, `AdminOrderService`, `MediaService`)
* `ShoeStore.Infrastructure/Storage/LocalFileStorage.cs`
* `ShoeStore.Infrastructure/Security/OwnerAccountSync.cs`
* `ShoeStore.Api/Controllers/AdminControllers.cs`
* `ShoeStore.Api/Infrastructure/AdminAuthorization.cs`
* `ShoeStore.Tests/OwnerPortalTests.cs`
* the new migration

**Backend (changed):**
* `Enums.cs` (order statuses, transaction types)
* `Catalog.cs` (threshold, storage key)
* `Orders.cs` (status-history author, default status)
* `Abstractions.cs` (`DbSet`s, `IFileStorage`)
* `Options.cs` (`AdminOptions`, `StorageOptions`)
* `CheckoutService.cs` (stock through the ledger, orders start as Pending)
* `PaymentService.cs` (ledger, workflow-aware expiry, store-cancelled orders aren't reopened)
* `CustomerServices.cs` (owner role on sign-in)
* `Mapping.cs`
* `DependencyInjection.cs` (both)
* `AppDbContext.cs`, `Configurations.cs`
* `DbSeeder.cs` (seed catalogue once)
* `Program.cs` (policy, media files, owner sync)
* `appsettings*.json`
* `dev-api.ps1`
* `PayHereTests.cs`
* `.gitignore`

**Frontend (new):**
* `src/admin/`: `AdminApp.tsx`, `api.ts`, `types.ts`, `hooks.ts`, `format.ts`, `components.tsx`, `ImageManager.tsx`, `ProductForm.tsx`, `admin.css`
* `src/admin/pages/`: `DashboardPage`, `ProductsPage`, `ProductEditorPage`, `ReceiveStockPage`, `InventoryPage`, `StockHistoryPage`, `OrdersPage`, `OrderDetailPage`, `CustomersPage`, `SettingsPage`

**Frontend (changed):**
* `src/App.tsx` (`/admin` route)
* `src/types/index.ts` (order statuses)
* `src/components/order/OrderDetails.tsx` (customer progress for the new statuses)
* `src/components/order/Payment.tsx`, `src/utils/payments.ts`
* `src/components/layout/Header.tsx`, `src/pages/account/AccountPages.tsx` (Owner Portal links)
* `src/services/mock/MockOrderService.ts`
* `src/styles/components.css`
* `vite.config.ts` (`/media` proxy)

## 8. Assumptions

* One stock receipt is for one product (with any number of colours and sizes), which matches the "select a product, then
  enter quantities" workflow. Several products from the same invoice are recorded as several receipts with the same
  invoice number, one per product. The same supplier invoice can't be used twice *for the same supplier*, so give each
  receipt its own reference (e.g. `INV-123/1`, `INV-123/2`).
* "Regular price / discounted price" maps to the existing `OriginalPrice` / `Price` columns: if a sale price is set,
  customers pay it and see the regular price crossed out.
* "Reserved quantity" is shown as **Held**: pairs reserved by card orders still waiting for payment. They are already
  deducted from available stock, as in the existing checkout.
* Demo payments (development only) count as settled, so demo orders can be dispatched.
* Stock that came from the original demo seed has no history rows. The ledger starts with the first change made after
  this release.
