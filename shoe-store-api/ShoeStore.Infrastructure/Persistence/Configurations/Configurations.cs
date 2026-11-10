using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ShoeStore.Domain.Entities;

namespace ShoeStore.Infrastructure.Persistence.Configurations;

// Fluent API configuration: keys, lengths, indexes and delete behaviours.
// Enums are stored as readable strings so the database is self-describing.

internal sealed class BrandConfiguration : IEntityTypeConfiguration<Brand>
{
    public void Configure(EntityTypeBuilder<Brand> b)
    {
        b.Property(x => x.Name).HasMaxLength(80).IsRequired();
        b.Property(x => x.Slug).HasMaxLength(80).IsRequired();
        b.Property(x => x.Description).HasMaxLength(500);
        b.HasIndex(x => x.Name).IsUnique();
        b.HasIndex(x => x.Slug).IsUnique();
    }
}

internal sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> b)
    {
        b.Property(x => x.Code).HasMaxLength(40).IsRequired();
        b.Property(x => x.Name).HasMaxLength(80).IsRequired();
        b.Property(x => x.Description).HasMaxLength(300);
        b.Property(x => x.ImageUrl).HasMaxLength(500);
        b.HasIndex(x => x.Code).IsUnique();
    }
}

internal sealed class SizeConfiguration : IEntityTypeConfiguration<Size>
{
    public void Configure(EntityTypeBuilder<Size> b)
    {
        b.Property(x => x.Code).HasMaxLength(8).IsRequired();
        b.Property(x => x.Label).HasMaxLength(16).IsRequired();
        b.Property(x => x.SizeSystem).HasConversion<string>().HasMaxLength(10);
        b.HasIndex(x => x.Code).IsUnique();
    }
}

internal sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> b)
    {
        b.Property(x => x.Code).HasMaxLength(20).IsRequired();
        b.Property(x => x.Slug).HasMaxLength(160).IsRequired();
        b.Property(x => x.Name).HasMaxLength(150).IsRequired();
        b.Property(x => x.Silhouette).HasMaxLength(30).IsRequired();
        b.Property(x => x.Description).HasMaxLength(2000).IsRequired();
        b.Property(x => x.Materials).HasMaxLength(1000);
        b.Property(x => x.Care).HasMaxLength(1000);
        b.Property(x => x.Gender).HasConversion<string>().HasMaxLength(10);
        b.Property(x => x.SizeSystem).HasConversion<string>().HasMaxLength(10);
        b.Property(x => x.Fit).HasConversion<string>().HasMaxLength(15);
        b.Property(x => x.Rating).HasPrecision(3, 2);
        b.Ignore(x => x.IsOnSale);

        b.HasIndex(x => x.Code).IsUnique();
        b.HasIndex(x => x.Slug).IsUnique();
        b.HasIndex(x => x.Name);
        b.HasIndex(x => x.Price);
        b.HasIndex(x => new { x.IsActive, x.Gender });
        b.HasIndex(x => x.ReleasedUtc);
        b.HasIndex(x => x.Popularity);

        b.HasOne(x => x.Brand).WithMany(x => x.Products).HasForeignKey(x => x.BrandId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(x => x.Highlights).WithOne().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Specifications).WithOne().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class ProductCategoryConfiguration : IEntityTypeConfiguration<ProductCategory>
{
    public void Configure(EntityTypeBuilder<ProductCategory> b)
    {
        b.HasKey(x => new { x.ProductId, x.CategoryId });
        b.HasOne(x => x.Product).WithMany(x => x.ProductCategories).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Category).WithMany(x => x.ProductCategories).HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => x.CategoryId);
    }
}

internal sealed class ProductHighlightConfiguration : IEntityTypeConfiguration<ProductHighlight>
{
    public void Configure(EntityTypeBuilder<ProductHighlight> b)
    {
        b.Property(x => x.Text).HasMaxLength(200).IsRequired();
    }
}

internal sealed class ProductSpecificationConfiguration : IEntityTypeConfiguration<ProductSpecification>
{
    public void Configure(EntityTypeBuilder<ProductSpecification> b)
    {
        b.Property(x => x.Label).HasMaxLength(60).IsRequired();
        b.Property(x => x.Value).HasMaxLength(300).IsRequired();
    }
}

