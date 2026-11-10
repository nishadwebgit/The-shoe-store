using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ShoeStore.Application.Options;
using ShoeStore.Domain.Enums;
using ShoeStore.Infrastructure.Persistence;

namespace ShoeStore.Infrastructure.Security;

/// <summary>
/// Applies Admin:OwnerEmails at startup: listed accounts become owners (Admin role), anyone else
/// holding the Admin role is returned to Customer. No accounts or passwords are created.
/// </summary>
public sealed class OwnerAccountSync(AppDbContext db, IOptions<AdminOptions> options, ILogger<OwnerAccountSync> logger)
{
    public async Task SyncAsync(CancellationToken ct = default)
    {
        var owners = options.Value.OwnerEmails.Select(e => e.Trim().ToUpperInvariant()).Where(e => e.Length > 0).Distinct().ToList();

        var promoted = await db.Customers
            .Where(c => owners.Contains(c.NormalizedEmail) && c.Role != CustomerRole.Admin)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.Role, CustomerRole.Admin), ct);
        var demoted = await db.Customers
            .Where(c => !owners.Contains(c.NormalizedEmail) && c.Role == CustomerRole.Admin)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.Role, CustomerRole.Customer), ct);
        var registered = await db.Customers.CountAsync(c => owners.Contains(c.NormalizedEmail), ct);

        if (owners.Count == 0)
            logger.LogWarning("No owner accounts configured (Admin:OwnerEmails). The Owner Portal is locked until one is added.");
        else
            logger.LogInformation("Owner accounts: {Registered} of {Configured} configured emails have registered ({Promoted} promoted, {Demoted} demoted)",
                registered, owners.Count, promoted, demoted);
    }
}
