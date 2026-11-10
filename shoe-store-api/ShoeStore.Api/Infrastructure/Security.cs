using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using ShoeStore.Application.Abstractions;
using ShoeStore.Application.Options;
using ShoeStore.Domain.Entities;
using ShoeStore.Domain.Enums;

namespace ShoeStore.Api.Infrastructure;

/// <summary>JWT settings (configuration section "Jwt"). The signing key must come from user secrets or the environment.</summary>
public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "nishoes-api";
    public string Audience { get; set; } = "nishoes-web";

    /// <summary>At least 32 bytes when UTF-8 encoded (HS256).</summary>
    public string SigningKey { get; set; } = string.Empty;

    public SymmetricSecurityKey CreateKey() => new(Encoding.UTF8.GetBytes(SigningKey));
}

/// <summary>Issues HS256-signed access tokens and random refresh tokens (stored only as SHA-256 hashes).</summary>
public sealed class TokenService(IOptions<JwtOptions> jwtOptions, IOptions<AuthOptions> authOptions, IClock clock) : ITokenService
{
    private readonly JsonWebTokenHandler _handler = new();

    public AccessToken CreateAccessToken(Customer customer)
    {
        var jwt = jwtOptions.Value;
        var now = clock.UtcNow;
        var expires = now.AddMinutes(authOptions.Value.AccessTokenMinutes);

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = jwt.Issuer,
            Audience = jwt.Audience,
            IssuedAt = now,
            NotBefore = now,
            Expires = expires,
            SigningCredentials = new SigningCredentials(jwt.CreateKey(), SecurityAlgorithms.HmacSha256),
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, customer.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, customer.Email),
                new Claim(JwtRegisteredClaimNames.GivenName, customer.FirstName),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
                new Claim(ClaimTypes.Role, customer.Role.ToString()),
            }),
        };

        return new AccessToken(_handler.CreateToken(descriptor), expires);
    }

    public string CreateRefreshToken() => Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(64));

    public string HashToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}

/// <summary>Reads the caller's identity from the validated JWT.</summary>
public sealed class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public Guid? CustomerId
    {
        get
        {
            var sub = Principal?.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(sub, out var id) ? id : null;
        }
    }

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true && CustomerId.HasValue;

    public bool IsAdmin => Principal?.IsInRole(CustomerRole.Admin.ToString()) == true;

    public string? IpAddress => accessor.HttpContext?.Connection.RemoteIpAddress?.ToString();
}

/// <summary>Helpers for the refresh-token cookie and the anonymous cart header.</summary>
public static class HttpContextExtensions
{
    public const string RefreshCookieName = "nishoes_rt";
    public const string RefreshCookiePath = "/api/v1/auth";
    public const string CartTokenHeader = "X-Cart-Token";

    public static void SetRefreshCookie(this HttpResponse response, string token, DateTime expiresUtc, bool secure) =>
        response.Cookies.Append(RefreshCookieName, token, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Strict,
            Path = RefreshCookiePath,
            Expires = expiresUtc,
            IsEssential = true,
        });

    public static void ClearRefreshCookie(this HttpResponse response, bool secure) =>
        response.Cookies.Delete(RefreshCookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Strict,
            Path = RefreshCookiePath,
        });

    public static Guid? GetCartToken(this HttpRequest request) =>
        request.Headers.TryGetValue(CartTokenHeader, out var value) && Guid.TryParse(value.ToString(), out var token) ? token : null;
}
