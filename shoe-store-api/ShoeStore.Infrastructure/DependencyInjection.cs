using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using ShoeStore.Application.Options;
using ShoeStore.Infrastructure.Storage;
using ShoeStore.Application.Abstractions;
using ShoeStore.Infrastructure.Persistence;
using ShoeStore.Infrastructure.Security;
using ShoeStore.Infrastructure.Seed;

namespace ShoeStore.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException(
                "ConnectionStrings:DefaultConnection is not configured. Set it in appsettings.Development.json, " +
                "user secrets or the ConnectionStrings__DefaultConnection environment variable.");

        services.AddDbContext<AppDbContext>(options => options.UseSqlServer(connectionString, sql =>
        {
            sql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
            sql.CommandTimeout(30);
        }));
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        services.AddSingleton<IClock, SystemClock>();
        services.AddSingleton<IPasswordService, PasswordService>();
        services.AddScoped<DbSeeder>();
        services.AddScoped<OwnerAccountSync>();

        // Uploaded images: local disk by default. Swap for a cloud IFileStorage implementation in production.
        // StorageOptions are bound from the "Storage" section by the API host.
        services.AddSingleton<IFileStorage>(sp => new LocalFileStorage(
            sp.GetRequiredService<IOptions<StorageOptions>>(),
            sp.GetRequiredService<IHostEnvironment>().ContentRootPath));
        return services;
    }
}
