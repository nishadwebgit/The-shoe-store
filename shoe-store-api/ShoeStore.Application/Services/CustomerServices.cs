using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ShoeStore.Application.Abstractions;
using ShoeStore.Application.Common;
using ShoeStore.Application.Dtos;
using ShoeStore.Application.Options;
using ShoeStore.Domain.Entities;
using ShoeStore.Domain.Enums;

namespace ShoeStore.Application.Services;

// ------------------------------------------------------------------ Authentication

public interface IAuthService
{
    Task<AuthResult> RegisterAsync(RegisterRequest request, CancellationToken ct);
    Task<AuthResult> LoginAsync(LoginRequest request, CancellationToken ct);
    Task<AuthResult> RefreshAsync(string refreshToken, CancellationToken ct);
    Task LogoutAsync(string? refreshToken, CancellationToken ct);
    Task ChangePasswordAsync(Guid customerId, ChangePasswordRequest request, CancellationToken ct);
}

public sealed class AuthService(
    IAppDbContext db,
    IPasswordService passwords,
    ITokenService tokens,
    ICurrentUser currentUser,
    IClock clock,
    IOptions<AuthOptions> authOptions,
    IOptionsMonitor<AdminOptions> adminOptions,
    ILogger<AuthService> logger) : IAuthService
{
    private readonly AuthOptions _options = authOptions.Value;

    private static string Normalize(string email) => email.Trim().ToUpperInvariant();

    private Task<Customer?> FindCustomerAsync(Guid id, CancellationToken ct) =>
        db.Customers.Include(c => c.Addresses).FirstOrDefaultAsync(c => c.Id == id, ct);

    private async Task<AuthResult> IssueTokensAsync(Customer customer, CancellationToken ct)
    {
        // Owner accounts are defined by configuration (Admin:OwnerEmails); the role is refreshed on every sign-in and token refresh.
        var role = OwnerAccounts.RoleFor(customer.Email, adminOptions.CurrentValue);
        if (customer.Role != role)
        {
            logger.LogWarning("Account {CustomerId} role changed {From} → {To} (Admin:OwnerEmails)", customer.Id, customer.Role, role);
            customer.Role = role;
        }

        var access = tokens.CreateAccessToken(customer);
        var refresh = tokens.CreateRefreshToken();
        var now = clock.UtcNow;
        var expires = now.AddDays(_options.RefreshTokenDays);

        db.RefreshTokens.Add(new RefreshToken
        {
            CustomerId = customer.Id,
            TokenHash = tokens.HashToken(refresh),
            CreatedUtc = now,
            ExpiresUtc = expires,
            CreatedByIp = currentUser.IpAddress,
        });

        // Housekeeping: drop this customer's long-dead tokens.
        var stale = await db.RefreshTokens
            .Where(t => t.CustomerId == customer.Id && (t.ExpiresUtc < now || (t.RevokedUtc != null && t.RevokedUtc < now.AddDays(-7))))
            .ToListAsync(ct);
        db.RefreshTokens.RemoveRange(stale);

        await db.SaveChangesAsync(ct);
        return new AuthResult(new AuthResponse(access.Token, access.ExpiresUtc, customer.ToDto()), refresh, expires);
    }

    public async Task<AuthResult> RegisterAsync(RegisterRequest request, CancellationToken ct)
    {
        var normalized = Normalize(request.Email);
        if (await db.Customers.AnyAsync(c => c.NormalizedEmail == normalized, ct))
            throw new ConflictException("An account with this email already exists. Sign in instead.", "email_taken");

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Email = request.Email.Trim().ToLowerInvariant(),
            NormalizedEmail = normalized,
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            MarketingOptIn = request.MarketingOptIn,
        };
        customer.PasswordHash = passwords.Hash(customer, request.Password);
        db.Customers.Add(customer);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Customer {CustomerId} registered", customer.Id);
        return await IssueTokensAsync(customer, ct);
    }

    public async Task<AuthResult> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        var normalized = Normalize(request.Email);
        var customer = await db.Customers.Include(c => c.Addresses).FirstOrDefaultAsync(c => c.NormalizedEmail == normalized, ct);
        var invalid = new UnauthorizedException("The email or password is incorrect. Check them and try again.", "invalid_credentials");
        var now = clock.UtcNow;

        if (customer is null)
        {
            logger.LogWarning("Failed sign-in for unknown account");
            throw invalid;
        }

        if (customer.LockoutEndUtc is { } lockedUntil && lockedUntil > now)
        {
            logger.LogWarning("Sign-in blocked for locked account {CustomerId}", customer.Id);
            throw new UnauthorizedException(
                $"Too many failed attempts. Try again after {Math.Ceiling((lockedUntil - now).TotalMinutes)} minutes or reset your password.",
                "account_locked");
        }

        if (!passwords.Verify(customer, request.Password, out var needsRehash))
        {
            customer.FailedLoginCount++;
            if (customer.FailedLoginCount >= _options.MaxFailedLogins)
            {
                customer.LockoutEndUtc = now.AddMinutes(_options.LockoutMinutes);
                customer.FailedLoginCount = 0;
                logger.LogWarning("Account {CustomerId} locked after repeated failed sign-ins", customer.Id);
            }
            await db.SaveChangesAsync(ct);
            logger.LogWarning("Failed sign-in for {CustomerId}", customer.Id);
            throw invalid;
        }

        if (needsRehash) customer.PasswordHash = passwords.Hash(customer, request.Password);
        customer.FailedLoginCount = 0;
        customer.LockoutEndUtc = null;
        customer.LastLoginUtc = now;
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Customer {CustomerId} signed in", customer.Id);
        return await IssueTokensAsync(customer, ct);
    }

    public async Task<AuthResult> RefreshAsync(string refreshToken, CancellationToken ct)
    {
        var hash = tokens.HashToken(refreshToken);
        var stored = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        var now = clock.UtcNow;
        var expired = new UnauthorizedException("Your session has ended. Sign in again.", "session_expired");

        if (stored is null) throw expired;

        if (!stored.IsActive(now))
        {
            // A revoked token being replayed suggests theft: revoke every active session for this customer.
            if (stored.RevokedUtc is not null && stored.ReplacedByTokenHash is not null)
            {
                var active = await db.RefreshTokens.Where(t => t.CustomerId == stored.CustomerId && t.RevokedUtc == null).ToListAsync(ct);
                foreach (var t in active) t.RevokedUtc = now;
                await db.SaveChangesAsync(ct);
                logger.LogWarning("Refresh token reuse detected for {CustomerId}; all sessions revoked", stored.CustomerId);
            }
            throw expired;
        }

        var customer = await FindCustomerAsync(stored.CustomerId, ct) ?? throw expired;
        var result = await IssueTokensAsync(customer, ct);
        stored.RevokedUtc = now;
        stored.ReplacedByTokenHash = tokens.HashToken(result.RefreshToken);
        await db.SaveChangesAsync(ct);
        return result;
    }

    public async Task LogoutAsync(string? refreshToken, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(refreshToken)) return;
        var hash = tokens.HashToken(refreshToken);
        var stored = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (stored is { RevokedUtc: null })
        {
            stored.RevokedUtc = clock.UtcNow;
            await db.SaveChangesAsync(ct);
        }
    }

    public async Task ChangePasswordAsync(Guid customerId, ChangePasswordRequest request, CancellationToken ct)
    {
        var customer = await FindCustomerAsync(customerId, ct)
                       ?? throw new UnauthorizedException("Your session has ended. Sign in again.", "session_expired");
        if (!passwords.Verify(customer, request.CurrentPassword, out _))
            throw new BusinessRuleException("Your current password is incorrect.", "invalid_password");

        customer.PasswordHash = passwords.Hash(customer, request.NewPassword);
        var now = clock.UtcNow;
        var active = await db.RefreshTokens.Where(t => t.CustomerId == customerId && t.RevokedUtc == null).ToListAsync(ct);
        foreach (var t in active) t.RevokedUtc = now;
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Customer {CustomerId} changed their password; other sessions signed out", customerId);
    }
}

