namespace ShoeStore.Domain.Common;

/// <summary>Entities that record when they were created and last modified (UTC).</summary>
public interface IAuditable
{
    DateTime CreatedUtc { get; set; }
    DateTime? ModifiedUtc { get; set; }
}

public abstract class AuditableEntity : IAuditable
{
    public DateTime CreatedUtc { get; set; }
    public DateTime? ModifiedUtc { get; set; }
}
