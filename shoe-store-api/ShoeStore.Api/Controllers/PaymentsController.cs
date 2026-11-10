using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ShoeStore.Application.Abstractions;
using ShoeStore.Application.Dtos;
using ShoeStore.Application.Services;

namespace ShoeStore.Api.Controllers;

/// <summary>
/// Card payments through PayHere hosted checkout. Card details are entered on PayHere's page and never
/// reach this API. Orders become <c>paid</c> only after a verified server-to-server notification.
/// </summary>
[ApiController]
[Route("api/v1/payments")]
[Tags("Payments")]
[Produces("application/json")]
public sealed class PaymentsController(IPaymentService payments, ICurrentUser user, ILogger<PaymentsController> logger) : ControllerBase
{
    /// <summary>Payment methods the storefront can offer.</summary>
    [HttpGet("options")]
    public ActionResult<PaymentOptionsDto> Options() => Ok(payments.GetOptions());

    /// <summary>Signed form fields for PayHere hosted checkout.</summary>
    /// <remarks>
    /// The browser posts these fields to <c>actionUrl</c>. The hash is computed here so the merchant secret stays
    /// on the server. Signed-in customers can pay for their own orders; guests send the checkout email.
    /// </remarks>
    [HttpPost("payhere/checkout")]
    [EnableRateLimiting(RateLimitPolicies.Checkout)]
    [ProducesResponseType<HostedCheckoutDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<HostedCheckoutDto>> StartPayHere(StartPayHereCheckoutRequest request, CancellationToken ct)
    {
        var fallbackNotify = $"{Request.Scheme}://{Request.Host}/api/v1/payments/payhere/notify";
        return Ok(await payments.CreatePayHereCheckoutAsync(request.OrderNumber, user.CustomerId, request.Email, fallbackNotify, ct));
    }

    /// <summary>PayHere server-to-server payment notification (notify_url).</summary>
    /// <remarks>Called by PayHere, not by the storefront. The MD5 signature, merchant id, amount and currency are verified.</remarks>
    [AllowAnonymous]
    [HttpPost("payhere/notify")]
    [Consumes("application/x-www-form-urlencoded")]
    [ApiExplorerSettings(IgnoreApi = false)]
    public async Task<IActionResult> PayHereNotify(CancellationToken ct)
    {
        if (!Request.HasFormContentType) return BadRequest();
        var form = await Request.ReadFormAsync(ct);
        var values = form.ToDictionary(kv => kv.Key, kv => kv.Value.ToString(), StringComparer.OrdinalIgnoreCase);
        logger.LogInformation("PayHere notify received for order {OrderId}, status {StatusCode}",
            values.GetValueOrDefault("order_id"), values.GetValueOrDefault("status_code"));
        return await payments.HandlePayHereNotificationAsync(values, ct) ? Ok() : BadRequest();
    }
}