// ------------------------------------------------------------------ Profile & addresses

public interface ICustomerService
{
    Task<CustomerDto> GetProfileAsync(Guid customerId, CancellationToken ct);
    Task<CustomerDto> UpdateProfileAsync(Guid customerId, UpdateProfileRequest request, CancellationToken ct);
    Task<IReadOnlyList<AddressDto>> GetAddressesAsync(Guid customerId, CancellationToken ct);
    Task<AddressDto> AddAddressAsync(Guid customerId, AddressRequest request, CancellationToken ct);
    Task<AddressDto> UpdateAddressAsync(Guid customerId, int addressId, AddressRequest request, CancellationToken ct);
    Task DeleteAddressAsync(Guid customerId, int addressId, CancellationToken ct);
    Task<AddressDto> SetDefaultAddressAsync(Guid customerId, int addressId, CancellationToken ct);
}

public sealed class CustomerService(IAppDbContext db) : ICustomerService
{
    private const int MaxAddresses = 10;

    private async Task<Customer> LoadAsync(Guid customerId, CancellationToken ct) =>
        await db.Customers.Include(c => c.Addresses).FirstOrDefaultAsync(c => c.Id == customerId, ct)
        ?? throw new UnauthorizedException("Your session has ended. Sign in again.", "session_expired");

