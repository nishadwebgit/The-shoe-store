namespace ShoeStore.Application.Common;

/// <summary>
/// Base for errors whose message is safe to show to shoppers. The API turns these into
/// RFC 7807 ProblemDetails responses with the matching HTTP status code.
/// </summary>
public abstract class AppException : Exception
{
    protected AppException(string message, string code) : base(message)
    {
        Code = code;
    }

    public string Code { get; }
    public abstract int StatusCode { get; }
}

public sealed class NotFoundException(string message, string code = "not_found") : AppException(message, code)
{
    public override int StatusCode => 404;
}

/// <summary>The request conflicts with current state, e.g. not enough stock or a duplicate email.</summary>
public sealed class ConflictException(string message, string code = "conflict") : AppException(message, code)
{
    public override int StatusCode => 409;
}

/// <summary>A business rule rejected an otherwise well-formed request.</summary>
public sealed class BusinessRuleException(string message, string code = "invalid_request") : AppException(message, code)
{
    public override int StatusCode => 400;
}

public sealed class UnauthorizedException(string message, string code = "unauthorized") : AppException(message, code)
{
    public override int StatusCode => 401;
}

public sealed class ForbiddenException(string message, string code = "forbidden") : AppException(message, code)
{
    public override int StatusCode => 403;
}

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount, int TotalPages)
{
    public static PagedResult<T> Create(IReadOnlyList<T> items, int page, int pageSize, int totalCount)
    {
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        return new PagedResult<T>(items, page, pageSize, totalCount, totalPages);
    }
}

/// <summary>Identifies whose cart a request is about: a signed-in customer or an anonymous visitor.</summary>
public sealed record CartOwner(Guid? CustomerId, Guid? AnonymousToken)
{
    public bool HasOwner => CustomerId.HasValue || AnonymousToken.HasValue;
}