internal sealed class ProductColourConfiguration : IEntityTypeConfiguration<ProductColour>
{
    public void Configure(EntityTypeBuilder<ProductColour> b)
    {
        b.Property(x => x.Code).HasMaxLength(40).IsRequired();
        b.Property(x => x.Name).HasMaxLength(80).IsRequired();
        b.Property(x => x.SwatchHex).HasMaxLength(9).IsRequired();
        b.Property(x => x.Family).HasMaxLength(20).IsRequired();
        b.HasIndex(x => new { x.ProductId, x.Code }).IsUnique();
        b.HasIndex(x => x.Family);
        b.HasOne(x => x.Product).WithMany(x => x.Colours).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Images).WithOne().HasForeignKey(x => x.ProductColourId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class ProductImageConfiguration : IEntityTypeConfiguration<ProductImage>
{
    public void Configure(EntityTypeBuilder<ProductImage> b)
    {
        b.Property(x => x.Url).HasMaxLength(500).IsRequired();
        b.Property(x => x.AltText).HasMaxLength(200);
        b.Property(x => x.StorageKey).HasMaxLength(200);
        b.HasIndex(x => x.StorageKey);
    }
}

internal sealed class ProductVariantConfiguration : IEntityTypeConfiguration<ProductVariant>
{
    public void Configure(EntityTypeBuilder<ProductVariant> b)
    {
        b.Property(x => x.Sku).HasMaxLength(40).IsRequired();
        b.Property(x => x.RowVersion).IsRowVersion();
        b.HasIndex(x => x.Sku).IsUnique();
        b.HasIndex(x => new { x.ProductColourId, x.SizeId }).IsUnique();
        b.HasIndex(x => new { x.ProductId, x.StockQuantity });
        b.ToTable(t =>
        {
            t.HasCheckConstraint("CK_ProductVariants_Stock", "[StockQuantity] >= 0");
            t.HasCheckConstraint("CK_ProductVariants_LowStockThreshold", "[LowStockThreshold] IS NULL OR [LowStockThreshold] >= 0");
        });

        // Deleting a product removes its variants; colour→variant uses NoAction to avoid multiple cascade paths.
        b.HasOne(x => x.Product).WithMany(x => x.Variants).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Colour).WithMany(x => x.Variants).HasForeignKey(x => x.ProductColourId).OnDelete(DeleteBehavior.NoAction);
        b.HasOne(x => x.Size).WithMany().HasForeignKey(x => x.SizeId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ProductReviewConfiguration : IEntityTypeConfiguration<ProductReview>
{
    public void Configure(EntityTypeBuilder<ProductReview> b)
    {
        b.Property(x => x.AuthorName).HasMaxLength(80).IsRequired();
        b.Property(x => x.Location).HasMaxLength(80);
        b.Property(x => x.Title).HasMaxLength(150).IsRequired();
        b.Property(x => x.Body).HasMaxLength(2000).IsRequired();
        b.Property(x => x.Fit).HasConversion<string>().HasMaxLength(15);
        b.Property(x => x.SizePurchased).HasMaxLength(8);
        b.ToTable(t => t.HasCheckConstraint("CK_ProductReviews_Rating", "[Rating] BETWEEN 1 AND 5"));
        b.HasIndex(x => new { x.ProductId, x.CreatedUtc });
        b.HasOne(x => x.Product).WithMany(x => x.Reviews).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<Customer>().WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.SetNull);
    }
}

internal sealed class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> b)
    {
        b.Property(x => x.Email).HasMaxLength(256).IsRequired();
        b.Property(x => x.NormalizedEmail).HasMaxLength(256).IsRequired();
        b.Property(x => x.PasswordHash).HasMaxLength(512).IsRequired();
        b.Property(x => x.FirstName).HasMaxLength(60).IsRequired();
        b.Property(x => x.LastName).HasMaxLength(60).IsRequired();
        b.Property(x => x.Phone).HasMaxLength(20);
        b.Property(x => x.PreferredSize).HasMaxLength(8);
        b.Property(x => x.Role).HasConversion<string>().HasMaxLength(20);
        b.HasIndex(x => x.NormalizedEmail).IsUnique();
    }
}

internal sealed class CustomerAddressConfiguration : IEntityTypeConfiguration<CustomerAddress>
{
    public void Configure(EntityTypeBuilder<CustomerAddress> b)
    {
        b.Property(x => x.FirstName).HasMaxLength(60).IsRequired();
        b.Property(x => x.LastName).HasMaxLength(60).IsRequired();
        b.Property(x => x.Line1).HasMaxLength(150).IsRequired();
        b.Property(x => x.Line2).HasMaxLength(150);
        b.Property(x => x.City).HasMaxLength(80).IsRequired();
        b.Property(x => x.District).HasMaxLength(40).IsRequired();
        b.Property(x => x.PostalCode).HasMaxLength(10).IsRequired();
        b.Property(x => x.Phone).HasMaxLength(20).IsRequired();
        b.HasOne(x => x.Customer).WithMany(x => x.Addresses).HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => x.CustomerId);
    }
}

