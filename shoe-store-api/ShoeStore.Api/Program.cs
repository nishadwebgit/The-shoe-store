using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using ShoeStore.Api.Infrastructure;
using ShoeStore.Application;
using ShoeStore.Application.Abstractions;
using ShoeStore.Application.Options;
using ShoeStore.Infrastructure;
using ShoeStore.Infrastructure.Persistence;
using ShoeStore.Infrastructure.Security;
using ShoeStore.Infrastructure.Seed;

var builder = WebApplication.CreateBuilder(args);
// Machine-specific settings that must not be committed (e.g. Admin:OwnerEmails). Git-ignored; see README.
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);
var config = builder.Configuration;

// ---------------------------------------------------------------- Options
builder.Services.Configure<PricingOptions>(config.GetSection(PricingOptions.SectionName));
builder.Services.Configure<AuthOptions>(config.GetSection(AuthOptions.SectionName));
builder.Services.Configure<JwtOptions>(config.GetSection(JwtOptions.SectionName));
builder.Services.Configure<PayHereOptions>(config.GetSection(PayHereOptions.SectionName));
builder.Services.Configure<PaymentOptions>(config.GetSection(PaymentOptions.SectionName));
builder.Services.Configure<AdminOptions>(config.GetSection(AdminOptions.SectionName));
builder.Services.Configure<StorageOptions>(config.GetSection(StorageOptions.SectionName));

var jwt = config.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
if (string.IsNullOrWhiteSpace(jwt.SigningKey) || jwt.SigningKey.Length < 32)
{
    if (!builder.Environment.IsDevelopment())
        throw new InvalidOperationException("Jwt:SigningKey must be set (32+ characters) via environment variables or a secret store.");

    // Development fallback: a random per-process key. Tokens stop working after a restart (refresh restores them).
    // Run dev-api.cmd (or `dotnet user-secrets set Jwt:SigningKey <value>`) for a stable key.
    jwt.SigningKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
    builder.Services.PostConfigure<JwtOptions>(o => o.SigningKey = jwt.SigningKey);
    Console.WriteLine("warn: Jwt:SigningKey not configured; using a temporary development key.");
}

// ---------------------------------------------------------------- Layers
builder.Services.AddApplication();
builder.Services.AddInfrastructure(config);
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddSingleton<ITokenService, TokenService>();

// ---------------------------------------------------------------- MVC, errors, validation
builder.Services.AddControllers(options =>
    {
        options.Filters.Add<FluentValidationFilter>();
    })
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.CamelCase));
        o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
    })
    .ConfigureApiBehaviorOptions(o =>
    {
        // Malformed JSON / type errors: keep ASP.NET Core's ValidationProblemDetails but add our error code.
        var defaultFactory = o.InvalidModelStateResponseFactory;
        o.InvalidModelStateResponseFactory = context =>
        {
            var result = defaultFactory(context);
            if (result is ObjectResult { Value: ProblemDetails problem })
            {
                problem.Title = "Check the highlighted fields";
                problem.Extensions["code"] = "validation_failed";
            }
            return result;
        };
    });

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

// ---------------------------------------------------------------- Authentication
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = jwt.CreateKey(),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = JwtRegisteredClaimNames.Sub,
            RoleClaimType = System.Security.Claims.ClaimTypes.Role,
        };
        options.Events = new JwtBearerEvents
        {
            OnAuthenticationFailed = ctx =>
            {
                ctx.HttpContext.RequestServices.GetRequiredService<ILoggerFactory>()
                    .CreateLogger("Auth").LogInformation("JWT rejected: {Reason}", ctx.Exception.GetType().Name);
                return Task.CompletedTask;
            },
        };
    });
builder.Services.AddScoped<Microsoft.AspNetCore.Authorization.IAuthorizationHandler, ActiveAdminHandler>();
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(AdminPolicy.Name, policy => policy
        .RequireAuthenticatedUser()
        .RequireRole(ShoeStore.Domain.Enums.CustomerRole.Admin.ToString())
        .AddRequirements(new ActiveAdminRequirement()));
});

// ---------------------------------------------------------------- Rate limiting
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy(RateLimitPolicies.Auth, http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    options.AddPolicy(RateLimitPolicies.Checkout, http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    options.OnRejected = async (context, ct) =>
    {
        context.HttpContext.Response.ContentType = "application/problem+json";
        await context.HttpContext.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = 429,
            Title = "Too many requests",
            Detail = "Too many attempts. Wait a minute and try again.",
        }, ct);
    };
});

// ---------------------------------------------------------------- CORS (explicit origins only)
var allowedOrigins = config.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy =>
{
    if (allowedOrigins.Length > 0)
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()
            .WithExposedHeaders(HttpContextExtensions.CartTokenHeader);
}));

