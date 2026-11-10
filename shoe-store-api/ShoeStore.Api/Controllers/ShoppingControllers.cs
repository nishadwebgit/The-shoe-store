using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ShoeStore.Api.Infrastructure;
using ShoeStore.Application.Abstractions;
using ShoeStore.Application.Common;
using ShoeStore.Application.Dtos;
using ShoeStore.Application.Services;

namespace ShoeStore.Api.Controllers;

/// <summary>
/// Shopping bag. Signed-in customers use their own cart (Bearer token). Guests get an anonymous
/// cart token in the response (<c>cartToken</c>) and send it back in the <c>X-Cart-Token</c> header.
/// </summary>
[ApiController]
[Route("api/v1/cart")]
[Tags("Cart")]
[Produces("application/json")]
public sealed class CartController(ICartService carts, ICurrentUser user) : ControllerBase
{
    private CartOwner Owner => new(user.CustomerId, user.IsAuthenticated ? null : Request.GetCartToken());

    /// <summary>Get the current cart with server-calculated totals.</summary>
    /// <param name="deliveryMethod">Optional delivery method used for the shipping estimate (standard, express, pickup).</param>
    [HttpGet]
    public async Task<ActionResult<CartDto>> Get([FromQuery] string? deliveryMethod, CancellationToken ct) =>
        Ok(await carts.GetAsync(Owner, deliveryMethod, ct));