internal sealed class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> b)
    {
        b.Property(x => x.TokenHash).HasMaxLength(128).IsRequired();
        b.Property(x => x.ReplacedByTokenHash).HasMaxLength(128);
        b.Property(x => x.CreatedByIp).HasMaxLength(64);
        b.HasIndex(x => x.TokenHash).IsUnique();
        b.HasIndex(x => new { x.CustomerId, x.ExpiresUtc });
        b.HasOne(x => x.Customer).WithMany(x => x.RefreshTokens).HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class CartConfiguration : IEntityTypeConfiguration<Cart>
{
    public void Configure(EntityTypeBuilder<Cart> b)
    {
        b.Property(x => x.CouponCode).HasMaxLength(40);
        // One cart per customer, and one per anonymous token.
        b.HasIndex(x => x.CustomerId).IsUnique().HasFilter("[CustomerId] IS NOT NULL");
        b.HasIndex(x => x.AnonymousId).IsUnique().HasFilter("[AnonymousId] IS NOT NULL");
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Items).WithOne(x => x.Cart).HasForeignKey(x => x.CartId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class CartItemConfiguration : IEntityTypeConfiguration<CartItem>
{
    public void Configure(EntityTypeBuilder<CartItem> b)
    {
        b.HasIndex(x => new { x.CartId, x.ProductVariantId }).IsUnique();
        b.ToTable(t => t.HasCheckConstraint("CK_CartItems_Quantity", "[Quantity] > 0"));
        b.HasOne(x => x.ProductVariant).WithMany().HasForeignKey(x => x.ProductVariantId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class WishlistConfiguration : IEntityTypeConfiguration<Wishlist>
{
    public void Configure(EntityTypeBuilder<Wishlist> b)
    {
        b.HasIndex(x => x.CustomerId).IsUnique();
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Items).WithOne(x => x.Wishlist).HasForeignKey(x => x.WishlistId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class WishlistItemConfiguration : IEntityTypeConfiguration<WishlistItem>
{
    public void Configure(EntityTypeBuilder<WishlistItem> b)
    {
        // Prevents the same product being saved twice by one customer.
        b.HasIndex(x => new { x.WishlistId, x.ProductId }).IsUnique();
        b.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class CouponConfiguration : IEntityTypeConfiguration<Coupon>
{
    public void Configure(EntityTypeBuilder<Coupon> b)
    {
        b.Property(x => x.Code).HasMaxLength(40).IsRequired();
        b.Property(x => x.Description).HasMaxLength(200).IsRequired();
        b.Property(x => x.Type).HasConversion<string>().HasMaxLength(20);
        b.HasIndex(x => x.Code).IsUnique();
    }
}

internal sealed class ShippingMethodConfiguration : IEntityTypeConfiguration<ShippingMethod>
{
    public void Configure(EntityTypeBuilder<ShippingMethod> b)
    {
        b.Property(x => x.Code).HasMaxLength(20).IsRequired();
        b.Property(x => x.Name).HasMaxLength(80).IsRequired();
        b.Property(x => x.Description).HasMaxLength(200).IsRequired();
        b.Property(x => x.RestrictedToDistricts).HasMaxLength(500);
        b.HasIndex(x => x.Code).IsUnique();
    }
}

internal sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> b)
    {
        b.Property(x => x.OrderNumber).HasMaxLength(20).IsRequired();
        b.Property(x => x.Email).HasMaxLength(256).IsRequired();
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.PaymentStatus).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.PaymentProvider).HasMaxLength(40).IsRequired();
        b.Property(x => x.PaymentReference).HasMaxLength(120);
        b.Property(x => x.ShippingMethodCode).HasMaxLength(20).IsRequired();
        b.Property(x => x.ShippingMethodName).HasMaxLength(80).IsRequired();
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.CouponCode).HasMaxLength(40);

        b.HasIndex(x => x.OrderNumber).IsUnique();
        b.HasIndex(x => new { x.CustomerId, x.PlacedUtc });
        b.HasIndex(x => x.Email);

        // Orders are history: deleting a customer must never delete their orders.
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.ShippingAddress).WithOne().HasForeignKey<OrderAddress>(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Items).WithOne(x => x.Order).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.StatusHistory).WithOne().HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.PaymentTransactions).WithOne(x => x.Order).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.PaymentStatus, x.PaymentExpiresUtc });
        b.HasIndex(x => new { x.Status, x.PlacedUtc });
        b.HasIndex(x => x.PlacedUtc);
    }
}

