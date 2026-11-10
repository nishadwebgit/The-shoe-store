using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using ShoeStore.Domain.Entities;

namespace ShoeStore.Application.Abstractions;

/// <summary>Database access used by application services (implemented by EF Core in Infrastructure).</summary>
public interface IAppDbContext
{
    DbSet<Brand> Brands { get; }
    DbSet<Category> Categories { get; }
    DbSet<Size> Sizes { get; }
    DbSet<Product> Products { get; }
    DbSet<ProductCategory> ProductCategories { get; }
    DbSet<ProductColour> ProductColours { get; }
    DbSet<ProductImage> ProductImages { get; }
    DbSet<ProductVariant> ProductVariants { get; }
    DbSet<ProductReview> ProductReviews { get; }
    DbSet<Customer> Customers { get; }
    DbSet<CustomerAddress> CustomerAddresses { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<Cart> Carts { get; }
    DbSet<CartItem> CartItems { get; }
    DbSet<Wishlist> Wishlists { get; }
    DbSet<WishlistItem> WishlistItems { get; }
    DbSet<Coupon> Coupons { get; }
    DbSet<ShippingMethod> ShippingMethods { get; }
    DbSet<Order> Orders { get; }
    DbSet<OrderItem> OrderItems { get; }
    DbSet<OrderStatusHistory> OrderStatusHistory { get; }
    DbSet<PaymentTransaction> PaymentTransactions { get; }
    DbSet<Supplier> Suppliers { get; }
    DbSet<StockReceipt> StockReceipts { get; }
    DbSet<StockReceiptItem> StockReceiptItems { get; }
    DbSet<InventoryTransaction> InventoryTransactions { get; }
    DbSet<StoreSettings> StoreSettings { get; }
    DbSet<AdminAuditLog> AdminAuditLogs { get; }

    DatabaseFacade Database { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

/// <summary>Information about the caller of the current request.</summary>
public interface ICurrentUser
{
    Guid? CustomerId { get; }
    bool IsAuthenticated { get; }
    bool IsAdmin { get; }
    string? IpAddress { get; }
}

/// <summary>A file saved by <see cref="IFileStorage"/>.</summary>
public sealed record StoredFile(string Key, string Url);

/// <summary>
/// Where uploaded files (product images) are kept. The local implementation writes to disk; a cloud
/// implementation (e.g. Azure Blob Storage) can replace it without touching the services.
/// </summary>
public interface IFileStorage
{
    Task<StoredFile> SaveAsync(Stream content, string extension, CancellationToken ct);
    Task DeleteAsync(string key, CancellationToken ct);

    /// <summary>Returns the storage key for a URL this storage produced, or null for any other URL.</summary>
    string? KeyFromUrl(string url);
}

public interface IClock
{
    DateTime UtcNow { get; }
}

public sealed record AccessToken(string Token, DateTime ExpiresUtc);

/// <summary>Creates signed JWT access tokens and opaque refresh tokens.</summary>
public interface ITokenService
{
    AccessToken CreateAccessToken(Customer customer);
    string CreateRefreshToken();
    string HashToken(string token);
}

public interface IPasswordService
{
    string Hash(Customer customer, string password);

    /// <returns>True when the password matches. <paramref name="needsRehash"/> signals an outdated hash format.</returns>
    bool Verify(Customer customer, string password, out bool needsRehash);
}
