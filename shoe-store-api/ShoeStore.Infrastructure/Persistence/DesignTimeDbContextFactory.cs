using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using ShoeStore.Infrastructure.Security;

namespace ShoeStore.Infrastructure.Persistence;

/// <summary>
/// Used only by the EF Core CLI (dotnet ef migrations …) so migrations can be created without
/// running the web host. The connection string can be overridden with the
/// ConnectionStrings__DefaultConnection environment variable; it is only used by commands
/// that touch the database (e.g. dotnet ef database update).
/// </summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? "Server=localhost;Database=NishoesStore;Trusted_Connection=True;TrustServerCertificate=True";
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(connectionString, sql => sql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName))
            .Options;
        return new AppDbContext(options, new SystemClock());
    }
}