// ---------------------------------------------------------------- Swagger / OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Nishoes Shoe Store API",
        Version = "v1",
        Description = "REST API for the Nishoes storefront: catalogue, cart, wishlist, checkout (simulated payment), orders and customer accounts. " +
                      "Click **Authorize** and paste an access token from /api/v1/auth/login to call protected endpoints. " +
                      "Guests can pass an anonymous cart token in the X-Cart-Token header.",
    });

    var xml = Path.Combine(AppContext.BaseDirectory, $"{Assembly.GetExecutingAssembly().GetName().Name}.xml");
    if (File.Exists(xml)) c.IncludeXmlComments(xml);

    // Group operations by the module named in each controller's [Tags] attribute.
    c.TagActionsBy(api =>
    {
        if (api.ActionDescriptor is ControllerActionDescriptor action &&
            action.ControllerTypeInfo.GetCustomAttribute<TagsAttribute>() is { } tags)
            return tags.Tags.ToList();
        return [api.ActionDescriptor.RouteValues["controller"] ?? "Other"];
    });
    c.DocInclusionPredicate((_, _) => true);

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Name = "Authorization",
        Description = "Paste the accessToken returned by /api/v1/auth/login or /register (without the 'Bearer ' prefix).",
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
            Array.Empty<string>()
        },
    });
    c.AddSecurityDefinition("CartToken", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.ApiKey,
        In = ParameterLocation.Header,
        Name = HttpContextExtensions.CartTokenHeader,
        Description = "Optional anonymous cart token (guests). Returned as cartToken by cart endpoints.",
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "CartToken" } },
            Array.Empty<string>()
        },
    });
});

builder.Services.AddHealthChecks();
builder.Services.AddHostedService<PaymentExpiryWorker>();

var app = builder.Build();

// ---------------------------------------------------------------- Database migrate + seed
var dbOptions = config.GetSection("Database");
if (dbOptions.GetValue<bool>("MigrateOnStartup") || dbOptions.GetValue<bool>("SeedOnStartup"))
{
    using var scope = app.Services.CreateScope();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        if (dbOptions.GetValue<bool>("MigrateOnStartup"))
        {
            logger.LogInformation("Applying database migrations…");
            await db.Database.MigrateAsync();
        }
        var payHere = app.Services.GetRequiredService<IOptions<PayHereOptions>>().Value;
        logger.LogInformation(payHere.IsConfigured
            ? $"PayHere card payments enabled ({(payHere.UseSandbox ? "sandbox" : "LIVE")}). Notify URL: {(string.IsNullOrWhiteSpace(payHere.NotifyUrl) ? "not set - PayHere can't reach localhost, set PayHere:NotifyUrl to a tunnel URL" : payHere.NotifyUrl)}"
            : "PayHere not configured (PayHere:MerchantId / PayHere:MerchantSecret); card payments are off.");
        if (dbOptions.GetValue<bool>("SeedOnStartup"))
        {
            await scope.ServiceProvider.GetRequiredService<DbSeeder>().SeedAsync();
            logger.LogInformation("Database ready: {Products} products, {Variants} variants",
                await db.Products.CountAsync(), await db.ProductVariants.CountAsync());
        }
    }
    catch (Exception ex)
    {
        logger.LogCritical(ex, "Database initialisation failed. Check ConnectionStrings:DefaultConnection and that SQL Server is running.");
        throw;
    }
}

// ---------------------------------------------------------------- Owner accounts (Admin:OwnerEmails)
using (var ownerScope = app.Services.CreateScope())
{
    try
    {
        await ownerScope.ServiceProvider.GetRequiredService<OwnerAccountSync>().SyncAsync();
    }
    catch (Exception ex)
    {
        ownerScope.ServiceProvider.GetRequiredService<ILogger<Program>>().LogError(ex, "Couldn't apply Admin:OwnerEmails at startup; roles are still applied at sign-in.");
    }
}

// ---------------------------------------------------------------- Pipeline
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseMiddleware<RequestLoggingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(ui =>
    {
        ui.SwaggerEndpoint("/swagger/v1/swagger.json", "Nishoes API v1");
        ui.DocumentTitle = "Nishoes API";
        ui.EnablePersistAuthorization();
        ui.DisplayRequestDuration();
    });
}
else
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

// Uploaded product images (local storage). Only image types are served; files can't be listed or executed.
if (app.Services.GetRequiredService<ShoeStore.Application.Abstractions.IFileStorage>() is ShoeStore.Infrastructure.Storage.LocalFileStorage localStorage)
{
    var storageOptions = app.Services.GetRequiredService<IOptions<StorageOptions>>().Value;
    if (storageOptions.PublicBaseUrl.StartsWith('/'))
    {
        var contentTypes = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
        contentTypes.Mappings.Clear();
        contentTypes.Mappings[".jpg"] = "image/jpeg";
        contentTypes.Mappings[".jpeg"] = "image/jpeg";
        contentTypes.Mappings[".png"] = "image/png";
        contentTypes.Mappings[".webp"] = "image/webp";
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(localStorage.RootPath),
            RequestPath = storageOptions.PublicBaseUrl.TrimEnd('/'),
            ContentTypeProvider = contentTypes,
            ServeUnknownFileTypes = false,
            OnPrepareResponse = ctx =>
            {
                ctx.Context.Response.Headers.XContentTypeOptions = "nosniff";
                ctx.Context.Response.Headers.CacheControl = "public, max-age=2592000, immutable";
                ctx.Context.Response.Headers.ContentSecurityPolicy = "default-src 'none'";
            },
        });
    }
}

app.UseCors("Frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");
app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();

app.Run();

/// <summary>Named rate-limit policies.</summary>
public static class RateLimitPolicies
{
    public const string Auth = "auth";
    public const string Checkout = "checkout";
}

public partial class Program
{
}
