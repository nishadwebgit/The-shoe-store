namespace ShoeStore.Application.Options;

/// <summary>Store pricing rules (configuration section "Pricing").</summary>
public sealed class PricingOptions
{
    public const string SectionName = "Pricing";

    public string Currency { get; set; } = "LKR";

    /// <summary>Order value (after discounts) at which eligible delivery becomes free.</summary>
    public decimal FreeShippingThreshold { get; set; } = 25000m;

    /// <summary>Maximum quantity of one SKU per order.</summary>
    public int MaxQuantityPerLine { get; set; } = 10;
}

/// <summary>
/// PayHere payment gateway settings (configuration section "PayHere").
/// MerchantId and MerchantSecret must come from user secrets or environment variables, never appsettings.
/// </summary>
public sealed class PayHereOptions
{
    public const string SectionName = "PayHere";

    public string MerchantId { get; set; } = string.Empty;

    /// <summary>Domain-specific merchant secret from the PayHere portal (Settings → Domains & Credentials).</summary>
    public string MerchantSecret { get; set; } = string.Empty;

    /// <summary>true = sandbox.payhere.lk (test cards only), false = live payments.</summary>
    public bool UseSandbox { get; set; } = true;

    /// <summary>
    /// Public URL PayHere calls with the payment result, e.g. https://xyz.trycloudflare.com/api/v1/payments/payhere/notify.
    /// PayHere cannot reach localhost, so local testing needs a tunnel.
    /// </summary>
    public string NotifyUrl { get; set; } = string.Empty;

    /// <summary>Storefront base URL used for the return and cancel pages.</summary>
    public string FrontendBaseUrl { get; set; } = "http://localhost:5180";

    /// <summary>How long a card order keeps its stock reserved while waiting for payment.</summary>
    public int PaymentWindowMinutes { get; set; } = 30;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(MerchantId) && !string.IsNullOrWhiteSpace(MerchantSecret);

    public string CheckoutUrl => UseSandbox ? "https://sandbox.payhere.lk/pay/checkout" : "https://www.payhere.lk/pay/checkout";
}

/// <summary>General payment settings (configuration section "Payments").</summary>
public sealed class PaymentOptions
{
    public const string SectionName = "Payments";

    /// <summary>Allow the "demo" payment method (no money taken). Development only.</summary>
    public bool AllowSimulated { get; set; }
}

/// <summary>Authentication policy (configuration section "Auth").</summary>
public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 14;
    public int MaxFailedLogins { get; set; } = 5;
    public int LockoutMinutes { get; set; } = 15;
}

/// <summary>Owner Portal access (configuration section "Admin").</summary>
public sealed class AdminOptions
{
    public const string SectionName = "Admin";

    /// <summary>
    /// Email addresses of owner/administrator accounts. Matching customer accounts get the Admin role when the
    /// API starts and when they sign in; accounts not listed lose it. Owners register through the normal sign-up
    /// page, so no passwords are ever stored in configuration.
    /// </summary>
    public string[] OwnerEmails { get; set; } = [];
}

/// <summary>Uploaded file storage (configuration section "Storage").</summary>
public sealed class StorageOptions
{
    public const string SectionName = "Storage";

    /// <summary>"Local" (default). Add a cloud provider by implementing IFileStorage.</summary>
    public string Provider { get; set; } = "Local";

    /// <summary>Folder for local uploads; relative paths are resolved against the API's content root.</summary>
    public string LocalRootPath { get; set; } = "uploads";

    /// <summary>URL path (or absolute CDN base URL) under which uploaded files are served.</summary>
    public string PublicBaseUrl { get; set; } = "/media";

    /// <summary>Largest accepted image, in bytes.</summary>
    public long MaxImageBytes { get; set; } = 5 * 1024 * 1024;

    /// <summary>Most images allowed per colourway.</summary>
    public int MaxImagesPerColour { get; set; } = 12;
}