internal sealed class PaymentTransactionConfiguration : IEntityTypeConfiguration<PaymentTransaction>
{
    public void Configure(EntityTypeBuilder<PaymentTransaction> b)
    {
        b.ToTable("PaymentTransactions");
        b.Property(x => x.Provider).HasMaxLength(40).IsRequired();
        b.Property(x => x.ProviderPaymentId).HasMaxLength(64);
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.Method).HasMaxLength(20);
        b.Property(x => x.Message).HasMaxLength(200);
        b.HasIndex(x => new { x.Provider, x.ProviderPaymentId });
        b.HasIndex(x => new { x.OrderId, x.CreatedUtc });
    }
}

internal sealed class OrderAddressConfiguration : IEntityTypeConfiguration<OrderAddress>
{
    public void Configure(EntityTypeBuilder<OrderAddress> b)
    {
        b.ToTable("OrderAddresses");
        b.HasKey(x => x.OrderId);
        b.Property(x => x.FirstName).HasMaxLength(60).IsRequired();
        b.Property(x => x.LastName).HasMaxLength(60).IsRequired();
        b.Property(x => x.Line1).HasMaxLength(150).IsRequired();
        b.Property(x => x.Line2).HasMaxLength(150);
        b.Property(x => x.City).HasMaxLength(80).IsRequired();
        b.Property(x => x.District).HasMaxLength(40).IsRequired();
        b.Property(x => x.PostalCode).HasMaxLength(10).IsRequired();
        b.Property(x => x.Phone).HasMaxLength(20).IsRequired();
    }
}

internal sealed class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> b)
    {
        b.Property(x => x.Sku).HasMaxLength(40).IsRequired();
        b.Property(x => x.ProductCode).HasMaxLength(20).IsRequired();
        b.Property(x => x.ProductSlug).HasMaxLength(160).IsRequired();
        b.Property(x => x.ProductName).HasMaxLength(150).IsRequired();
        b.Property(x => x.BrandName).HasMaxLength(80).IsRequired();
        b.Property(x => x.ColourCode).HasMaxLength(40).IsRequired();
        b.Property(x => x.ColourName).HasMaxLength(80).IsRequired();
        b.Property(x => x.Size).HasMaxLength(8).IsRequired();
        b.Property(x => x.ImageUrl).HasMaxLength(500);
        b.ToTable(t => t.HasCheckConstraint("CK_OrderItems_Quantity", "[Quantity] > 0"));
        // Historical rows survive catalogue changes: the variant link is cleared, the snapshot stays.
        b.HasOne<ProductVariant>().WithMany().HasForeignKey(x => x.ProductVariantId).OnDelete(DeleteBehavior.SetNull);
    }
}

internal sealed class OrderStatusHistoryConfiguration : IEntityTypeConfiguration<OrderStatusHistory>
{
    public void Configure(EntityTypeBuilder<OrderStatusHistory> b)
    {
        b.ToTable("OrderStatusHistory");
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.Note).HasMaxLength(300);
        b.Property(x => x.ChangedByName).HasMaxLength(130);
    }
}

// ---------------------------------------------------------------- Owner Portal: suppliers, receipts, inventory ledger

internal sealed class SupplierConfiguration : IEntityTypeConfiguration<Supplier>
{
    public void Configure(EntityTypeBuilder<Supplier> b)
    {
        b.Property(x => x.Name).HasMaxLength(120).IsRequired();
        b.Property(x => x.ContactName).HasMaxLength(80);
        b.Property(x => x.Phone).HasMaxLength(30);
        b.Property(x => x.Email).HasMaxLength(256);
        b.Property(x => x.Notes).HasMaxLength(500);
        b.HasIndex(x => x.Name).IsUnique();
    }
}

