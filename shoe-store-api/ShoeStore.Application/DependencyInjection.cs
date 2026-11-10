using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using ShoeStore.Application.Services;
using ShoeStore.Application.Services.Admin;

namespace ShoeStore.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<ICatalogService, CatalogService>();
        services.AddScoped<ICartService, CartService>();
        services.AddScoped<ICheckoutService, CheckoutService>();
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<ICouponService, CouponService>();
        services.AddScoped<IShippingService, ShippingService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ICustomerService, CustomerService>();
        services.AddScoped<IWishlistService, WishlistService>();
        services.AddScoped<IPaymentService, PaymentService>();
        services.AddScoped<IInventoryLedger, InventoryLedger>();

        // Owner Portal
        services.AddScoped<IAdminContext, AdminContext>();
        services.AddScoped<IAdminProductService, AdminProductService>();
        services.AddScoped<IStockReceiptService, StockReceiptService>();
        services.AddScoped<IInventoryAdminService, InventoryAdminService>();
        services.AddScoped<IAdminOrderService, AdminOrderService>();
        services.AddScoped<IMediaService, MediaService>();

        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly, includeInternalTypes: true);
        return services;
    }
}
