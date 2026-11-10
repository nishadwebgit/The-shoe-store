using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ShoeStore.Application.Abstractions;
using ShoeStore.Domain.Enums;

namespace ShoeStore.Api.Infrastructure;

public static class AdminPolicy
{
    /// <summary>Owner Portal endpoints: Admin role in the token AND still an admin in the database.</summary>
    public const string Name = "OwnerPortal";
}

/// <summary>Requires the caller's account to currently hold the Admin role in the database.</summary>
public sealed class ActiveAdminRequirement : IAuthorizationRequirement;

/// <summary>
/// Access tokens live for 15 minutes; this check makes removing someone from Admin:OwnerEmails take effect
/// on their very next request instead of when their token expires.
/// </summary>
public sealed class ActiveAdminHandler(IAppDbContext db, ICurrentUser user) : AuthorizationHandler<ActiveAdminRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, ActiveAdminRequirement requirement)
    {
        if (user.CustomerId is not { } id) return;
        var isAdmin = await db.Customers.AsNoTracking().AnyAsync(c => c.Id == id && c.Role == CustomerRole.Admin);
        if (isAdmin) context.Succeed(requirement);
    }
}
