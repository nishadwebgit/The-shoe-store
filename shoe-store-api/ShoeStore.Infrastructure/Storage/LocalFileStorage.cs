using System.Security.Cryptography;
using Microsoft.Extensions.Options;
using ShoeStore.Application.Abstractions;
using ShoeStore.Application.Options;

namespace ShoeStore.Infrastructure.Storage;

/// <summary>
/// Stores uploads on the API server's disk under <see cref="StorageOptions.LocalRootPath"/>, served at
/// <see cref="StorageOptions.PublicBaseUrl"/>. Keys look like "products/2026/11/3f2a….webp": random names,
/// no user-supplied path segments. Replace with a cloud implementation of <see cref="IFileStorage"/> for production.
/// </summary>
public sealed class LocalFileStorage : IFileStorage
{
    private readonly string _root;
    private readonly string _baseUrl;

    public LocalFileStorage(IOptions<StorageOptions> options, string contentRoot)
    {
        var o = options.Value;
        _root = Path.GetFullPath(Path.IsPathRooted(o.LocalRootPath) ? o.LocalRootPath : Path.Combine(contentRoot, o.LocalRootPath));
        _baseUrl = o.PublicBaseUrl.TrimEnd('/');
        Directory.CreateDirectory(_root);
    }

    public string RootPath => _root;

    public async Task<StoredFile> SaveAsync(Stream content, string extension, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var name = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant() + extension;
        var key = $"products/{now:yyyy}/{now:MM}/{name}";
        var path = ResolvePath(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using (var file = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true))
            await content.CopyToAsync(file, ct);
        return new StoredFile(key, $"{_baseUrl}/{key}");
    }

    public Task DeleteAsync(string key, CancellationToken ct)
    {
        var path = ResolvePath(key);
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }

    public string? KeyFromUrl(string url)
    {
        var prefix = _baseUrl + "/";
        if (!url.StartsWith(prefix, StringComparison.Ordinal)) return null;
        var key = url[prefix.Length..];
        try { ResolvePath(key); }
        catch (InvalidOperationException) { return null; }
        return File.Exists(ResolvePath(key)) ? key : null;
    }

    /// <summary>Maps a key to a path inside the root, rejecting anything that would escape it.</summary>
    private string ResolvePath(string key)
    {
        if (key.Contains("..", StringComparison.Ordinal) || key.Contains('\\') || Path.IsPathRooted(key))
            throw new InvalidOperationException("Invalid storage key.");
        var full = Path.GetFullPath(Path.Combine(_root, key));
        if (!full.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.Ordinal))
            throw new InvalidOperationException("Invalid storage key.");
        return full;
    }
}
