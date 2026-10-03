using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using System.Threading.RateLimiting;
using Halici.Web;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
var dataRoot = Path.GetFullPath(builder.Configuration["DataDirectory"] ?? Path.Combine(builder.Environment.ContentRootPath, "App_Data"));
Directory.CreateDirectory(dataRoot);
var uploadRoot = Path.Combine(dataRoot, "uploads");
Directory.CreateDirectory(uploadRoot);
builder.Services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(dataRoot, "keys")));
builder.Services.AddSingleton(new Catalog(Path.Combine(dataRoot, "catalog.db")));
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(o =>
{
    o.Cookie.Name = "Halici.Admin";
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    o.ExpireTimeSpan = TimeSpan.FromHours(8);
    o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; };
});
builder.Services.AddAuthorization(o => o.AddPolicy("Admin", p => p.RequireRole("Admin")));
builder.Services.AddAntiforgery(o => { o.HeaderName = "X-CSRF-TOKEN"; o.Cookie.SameSite = SameSiteMode.Strict; });
builder.Services.Configure<FormOptions>(o => o.MultipartBodyLengthLimit = 40 * 1024 * 1024);
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 40 * 1024 * 1024);
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddPolicy("login", c => RateLimitPartition.GetFixedWindowLimiter(c.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new FixedWindowRateLimiterOptions
    { PermitLimit = 5, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});

var hasher = new PasswordHasher<string>();
var username = builder.Configuration["Admin:Username"] ?? "admin";
var password = builder.Configuration["Admin:Password"];
string passwordHash;
if (!string.IsNullOrWhiteSpace(password))
{
    if (password.Length < 12) throw new InvalidOperationException("Admin:Password en az 12 karakter olmalıdır.");
    passwordHash = hasher.HashPassword(username, password);
}
else if (builder.Environment.IsDevelopment())
{
    var credentialPath = Path.Combine(dataRoot, "development-admin.json");
    if (File.Exists(credentialPath))
    {
        var credentials = JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(credentialPath))!;
        username = credentials["username"];
        passwordHash = credentials["hash"];
    }
    else
    {
        password = Convert.ToBase64String(RandomNumberGenerator.GetBytes(18));
        passwordHash = hasher.HashPassword(username, password);
        File.WriteAllText(credentialPath, JsonSerializer.Serialize(new { username, hash = passwordHash }));
        File.WriteAllText(Path.Combine(dataRoot, "initial-admin.txt"), $"Kullanıcı adı: {username}\nParola: {password}\nBu dosyayı güvenli yerde saklayın; Git'e eklenmez.\n");
    }
}
else throw new InvalidOperationException("Üretimde Admin__Password ortam değişkeni gereklidir.");