    public async Task<CustomerDto> GetProfileAsync(Guid customerId, CancellationToken ct) => (await LoadAsync(customerId, ct)).ToDto();

    public async Task<CustomerDto> UpdateProfileAsync(Guid customerId, UpdateProfileRequest request, CancellationToken ct)
    {
        var customer = await LoadAsync(customerId, ct);
        customer.FirstName = request.FirstName.Trim();
        customer.LastName = request.LastName.Trim();
        customer.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        customer.PreferredSize = string.IsNullOrWhiteSpace(request.PreferredSize) ? null : request.PreferredSize.Trim().ToUpperInvariant();
        customer.MarketingOptIn = request.MarketingOptIn;
        await db.SaveChangesAsync(ct);
        return customer.ToDto();
    }

    public async Task<IReadOnlyList<AddressDto>> GetAddressesAsync(Guid customerId, CancellationToken ct)
    {
        var addresses = await db.CustomerAddresses.AsNoTracking()
            .Where(a => a.CustomerId == customerId)
            .OrderByDescending(a => a.IsDefault).ThenBy(a => a.Id)
            .ToListAsync(ct);
        return addresses.Select(a => a.ToDto()).ToList();
    }

    private static void Apply(CustomerAddress target, AddressRequest r)
    {
        target.FirstName = r.FirstName.Trim();
        target.LastName = r.LastName.Trim();
        target.Line1 = r.Line1.Trim();
        target.Line2 = string.IsNullOrWhiteSpace(r.Line2) ? null : r.Line2.Trim();
        target.City = r.City.Trim();
        target.District = r.District.Trim();
        target.PostalCode = r.PostalCode.Trim();
        target.Phone = r.Phone.Trim();
    }

    private static void MakeDefault(Customer customer, CustomerAddress address)
    {
        foreach (var a in customer.Addresses) a.IsDefault = false;
        address.IsDefault = true;
    }

    public async Task<AddressDto> AddAddressAsync(Guid customerId, AddressRequest request, CancellationToken ct)
    {
        var customer = await LoadAsync(customerId, ct);
        if (customer.Addresses.Count >= MaxAddresses)
            throw new BusinessRuleException($"You can save up to {MaxAddresses} addresses. Delete one to add another.", "address_limit");

        var address = new CustomerAddress { CustomerId = customerId };
        Apply(address, request);
        customer.Addresses.Add(address);
        if (request.IsDefault || customer.Addresses.Count == 1) MakeDefault(customer, address);
        await db.SaveChangesAsync(ct);
        return address.ToDto();
    }

    private static CustomerAddress Owned(Customer customer, int addressId) =>
        customer.Addresses.FirstOrDefault(a => a.Id == addressId)
        ?? throw new NotFoundException("That address isn't in your account.", "address_not_found");

    public async Task<AddressDto> UpdateAddressAsync(Guid customerId, int addressId, AddressRequest request, CancellationToken ct)
    {
        var customer = await LoadAsync(customerId, ct);
        var address = Owned(customer, addressId);
        Apply(address, request);
        if (request.IsDefault) MakeDefault(customer, address);
        await db.SaveChangesAsync(ct);
        return address.ToDto();
    }

    public async Task DeleteAddressAsync(Guid customerId, int addressId, CancellationToken ct)
    {
        var customer = await LoadAsync(customerId, ct);
        var address = Owned(customer, addressId);
        var wasDefault = address.IsDefault;
        customer.Addresses.Remove(address);
        db.CustomerAddresses.Remove(address);
        if (wasDefault && customer.Addresses.FirstOrDefault() is { } next) next.IsDefault = true;
        await db.SaveChangesAsync(ct);
    }

    public async Task<AddressDto> SetDefaultAddressAsync(Guid customerId, int addressId, CancellationToken ct)
    {
        var customer = await LoadAsync(customerId, ct);
        var address = Owned(customer, addressId);
        MakeDefault(customer, address);
        await db.SaveChangesAsync(ct);
        return address.ToDto();
    }
}

// ------------------------------------------------------------------ Wishlist

public interface IWishlistService
{
    Task<WishlistDto> GetAsync(Guid customerId, CancellationToken ct);
    Task<WishlistDto> AddAsync(Guid customerId, string productId, CancellationToken ct);
    Task<WishlistDto> RemoveAsync(Guid customerId, string productId, CancellationToken ct);
    Task<WishlistDto> ClearAsync(Guid customerId, CancellationToken ct);
    Task<WishlistDto> MergeAsync(Guid customerId, IReadOnlyList<string> productIds, CancellationToken ct);
}

public sealed class WishlistService(IAppDbContext db, IClock clock) : IWishlistService
{
    private const int MaxItems = 200;