    /// <summary>Add a product variant (colour + size) to the cart. Validates stock.</summary>
    [HttpPost("items")]
    [ProducesResponseType<CartDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CartDto>> AddItem(AddCartItemRequest request, CancellationToken ct) =>
        Ok(await carts.AddItemAsync(Owner, request, ct));

    /// <summary>Change the quantity of a line (identified by SKU).</summary>
    [HttpPut("items/{sku}")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CartDto>> UpdateItem(string sku, UpdateCartItemRequest request, CancellationToken ct) =>
        Ok(await carts.UpdateQuantityAsync(Owner, sku, request.Quantity, ct));

    /// <summary>Remove a line from the cart.</summary>
    [HttpDelete("items/{sku}")]
    public async Task<ActionResult<CartDto>> RemoveItem(string sku, CancellationToken ct) =>
        Ok(await carts.RemoveItemAsync(Owner, sku, ct));

    /// <summary>Remove everything from the cart.</summary>
    [HttpDelete]
    public async Task<ActionResult<CartDto>> Clear(CancellationToken ct) => Ok(await carts.ClearAsync(Owner, ct));

    /// <summary>Apply a discount code to the cart.</summary>
    [HttpPost("coupon")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CartDto>> ApplyCoupon(ApplyCouponRequest request, CancellationToken ct) =>
        Ok(await carts.ApplyCouponAsync(Owner, request.Code, ct));

    /// <summary>Remove the discount code.</summary>
    [HttpDelete("coupon")]
    public async Task<ActionResult<CartDto>> RemoveCoupon(CancellationToken ct) => Ok(await carts.RemoveCouponAsync(Owner, ct));

    /// <summary>After sign-in: move the guest cart (X-Cart-Token header) into the customer's cart.</summary>
    [Authorize]
    [HttpPost("merge")]
    public async Task<ActionResult<CartDto>> Merge(CancellationToken ct)
    {
        var token = Request.GetCartToken();
        if (token is null) return Ok(await carts.GetAsync(new CartOwner(user.CustomerId, null), null, ct));
        return Ok(await carts.MergeAnonymousCartAsync(user.CustomerId!.Value, token.Value, ct));
    }
}

/// <summary>Saved products for signed-in customers.</summary>
[ApiController]
[Authorize]
[Route("api/v1/wishlist")]
[Tags("Wishlist")]
[Produces("application/json")]
public sealed class WishlistController(IWishlistService wishlist, ICurrentUser user) : ControllerBase
{
    private Guid CustomerId => user.CustomerId!.Value;

    /// <summary>Get the customer's wishlist.</summary>
    [HttpGet]
    public async Task<ActionResult<WishlistDto>> Get(CancellationToken ct) => Ok(await wishlist.GetAsync(CustomerId, ct));

    /// <summary>Save a product. Saving the same product twice has no effect.</summary>
    [HttpPost("items")]
    public async Task<ActionResult<WishlistDto>> Add(AddWishlistItemRequest request, CancellationToken ct) =>
        Ok(await wishlist.AddAsync(CustomerId, request.ProductId, ct));

    /// <summary>Remove a saved product.</summary>
    [HttpDelete("items/{productId}")]
    public async Task<ActionResult<WishlistDto>> Remove(string productId, CancellationToken ct) =>
        Ok(await wishlist.RemoveAsync(CustomerId, productId, ct));

    /// <summary>Remove all saved products.</summary>
    [HttpDelete]
    public async Task<ActionResult<WishlistDto>> Clear(CancellationToken ct) => Ok(await wishlist.ClearAsync(CustomerId, ct));

    /// <summary>After sign-in: add products saved while browsing as a guest.</summary>
    [HttpPost("merge")]
    public async Task<ActionResult<WishlistDto>> Merge(MergeWishlistRequest request, CancellationToken ct) =>
        Ok(await wishlist.MergeAsync(CustomerId, request.ProductIds, ct));
}

/// <summary>Checkout. Card payment happens afterwards on PayHere's hosted page; no card data is accepted or stored here.</summary>
[ApiController]
[Route("api/v1/checkout")]
[Tags("Checkout")]
[Produces("application/json")]
public sealed class CheckoutController(ICheckoutService checkout, ICurrentUser user) : ControllerBase
{
    private CartOwner Owner => new(user.CustomerId, user.IsAuthenticated ? null : Request.GetCartToken());

    /// <summary>Price the current cart for a delivery method and optional coupon (no changes are made).</summary>
    [HttpPost("quote")]
    public async Task<ActionResult<CartTotalsDto>> Quote(CheckoutQuoteRequest request, CancellationToken ct) =>
        Ok(await checkout.QuoteAsync(Owner, request, ct));

    /// <summary>Place an order from the current cart.</summary>
    /// <remarks>
    /// Prices, discounts, shipping and totals are recalculated on the server. Stock is reserved atomically;
    /// a 409 is returned if anything sold out in the meantime. With <c>paymentMethod: "payhere"</c> the order is <c>pending</c>
    /// until PayHere confirms payment (start it with POST /api/v1/payments/payhere/checkout); <c>"simulated"</c> is development only.
    /// </remarks>
    [HttpPost]
    [EnableRateLimiting(RateLimitPolicies.Checkout)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderDto>> PlaceOrder(CheckoutRequest request, CancellationToken ct)
    {
        var order = await checkout.PlaceOrderAsync(Owner, request, ct);
        return CreatedAtAction(nameof(OrdersController.Get), "Orders", new { orderNumber = order.OrderNumber }, order);
    }
}

/// <summary>Order history and details.</summary>
[ApiController]
[Route("api/v1/orders")]
[Tags("Orders")]
[Produces("application/json")]
public sealed class OrdersController(IOrderService orders, ICurrentUser user) : ControllerBase
{
    /// <summary>The signed-in customer's orders, newest first (paged).</summary>
    [Authorize]
    [HttpGet]
    public async Task<ActionResult<PagedResult<OrderDto>>> GetMine([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(await orders.GetForCustomerAsync(user.CustomerId!.Value, page, pageSize, ct));

    /// <summary>One order with items, address, totals and status history.</summary>
    /// <remarks>Customers can only read their own orders. Guest orders need the checkout email: <c>?email=</c>.</remarks>
    [HttpGet("{orderNumber}")]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OrderDto>> Get(string orderNumber, [FromQuery] string? email, CancellationToken ct) =>
        Ok(await orders.GetAsync(orderNumber, user.CustomerId, user.IsAdmin, email, ct));

    /// <summary>Order status and delivery estimate.</summary>
    [HttpGet("{orderNumber}/status")]
    public async Task<ActionResult<OrderStatusDto>> Status(string orderNumber, [FromQuery] string? email, CancellationToken ct)
    {
        var order = await orders.GetAsync(orderNumber, user.CustomerId, user.IsAdmin, email, ct);
        return Ok(new OrderStatusDto(order.OrderNumber, order.Status, order.PaymentStatus, order.EstimatedDelivery));
    }

    /// <summary>Items in an order.</summary>
    [HttpGet("{orderNumber}/items")]
    public async Task<ActionResult<IReadOnlyList<OrderLineDto>>> Items(string orderNumber, [FromQuery] string? email, CancellationToken ct) =>
        Ok((await orders.GetAsync(orderNumber, user.CustomerId, user.IsAdmin, email, ct)).Lines);
}

/// <summary>Discount codes and delivery options.</summary>
[ApiController]
[Route("api/v1")]
[Tags("Coupons & shipping")]
[Produces("application/json")]
public sealed class PricingController(ICouponService coupons, IShippingService shipping) : ControllerBase
{
    /// <summary>Check a discount code, optionally against a subtotal to see the discount amount.</summary>
    [HttpGet("coupons/{code}")]
    public async Task<ActionResult<CouponDto>> ValidateCoupon(string code, [FromQuery] decimal? subtotal, CancellationToken ct) =>
        Ok(await coupons.ValidateAsync(code, subtotal, ct));

    /// <summary>Delivery options with fees and estimated delivery dates.</summary>
    /// <param name="subtotal">Order subtotal after discounts, used to apply free delivery.</param>
    /// <param name="district">Delivery district; options that don't serve it are marked unavailable.</param>
    /// <param name="couponCode">Optional coupon (e.g. FREESHIP).</param>
    [HttpGet("shipping-methods")]
    public async Task<ActionResult<IReadOnlyList<ShippingMethodDto>>> ShippingMethods(
        [FromQuery] decimal? subtotal, [FromQuery] string? district, [FromQuery] string? couponCode, CancellationToken ct) =>
        Ok(await shipping.GetMethodsAsync(subtotal, district, couponCode, ct));
}