var app = builder.Build();
app.UseExceptionHandler(error => error.Run(async context =>
{
    context.Response.StatusCode = 500;
    await context.Response.WriteAsJsonAsync(new { error = "İşlem tamamlanamadı. Lütfen tekrar deneyin." });
}));
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
    if (context.Request.Path.StartsWithSegments("/api")) context.Response.Headers.CacheControl = "no-store";
    await next();
});
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(uploadRoot), RequestPath = "/uploads" });
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
// Every modifying API request, including login, requires a same-origin antiforgery token.
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api") && !HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method))
    {
        try { await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context); }
        catch (AntiforgeryValidationException) { context.Response.StatusCode = 400; await context.Response.WriteAsJsonAsync(new { error = "Oturum doğrulanamadı. Sayfayı yenileyin." }); return; }
    }
    await next();
});
app.MapGet("/api/csrf", (HttpContext c, IAntiforgery a) => Results.Ok(new { token = a.GetAndStoreTokens(c).RequestToken }));
app.MapGet("/api/products", (Catalog db) => db.All());
app.MapGet("/api/auth/me", (HttpContext c) => Results.Ok(new { authenticated = c.User.Identity?.IsAuthenticated == true, username = c.User.Identity?.Name }));
app.MapPost("/api/auth/login", async (LoginInput input, HttpContext c) =>
{
    if (input.Password is null || input.Password.Length > 512 || hasher.VerifyHashedPassword(username, passwordHash, input.Password) == PasswordVerificationResult.Failed || input.Username != username)
        return Results.Json(new { error = "Kullanıcı adı veya parola hatalı." }, statusCode: 401);
    var identity = new ClaimsIdentity([new Claim(ClaimTypes.Name, username), new Claim(ClaimTypes.Role, "Admin")], CookieAuthenticationDefaults.AuthenticationScheme);
    await c.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));
    return Results.Ok(new { username });
}).RequireRateLimiting("login");
app.MapPost("/api/auth/logout", async (HttpContext c) => { await c.SignOutAsync(); return Results.NoContent(); }).RequireAuthorization("Admin");
var writeLock = new SemaphoreSlim(1, 1);
app.MapPost("/api/admin/products/{id:long}", async (long id, HttpRequest request, Catalog db) =>
{
    await writeLock.WaitAsync();
    var created = new List<string>();
    try
    {
        var old = id == 0 ? null : db.Find(id);
        if (id != 0 && old is null) return Results.NotFound();
        if (!request.HasFormContentType) return Results.BadRequest(new { error = "Ürün formu bekleniyor." });
        var form = await request.ReadFormAsync();
        RugInput? input;
        try { input = JsonSerializer.Deserialize<RugInput>(form["data"].ToString(), new JsonSerializerOptions(JsonSerializerDefaults.Web)); }
        catch (JsonException) { return Results.BadRequest(new { error = "Ürün bilgileri okunamadı." }); }
        var validation = new List<ValidationResult>();
        if (input is null || !Validator.TryValidateObject(input, new ValidationContext(input), validation, true) || string.IsNullOrWhiteSpace(input.Name) || string.IsNullOrWhiteSpace(input.Type) || string.IsNullOrWhiteSpace(input.Material))
            return Results.BadRequest(new { error = "Ad, tür, malzeme ve 10–2000 cm aralığındaki ölçüleri kontrol edin." });
        input.KeepPhotos ??= [];
        if (input.KeepPhotos.Any(p => old is null || !old.Photos.Contains(p))) return Results.BadRequest(new { error = "Fotoğraf seçimi geçersiz." });
        var photos = input.KeepPhotos.Distinct().ToList();
        if (photos.Count + form.Files.Count is < 1 or > 10) return Results.BadRequest(new { error = "En az 1, en fazla 10 fotoğraf ekleyin." });
        foreach (var file in form.Files)
        {
            if (file.Length is < 12 or > 8 * 1024 * 1024) return Results.BadRequest(new { error = "Her fotoğraf en fazla 8 MB olmalıdır." });
            using var buffer = new MemoryStream();
            await file.CopyToAsync(buffer);
            var bytes = buffer.ToArray();
            string? ext = bytes.AsSpan(0, 8).SequenceEqual(new byte[] {137,80,78,71,13,10,26,10}) ? ".png" :
                bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255 ? ".jpg" :
                System.Text.Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF" && System.Text.Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP" ? ".webp" : null;
            if (ext is null) return Results.BadRequest(new { error = "Yalnızca JPEG, PNG ve WebP fotoğrafları yüklenebilir." });
            var name = Guid.NewGuid().ToString("N") + ext;
            var path = Path.Combine(uploadRoot, name);
            created.Add(path);
            await File.WriteAllBytesAsync(path, bytes);
            photos.Add(new Photo("/uploads/" + name));
        }
        if (input.PhotoOrder is not null)
        {
            if (input.PhotoOrder.Count != photos.Count || input.PhotoOrder.Distinct().Count() != photos.Count || input.PhotoOrder.Any(i => i < 0 || i >= photos.Count))
                return Results.BadRequest(new { error = "Fotoğraf sıralaması geçersiz." });
            photos = input.PhotoOrder.Select(i => photos[i]).ToList();
        }
        var rug = new Rug(id, input.Name.Trim(), input.Type.Trim(), input.Width, input.Length, input.Material.Trim(), input.Description?.Trim() ?? "", input.Available, photos.Any(p => p.Sample != null), photos);
        var savedId = db.Save(rug);
        created.Clear();
        foreach (var p in old?.Photos.Except(photos) ?? []) DeleteUpload(p);
        return Results.Ok(rug with { Id = savedId });
    }
    finally { foreach (var path in created) { if (File.Exists(path)) File.Delete(path); } writeLock.Release(); }
}).RequireAuthorization("Admin");
app.MapDelete("/api/admin/products/{id:long}", async (long id, Catalog db) =>
{
    await writeLock.WaitAsync();
    try
    {
        var rug = db.Find(id);
        if (rug is null) return Results.NotFound();
        db.Delete(id);
        foreach (var p in rug.Photos) DeleteUpload(p);
        return Results.NoContent();
    }
    finally { writeLock.Release(); }
}).RequireAuthorization("Admin");
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.Run();

void DeleteUpload(Photo photo)
{
    if (!photo.Url.StartsWith("/uploads/", StringComparison.Ordinal)) return;
    var path = Path.Combine(uploadRoot, Path.GetFileName(photo.Url));
    try { if (File.Exists(path)) File.Delete(path); }
    catch (IOException ex) { app.Logger.LogWarning(ex, "Eski fotoğraf silinemedi: {Path}", path); }
}
record LoginInput(string? Username, string? Password);
