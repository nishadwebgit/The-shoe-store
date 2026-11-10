using ShoeStore.Domain.Common;
using ShoeStore.Domain.Enums;

namespace ShoeStore.Domain.Entities;

public class Customer : AuditableEntity
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;

    /// <summary>Upper-cased email used for case-insensitive lookups.</summary>
    public string NormalizedEmail { get; set; } = string.Empty;

    /// <summary>PBKDF2 hash produced by ASP.NET Core Identity's password hasher. Never a plain password.</summary>
    public string PasswordHash { get; set; } = string.Empty;

    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? PreferredSize { get; set; }
    public bool MarketingOptIn { get; set; }
    public CustomerRole Role { get; set; } = CustomerRole.Customer;

    public int FailedLoginCount { get; set; }
    public DateTime? LockoutEndUtc { get; set; }
    public DateTime? LastLoginUtc { get; set; }

    public ICollection<CustomerAddress> Addresses { get; set; } = new List<CustomerAddress>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}

public class CustomerAddress : AuditableEntity
{
    public int Id { get; set; }
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Line1 { get; set; } = string.Empty;
    public string? Line2 { get; set; }
    public string City { get; set; } = string.Empty;
    public string District { get; set; } = string.Empty;
    public string PostalCode { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public bool IsDefault { get; set; }
}

/// <summary>
/// Long-lived refresh token. Only a SHA-256 hash is stored, so a database leak does not
/// expose usable tokens. Tokens rotate on every use.
/// </summary>
public class RefreshToken
{
    public int Id { get; set; }
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public string TokenHash { get; set; } = string.Empty;
    public DateTime CreatedUtc { get; set; }
    public DateTime ExpiresUtc { get; set; }
    public DateTime? RevokedUtc { get; set; }
    public string? ReplacedByTokenHash { get; set; }
    public string? CreatedByIp { get; set; }

    public bool IsActive(DateTime nowUtc) => RevokedUtc is null && ExpiresUtc > nowUtc;
}
