using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ShoeStore.Api.Infrastructure;
using ShoeStore.Application.Abstractions;
using ShoeStore.Application.Dtos;
using ShoeStore.Application.Services;

namespace ShoeStore.Api.Controllers;

/// <summary>
/// Registration, sign-in and sessions. Access tokens (15 min JWT) are returned in the body;
/// refresh tokens are set as an HttpOnly, SameSite=Strict cookie scoped to /api/v1/auth.
/// </summary>
[ApiController]
[Route("api/v1/auth")]
[Tags("Authentication")]
[Produces("application/json")]
public sealed class AuthController(IAuthService auth, ICurrentUser user, IHostEnvironment env) : ControllerBase
{
    private bool SecureCookies => Request.IsHttps || !env.IsDevelopment();

    private AuthResponse Complete(AuthResult result)
    {
        Response.SetRefreshCookie(result.RefreshToken, result.RefreshTokenExpiresUtc, SecureCookies);
        return result.Response;
    }

    /// <summary>Create a customer account and sign in.</summary>
    [HttpPost("register")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, Complete(await auth.RegisterAsync(request, ct)));

    /// <summary>Sign in with email and password.</summary>
    /// <remarks>Five failed attempts lock the account for 15 minutes.</remarks>
    [HttpPost("login")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken ct) =>
        Ok(Complete(await auth.LoginAsync(request, ct)));

    /// <summary>Get a new access token using the refresh-token cookie (rotates the refresh token).</summary>
    [HttpPost("refresh")]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Refresh(CancellationToken ct)
    {
        var token = Request.Cookies[HttpContextExtensions.RefreshCookieName];
        if (string.IsNullOrWhiteSpace(token))
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Unauthorized", detail: "You're not signed in.");
        try
        {
            return Ok(Complete(await auth.RefreshAsync(token, ct)));
        }
        catch
        {
            Response.ClearRefreshCookie(SecureCookies);
            throw;
        }
    }

    /// <summary>Sign out: revokes the refresh token and clears the cookie.</summary>
    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        await auth.LogoutAsync(Request.Cookies[HttpContextExtensions.RefreshCookieName], ct);
        Response.ClearRefreshCookie(SecureCookies);
        return NoContent();
    }

    /// <summary>Change password. Signs out every other session.</summary>
    [Authorize]
    [HttpPost("change-password")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken ct)
    {
        await auth.ChangePasswordAsync(user.CustomerId!.Value, request, ct);
        Response.ClearRefreshCookie(SecureCookies);
        return NoContent();
    }
}

/// <summary>The signed-in customer's profile and address book.</summary>
[ApiController]
[Authorize]
[Route("api/v1/customers")]
[Tags("Customers")]
[Produces("application/json")]
public sealed class CustomersController(ICustomerService customers, ICurrentUser user) : ControllerBase
{
    private Guid CustomerId => user.CustomerId!.Value;

    /// <summary>Get the current customer's profile.</summary>
    [HttpGet("profile")]
    public async Task<ActionResult<CustomerDto>> GetProfile(CancellationToken ct) => Ok(await customers.GetProfileAsync(CustomerId, ct));

    /// <summary>Update name, phone, preferred size and marketing preference.</summary>
    [HttpPut("profile")]
    public async Task<ActionResult<CustomerDto>> UpdateProfile(UpdateProfileRequest request, CancellationToken ct) =>
        Ok(await customers.UpdateProfileAsync(CustomerId, request, ct));

    /// <summary>List saved addresses (default first).</summary>
    [HttpGet("addresses")]
    public async Task<ActionResult<IReadOnlyList<AddressDto>>> GetAddresses(CancellationToken ct) =>
        Ok(await customers.GetAddressesAsync(CustomerId, ct));

    /// <summary>Add an address.</summary>
    [HttpPost("addresses")]
    [ProducesResponseType<AddressDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<AddressDto>> AddAddress(AddressRequest request, CancellationToken ct)
    {
        var address = await customers.AddAddressAsync(CustomerId, request, ct);
        return StatusCode(StatusCodes.Status201Created, address);
    }

    /// <summary>Update an address you own.</summary>
    [HttpPut("addresses/{id:int}")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AddressDto>> UpdateAddress(int id, AddressRequest request, CancellationToken ct) =>
        Ok(await customers.UpdateAddressAsync(CustomerId, id, request, ct));

    /// <summary>Delete an address you own.</summary>
    [HttpDelete("addresses/{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteAddress(int id, CancellationToken ct)
    {
        await customers.DeleteAddressAsync(CustomerId, id, ct);
        return NoContent();
    }

    /// <summary>Make an address the default for delivery.</summary>
    [HttpPut("addresses/{id:int}/default")]
    public async Task<ActionResult<AddressDto>> SetDefault(int id, CancellationToken ct) =>
        Ok(await customers.SetDefaultAddressAsync(CustomerId, id, ct));
}
