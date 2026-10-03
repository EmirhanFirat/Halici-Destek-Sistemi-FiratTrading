# Fırat Trading — Halıcı Destek Sistemi

ASP.NET Core 10 ve SQLite ile hazırlanmış halı vitrini ve yönetim paneli. Müşteri hesap açmadan koleksiyonu inceler; halıcı parola korumalı panelden ürünlerini yönetir.

## Çalıştırma

Windows'ta `Siteyi-Baslat.cmd` dosyasına çift tıklayabilirsiniz. Sunucuyu gizli bir arka plan süreci olarak başlatır ve tarayıcıyı açar. Bilgisayar yeniden başlatıldığında dosyayı tekrar çalıştırın. Günlükler `src/Halici.Web/App_Data/server.log` ve `server-error.log` dosyalarındadır.

Tarayıcı açmadan arka planda başlatmak için: `./scripts/start.ps1 -Background`. Sunucu zaten yanıt veriyorsa ikinci süreç başlatılmaz.

.NET 10 SDK gereklidir. Ayrı SQL sunucusu, Node.js veya Docker uygulamayı çalıştırmak için gerekli değildir.

```powershell
./scripts/start.ps1
```

Alternatif:

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --project src/Halici.Web --urls http://localhost:5080
```

- Vitrin: http://localhost:5080
- Yönetim: http://localhost:5080/admin.html
- İlk çalıştırmada rastgele yönetici parolası oluşturulur. Kullanıcı adı ve parola `src/Halici.Web/App_Data/initial-admin.txt` dosyasındadır. Bu dosya Git'e gönderilmez.
- Bu çalışma ortamında SDK geçici olarak `%TEMP%/halici-dotnet` içine kuruldu. `start.ps1` bu yolu da tanır. Geçici klasör temizlenirse [resmî .NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) kurulmalıdır.

## Özellikler

- Masaüstünde dört, mobilde iki sütunlu kart düzeni; halı türü ve santimetre cinsinden ölçü bilgileri.
- Tür filtresi, Türkçe arama, ada/ölçüye/yeni eklenene göre sıralama.
- Sayfa değiştirmeyen büyük fotoğraf galerisi; önceki/sonraki okları, klavye okları, fare sol tuşuyla sürükleme ve dokunmatik kaydırma. Escape ile kapanır.
- Yönetici girişi/çıkışı, ürün ekleme/düzenleme/silme, mevcut/satıldı durumu.
- En fazla 10 fotoğraf, fotoğraf başına 8 MB, toplam istek 40 MB. JPEG/PNG/WebP dosya imzası kontrolü; sürükle-bırak, önizleme ve kapak/sıralama seçimi.
- SQLite kalıcılığı, kaldırılan yüklemelerin temizlenmesi, yeniden başlatmada veri korunması.

Gönderilen referans ekran görüntüsü sekiz örnek ürün için CSS arka plan pencereleriyle gösterilir. Orijinal görsel değiştirilmemiştir. Örnek ürünlerin ad, tür, ölçü ve malzeme bilgileri gerçek envanter değildir; arayüzde açıkça belirtilir. Gerçek fotoğraflar ve bilgiler panelden girilmelidir. Aynı halının farklı fotoğrafları tek ürün altında yüklenir.

## Yapı

```text
src/Halici.Web/
  Program.cs          HTTP API, kimlik doğrulama, fotoğraf işlemleri
  Catalog.cs          SQLite erişimi ve örnek kayıtlar
  Models.cs           Ürün veri modeli ve doğrulama
  wwwroot/            Türkçe katalog, yönetim arayüzü, CSS ve JavaScript
  App_Data/           Yerel veritabanı, yüklemeler ve oturum anahtarları (Git dışı)
scripts/start.ps1     Yerel başlatıcı
scripts/smoke-test.mjs İzole veritabanıyla 23 entegrasyon kontrolü
```

`DataDirectory` ortam değişkeni kalıcı veri dizinini değiştirir. Varsayılan dizin `App_Data` altındadır. Veri dizininin tamamı, uygulama durdurularak yedeklenmelidir; çalışan SQLite dosyasını tek başına kopyalamayın. Birden fazla uygulama örneğiyle yatay ölçekleme bu ilk sürümün kapsamı dışındadır.

## Testler

```powershell
dotnet build
node scripts/smoke-test.mjs
```

Test için Node.js 22+ gerekir. SDK PATH üzerinde değilse `DOTNET_EXE` ortam değişkenini dotnet.exe yoluna ayarlayın. Testler 5091 portunda geçici bir uygulama başlatır, kendi veritabanını kullanır ve sonunda temizler; gerçek kataloğa dokunmaz. Tarayıcı doğrulaması ve sonuçlar [docs/TESTING.md](docs/TESTING.md) dosyasındadır.

## Docker (isteğe bağlı, yerel geliştirme)

`.env.example` dosyasını `.env` olarak kopyalayın, uzun ve benzersiz bir parola girin:

```sh
docker compose up --build -d
```

Uygulama yalnızca `127.0.0.1:5080` adresine bağlanır. Veriler `catalog-data` volume içinde kalır. `docker compose down -v` verileri siler. Docker dosyaları eklenmiştir; bu ortamda Docker çalıştırma testi yapılmamıştır.

## Canlıya geçiş için yapılandırma

Bu aşama yerel ilk sürümdür; canlıya dağıtım yapılmamıştır. Yayına geçişte alan adı/TLS, gerçek ürün bilgileri ve yedekleme hedefi belirlenmelidir. Üretimde `ASPNETCORE_ENVIRONMENT=Production`, `Admin__Username` ve en az 12 karakterlik `Admin__Password` ayarlayın. Üretim oturum çerezi yalnızca HTTPS üzerinden gönderilir. Docker Compose örneği yerel HTTP geliştirmesi içindir; internete doğrudan açılmamalıdır. TLS reverse proxy ve güvenilen proxy/IP ayarları dağıtım ortamında yapılandırılmalıdır.

Parolalar ASP.NET Core PasswordHasher ile hashlenir; yönetici uçları rol kontrolüyle korunur. Tüm değişiklik isteklerinde, giriş dahil, CSRF doğrulaması vardır. Giriş denemeleri IP başına dakikada beşle sınırlıdır. CSRF yaklaşımı [ASP.NET Core dokümantasyonuna](https://learn.microsoft.com/en-us/aspnet/core/security/anti-request-forgery?view=aspnetcore-10.0) dayanır. Oturum anahtarları veri dizininde saklanır; sunucuda bu dizine yalnızca uygulama hesabı erişmelidir. İlk yerel parola dosyasını güvenli şekilde saklayın.

Gelecek aşamada iletişim/WhatsApp bağlantısı, fiyatlandırma, stok ayrıntıları ve talep yönetimi eklenebilir. Sepet ve ödeme bu sürümde bulunmaz.
