using Microsoft.Extensions.Logging.Abstractions;
using ShoeStore.Application.Options;
using ShoeStore.Application.Services;

namespace ShoeStore.Tests;

public class PayHereSignatureTests
{
    // Expected values computed independently (Python hashlib) for merchant 1211149 / secret "test-secret".
    private static PaymentService Create() => new(
        null!, null!,
        Microsoft.Extensions.Options.Options.Create(new PayHereOptions { MerchantId = "1211149", MerchantSecret = "test-secret" }),
        Microsoft.Extensions.Options.Options.Create(new PaymentOptions()),
        null!,
        NullLogger<PaymentService>.Instance);

    [Theory]
    [InlineData(45900, "45900.00")]
    [InlineData(1234.5, "1234.50")]
    [InlineData(0.1, "0.10")]
    public void Amounts_use_two_decimals_without_grouping(decimal amount, string expected) =>
        Assert.Equal(expected, PaymentService.FormatAmount(amount));

    [Fact]
    public void Checkout_hash_matches_payhere_formula() =>
        Assert.Equal("4F447433030FD5FDC7F846A596BD6A67", Create().CheckoutHash("NS-2611-00001", "45900.00", "LKR"));

    [Fact]
    public void Notify_signature_matches_payhere_formula() =>
        Assert.Equal("70999DE3FB7EB928B24E0DD7C42DB564", Create().NotifySignature("1211149", "NS-2611-00001", "45900.00", "LKR", "2"));
}
