using System.Diagnostics;
using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using ShoeStore.Application.Common;

namespace ShoeStore.Api.Infrastructure;

/// <summary>
/// Converts exceptions into RFC 7807 ProblemDetails. Known application errors keep their
/// shopper-facing message; anything unexpected is logged and returned as a generic 500 without
/// internal details (no stack traces, SQL or configuration values).
/// </summary>
public sealed class GlobalExceptionHandler(IProblemDetailsService problemDetails, ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        int status;
        string title;
        string detail;
        string code;

        switch (exception)
        {
            case AppException app:
                status = app.StatusCode;
                title = TitleFor(status);
                detail = app.Message;
                code = app.Code;
                if (status == StatusCodes.Status409Conflict)
                    logger.LogWarning("Conflict ({Code}) on {Method} {Path}: {Message}", app.Code, context.Request.Method, context.Request.Path, app.Message);
                else
                    logger.LogInformation("Request rejected ({Code}) on {Method} {Path}", app.Code, context.Request.Method, context.Request.Path);
                break;

            case DbUpdateConcurrencyException:
                status = StatusCodes.Status409Conflict;
                title = TitleFor(status);
                detail = "Someone else changed this at the same time. Refresh and try again.";
                code = "concurrency_conflict";
                logger.LogWarning(exception, "Concurrency conflict on {Method} {Path}", context.Request.Method, context.Request.Path);
                break;

            case DbUpdateException:
                status = StatusCodes.Status409Conflict;
                title = TitleFor(status);
                detail = "We couldn't save your change because it conflicts with existing data. Refresh and try again.";
                code = "database_conflict";
                logger.LogError(exception, "Database update failed on {Method} {Path}", context.Request.Method, context.Request.Path);
                break;

            case BadHttpRequestException bad:
                status = bad.StatusCode;
                title = TitleFor(status);
                detail = "The request couldn't be read. Check the JSON body and parameters.";
                code = "bad_request";
                break;

            case OperationCanceledException when context.RequestAborted.IsCancellationRequested:
                status = 499;
                title = "Client closed request";
                detail = "The request was cancelled.";
                code = "cancelled";
                break;

            default:
                status = StatusCodes.Status500InternalServerError;
                title = TitleFor(status);
                detail = "Something went wrong on our side. Try again in a moment.";
                code = "server_error";
                logger.LogError(exception, "Unhandled exception on {Method} {Path}", context.Request.Method, context.Request.Path);
                break;
        }

        context.Response.StatusCode = status;
        var problem = new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = detail,
            Type = $"https://httpstatuses.io/{status}",
            Instance = context.Request.Path,
        };
        problem.Extensions["code"] = code;
        problem.Extensions["traceId"] = Activity.Current?.Id ?? context.TraceIdentifier;

        return await problemDetails.TryWriteAsync(new ProblemDetailsContext { HttpContext = context, ProblemDetails = problem, Exception = exception });
    }

    private static string TitleFor(int status) => status switch
    {
        400 => "Bad request",
        401 => "Unauthorized",
        403 => "Forbidden",
        404 => "Not found",
        409 => "Conflict",
        429 => "Too many requests",
        _ => "Server error",
    };
}

/// <summary>
/// Runs the registered FluentValidation validator for every action argument and returns a
/// 400 ValidationProblemDetails (field → messages) when anything is invalid.
/// </summary>
public sealed class FluentValidationFilter(IServiceProvider services, ILogger<FluentValidationFilter> logger) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var errors = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);

        foreach (var argument in context.ActionArguments.Values)
        {
            if (argument is null) continue;
            var validatorType = typeof(IValidator<>).MakeGenericType(argument.GetType());
            if (services.GetService(validatorType) is not IValidator validator) continue;

            var result = await validator.ValidateAsync(new ValidationContext<object>(argument), context.HttpContext.RequestAborted);
            foreach (var failure in result.Errors)
            {
                var key = ToCamelCase(failure.PropertyName);
                if (!errors.TryGetValue(key, out var list)) errors[key] = list = [];
                if (!list.Contains(failure.ErrorMessage)) list.Add(failure.ErrorMessage);
            }
        }

        if (errors.Count > 0)
        {
            logger.LogInformation("Validation failed on {Method} {Path}: {Fields}", context.HttpContext.Request.Method,
                context.HttpContext.Request.Path, string.Join(", ", errors.Keys));
            var problem = new ValidationProblemDetails(errors.ToDictionary(e => e.Key, e => e.Value.ToArray()))
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Check the highlighted fields",
                Detail = errors.Values.First().First(),
                Type = "https://httpstatuses.io/400",
                Instance = context.HttpContext.Request.Path,
            };
            problem.Extensions["code"] = "validation_failed";
            context.Result = new BadRequestObjectResult(problem);
            return;
        }

        await next();
    }

    private static string ToCamelCase(string propertyPath) =>
        string.Join('.', propertyPath.Split('.').Select(p => p.Length == 0 ? p : char.ToLowerInvariant(p[0]) + p[1..]));
}

/// <summary>Structured request log: method, path, status and duration. Never logs bodies, tokens or cookies.</summary>
public sealed class RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var started = Stopwatch.GetTimestamp();
        try
        {
            await next(context);
        }
        finally
        {
            var elapsed = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
            var level = context.Response.StatusCode >= 500 ? LogLevel.Error
                : context.Response.StatusCode >= 400 ? LogLevel.Warning
                : LogLevel.Information;
            if (context.Request.Path.StartsWithSegments("/api"))
                logger.Log(level, "HTTP {Method} {Path} responded {StatusCode} in {Elapsed:0.0} ms",
                    context.Request.Method, context.Request.Path, context.Response.StatusCode, elapsed);
        }
    }
}