    private async Task<Wishlist> GetOrCreateAsync(Guid customerId, CancellationToken ct)
    {
        var wishlist = await db.Wishlists.Include(w => w.Items).FirstOrDefaultAsync(w => w.CustomerId == customerId, ct);
        if (wishlist is not null) return wishlist;
        wishlist = new Wishlist { CustomerId = customerId };
        db.Wishlists.Add(wishlist);
        return wishlist;
    }

    public async Task<WishlistDto> GetAsync(Guid customerId, CancellationToken ct)
    {
        var items = await db.WishlistItems.AsNoTracking()
            .AsSplitQuery()
            .Where(i => i.Wishlist.CustomerId == customerId && i.Product.IsActive)
            .OrderByDescending(i => i.CreatedUtc)
            .Include(i => i.Product).ThenInclude(p => p.Brand)
            .Include(i => i.Product).ThenInclude(p => p.Colours).ThenInclude(c => c.Images)
            .Include(i => i.Product).ThenInclude(p => p.Variants)
            .ToListAsync(ct);
        return new WishlistDto(items.Select(i => new WishlistItemDto(i.Product.Code, i.CreatedUtc, i.Product.ToSummaryDto())).ToList());
    }

    private async Task<int> ProductIdAsync(string code, CancellationToken ct)
    {
        var normalized = code.Trim().ToUpperInvariant();
        var id = await db.Products.Where(p => p.Code == normalized && p.IsActive).Select(p => (int?)p.Id).FirstOrDefaultAsync(ct);
        return id ?? throw new NotFoundException("We couldn't find that shoe.", "product_not_found");
    }

    public async Task<WishlistDto> AddAsync(Guid customerId, string productId, CancellationToken ct)
    {
        var id = await ProductIdAsync(productId, ct);
        var wishlist = await GetOrCreateAsync(customerId, ct);
        // Adding a product that's already saved is a no-op, never a duplicate row.
        if (wishlist.Items.All(i => i.ProductId != id))
        {
            if (wishlist.Items.Count >= MaxItems)
                throw new BusinessRuleException($"Your wishlist can hold up to {MaxItems} shoes.", "wishlist_full");
            wishlist.Items.Add(new WishlistItem { ProductId = id, CreatedUtc = clock.UtcNow });
            await db.SaveChangesAsync(ct);
        }
        return await GetAsync(customerId, ct);
    }

    public async Task<WishlistDto> RemoveAsync(Guid customerId, string productId, CancellationToken ct)
    {
        var normalized = productId.Trim().ToUpperInvariant();
        var items = await db.WishlistItems
            .Where(i => i.Wishlist.CustomerId == customerId && i.Product.Code == normalized)
            .ToListAsync(ct);
        if (items.Count > 0)
        {
            db.WishlistItems.RemoveRange(items);
            await db.SaveChangesAsync(ct);
        }
        return await GetAsync(customerId, ct);
    }

    public async Task<WishlistDto> ClearAsync(Guid customerId, CancellationToken ct)
    {
        var items = await db.WishlistItems.Where(i => i.Wishlist.CustomerId == customerId).ToListAsync(ct);
        db.WishlistItems.RemoveRange(items);
        await db.SaveChangesAsync(ct);
        return new WishlistDto(Array.Empty<WishlistItemDto>());
    }

    public async Task<WishlistDto> MergeAsync(Guid customerId, IReadOnlyList<string> productIds, CancellationToken ct)
    {
        var codes = productIds.Select(p => p.Trim().ToUpperInvariant()).Distinct().Take(MaxItems).ToList();
        var ids = await db.Products.Where(p => codes.Contains(p.Code) && p.IsActive).Select(p => p.Id).ToListAsync(ct);
        var wishlist = await GetOrCreateAsync(customerId, ct);
        var now = clock.UtcNow;
        foreach (var productKey in ids.Where(candidate => wishlist.Items.All(i => i.ProductId != candidate)))
        {
            if (wishlist.Items.Count >= MaxItems) break;
            wishlist.Items.Add(new WishlistItem { ProductId = productKey, CreatedUtc = now });
        }
        await db.SaveChangesAsync(ct);
        return await GetAsync(customerId, ct);
    }
}

/// <summary>Owner/admin accounts are the customer accounts whose email is listed in Admin:OwnerEmails.</summary>
public static class OwnerAccounts
{
    public static bool IsOwner(string email, AdminOptions options) =>
        options.OwnerEmails.Any(e => string.Equals(e.Trim(), email.Trim(), StringComparison.OrdinalIgnoreCase));

    public static CustomerRole RoleFor(string email, AdminOptions options) =>
        IsOwner(email, options) ? CustomerRole.Admin : CustomerRole.Customer;
}
