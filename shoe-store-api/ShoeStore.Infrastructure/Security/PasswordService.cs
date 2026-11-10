using Microsoft.AspNetCore.Identity;
using ShoeStore.Application.Abstractions;
using ShoeStore.Domain.Entities;

namespace ShoeStore.Infrastructure.Security;

/// <summary>
/// Password hashing via ASP.NET Core Identity's <see cref="PasswordHasher{TUser}"/>
/// (PBKDF2 with HMAC-SHA512, per-password salt, 100,000 iterations in the V3 format).
/// </summary>
public sealed class PasswordService : IPasswordService
{
    private readonly PasswordHasher<Customer> _hasher = new();

    public string Hash(Customer customer, string password) => _hasher.HashPassword(customer, password);

    public bool Verify(Customer customer, string password, out bool needsRehash)
    {
        needsRehash = false;
        if (string.IsNullOrEmpty(customer.PasswordHash)) return false;
        var result = _hasher.VerifyHashedPassword(customer, customer.PasswordHash, password);
        needsRehash = result == PasswordVerificationResult.SuccessRehashNeeded;
        return result is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;
    }
}

public sealed class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}
