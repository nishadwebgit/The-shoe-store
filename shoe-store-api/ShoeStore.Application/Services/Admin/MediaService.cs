using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ShoeStore.Application.Abstractions;
using ShoeStore.Application.Common;
using ShoeStore.Application.Dtos;
using ShoeStore.Application.Options;

namespace ShoeStore.Application.Services.Admin;

public interface IMediaService
{
    Task<MediaUploadResultDto> UploadImageAsync(Stream content, string fileName, long length, CancellationToken ct);
}

/// <summary>
/// Validates and stores product images. The file's actual bytes decide its type (the browser-supplied
/// name and content type are not trusted), files get random names, and only JPEG, PNG and WebP are accepted.
/// </summary>
public sealed class MediaService(IFileStorage storage, IAdminContext admin, IOptions<StorageOptions> options, ILogger<MediaService> logger) : IMediaService
{
    public async Task<MediaUploadResultDto> UploadImageAsync(Stream content, string fileName, long length, CancellationToken ct)
    {
        var actor = await admin.GetActorAsync(ct);
        var max = options.Value.MaxImageBytes;
        if (length <= 0) throw new BusinessRuleException("The file is empty.", "empty_file");
        if (length > max) throw new BusinessRuleException($"Images can be up to {max / (1024 * 1024)} MB. Resize the photo and try again.", "file_too_large");

        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        if (extension is not (".jpg" or ".jpeg" or ".png" or ".webp"))
            throw new BusinessRuleException("Upload a JPG, PNG or WebP image.", "unsupported_file_type");

        // Read the whole (size-limited) file so the signature can be checked before anything is written.
        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, ct);
        if (buffer.Length > max) throw new BusinessRuleException($"Images can be up to {max / (1024 * 1024)} MB.", "file_too_large");

        var detected = Detect(buffer.GetBuffer().AsSpan(0, (int)Math.Min(buffer.Length, 16)));
        if (detected is null)
            throw new BusinessRuleException("That file isn't a valid JPG, PNG or WebP image.", "invalid_image");

        buffer.Position = 0;
        var stored = await storage.SaveAsync(buffer, detected.Value.Extension, ct);
        logger.LogInformation("Image uploaded by {Actor}: {Key} ({Bytes} bytes)", actor.Name, stored.Key, buffer.Length);
        return new MediaUploadResultDto(stored.Url, stored.Key, buffer.Length, detected.Value.ContentType);
    }

    private static (string Extension, string ContentType)? Detect(ReadOnlySpan<byte> header)
    {
        if (header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF) return (".jpg", "image/jpeg");
        if (header.Length >= 8 && header[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })) return (".png", "image/png");
        if (header.Length >= 12 && header[..4].SequenceEqual("RIFF"u8) && header[8..12].SequenceEqual("WEBP"u8)) return (".webp", "image/webp");
        return null;
    }
}