internal sealed class StockReceiptConfiguration : IEntityTypeConfiguration<StockReceipt>
{
    public void Configure(EntityTypeBuilder<StockReceipt> b)
    {
        b.Property(x => x.ReceiptNumber).HasMaxLength(20).IsRequired();
        b.Property(x => x.SupplierName).HasMaxLength(120);
        b.Property(x => x.SupplierReference).HasMaxLength(60);
        b.Property(x => x.ProductCode).HasMaxLength(20).IsRequired();
        b.Property(x => x.ProductName).HasMaxLength(150).IsRequired();
        b.Property(x => x.Notes).HasMaxLength(500);
        b.Property(x => x.ReceivedByName).HasMaxLength(130).IsRequired();
        b.HasIndex(x => x.ReceiptNumber).IsUnique();
        b.HasIndex(x => x.ClientRequestId).IsUnique();
        b.HasIndex(x => new { x.SupplierId, x.SupplierReference }).IsUnique()
            .HasFilter("[SupplierId] IS NOT NULL AND [SupplierReference] IS NOT NULL");
        b.HasIndex(x => x.CreatedUtc);
        b.HasIndex(x => x.ProductId);
        b.ToTable(t => t.HasCheckConstraint("CK_StockReceipts_Quantity", "[TotalQuantity] > 0"));

        b.HasOne(x => x.Supplier).WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
        // Product deletion clears this link in code first (avoids SQL Server multiple cascade paths).
        b.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.NoAction);
        b.HasMany(x => x.Items).WithOne(x => x.StockReceipt).HasForeignKey(x => x.StockReceiptId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class StockReceiptItemConfiguration : IEntityTypeConfiguration<StockReceiptItem>
{
    public void Configure(EntityTypeBuilder<StockReceiptItem> b)
    {
        b.Property(x => x.Sku).HasMaxLength(40).IsRequired();
        b.Property(x => x.ColourName).HasMaxLength(80).IsRequired();
        b.Property(x => x.Size).HasMaxLength(8).IsRequired();
        b.ToTable(t => t.HasCheckConstraint("CK_StockReceiptItems_Quantity", "[Quantity] > 0"));
        b.HasOne<ProductVariant>().WithMany().HasForeignKey(x => x.ProductVariantId).OnDelete(DeleteBehavior.SetNull);
    }
}

internal sealed class InventoryTransactionConfiguration : IEntityTypeConfiguration<InventoryTransaction>
{
    public void Configure(EntityTypeBuilder<InventoryTransaction> b)
    {
        b.Property(x => x.Sku).HasMaxLength(40).IsRequired();
        b.Property(x => x.ProductCode).HasMaxLength(20).IsRequired();
        b.Property(x => x.ProductName).HasMaxLength(150).IsRequired();
        b.Property(x => x.ColourName).HasMaxLength(80).IsRequired();
        b.Property(x => x.Size).HasMaxLength(8).IsRequired();
        b.Property(x => x.Type).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.Reason).HasMaxLength(300).IsRequired();
        b.Property(x => x.Reference).HasMaxLength(40);
        b.Property(x => x.PerformedByName).HasMaxLength(130).IsRequired();
        b.ToTable(t =>
        {
            t.HasCheckConstraint("CK_InventoryTransactions_NonNegative", "[NewQuantity] >= 0 AND [PreviousQuantity] >= 0");
            t.HasCheckConstraint("CK_InventoryTransactions_Change", "[QuantityChange] <> 0 AND [NewQuantity] = [PreviousQuantity] + [QuantityChange]");
        });
        b.HasIndex(x => new { x.ProductVariantId, x.CreatedUtc });
        b.HasIndex(x => x.CreatedUtc);
        b.HasIndex(x => x.ProductCode);
        b.HasIndex(x => x.Reference);
        b.HasOne<ProductVariant>().WithMany().HasForeignKey(x => x.ProductVariantId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne<StockReceipt>().WithMany().HasForeignKey(x => x.StockReceiptId).OnDelete(DeleteBehavior.NoAction);
    }
}

internal sealed class StoreSettingsConfiguration : IEntityTypeConfiguration<StoreSettings>
{
    public void Configure(EntityTypeBuilder<StoreSettings> b)
    {
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.ModifiedByName).HasMaxLength(130);
        b.HasData(new StoreSettings { Id = 1, LowStockThreshold = 3 });
    }
}

internal sealed class AdminAuditLogConfiguration : IEntityTypeConfiguration<AdminAuditLog>
{
    public void Configure(EntityTypeBuilder<AdminAuditLog> b)
    {
        b.Property(x => x.Action).HasMaxLength(40).IsRequired();
        b.Property(x => x.EntityType).HasMaxLength(30).IsRequired();
        b.Property(x => x.EntityId).HasMaxLength(40).IsRequired();
        b.Property(x => x.Summary).HasMaxLength(500).IsRequired();
        b.Property(x => x.PerformedByName).HasMaxLength(130).IsRequired();
        b.HasIndex(x => new { x.EntityType, x.EntityId });
        b.HasIndex(x => x.CreatedUtc);
    }
}
