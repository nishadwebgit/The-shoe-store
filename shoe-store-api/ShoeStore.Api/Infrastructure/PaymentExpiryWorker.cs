using ShoeStore.Application.Services;

namespace ShoeStore.Api.Infrastructure;

/// <summary>Every minute, cancels card orders that weren't paid in time and returns their stock.</summary>
public sealed class PaymentExpiryWorker(IServiceScopeFactory scopes, ILogger<PaymentExpiryWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<IPaymentService>().ExpireUnpaidOrdersAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Expiring unpaid orders failed; will retry");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
