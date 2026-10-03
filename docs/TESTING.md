# İlk sürüm doğrulaması — 3 Ekim 2026

## Otomatik kontroller

`dotnet build`: 0 hata, 0 uyarı.

`dotnet publish -c Release`: başarılı. NuGet geçişli bağımlılık taramasında bilinen güvenlik açığı bildirilmedi; sürümler `packages.lock.json` ile kayıtlıdır.

`node scripts/smoke-test.mjs`: 23 kontrol başarılı:

- Vitrin erişimi ve API önbellek davranışı.
- Anonim yazma isteği, CSRF eksikliği ve yanlış parola engeli.
- Yönetici oturumu açma, kimlik doğrulama ve çıkış.
- Zorunlu fotoğraf ve geçerli ölçü kontrolü.
- PNG adıyla gönderilen HTML içeriğinin reddedilmesi.
- Kısmen başarısız yüklemede artık dosya bırakılmaması.
- Çoklu fotoğraf yükleme ve doğru içerik türüyle sunum.
- Başka ürüne ait olmayan fotoğraf URL'lerinin reddi.
- Ürün adı/durum düzenlemesi ve mevcut/yeni fotoğrafların tek kayıtta sıralanması.
- Uygulama yeniden başlatıldığında ürünler, fotoğraflar ve oturumun korunması.
- Fotoğraf kaldırma, ürün silme ve dosya temizliği.
- Katalog tamamen boşaltıldığında yeniden örnek ürün eklenmemesi.
- Çıkıştan sonra yazma yetkisinin kaldırılması.

## Gerçek tarayıcı kontrolü

Codex içi Chromium tarayıcısında 1440 × 1000 ve 390 × 844 ekran boyutlarıyla kontrol edildi:

- Masaüstü katalog düzeni, tür filtreleme ve kart bilgileri.
- Kart seçilince URL değişmeden açılan büyük fotoğraf.
- Galerinin Escape ve kapatma düğmesiyle kapanması.
- Yerel yönetici hesabıyla giriş ve ürün ekleme formu.
- Gerçek dosya seçiciden fotoğraf seçimi, önizleme ve ürün kaydının vitrinde görünmesi.
- İki fotoğraflı test ürününde ok düğmesi, klavye oku ve sol fare tuşuyla sürükleme: sayaç 1/2 ile 2/2 arasında değişti.
- Mobil katalog ve yönetim panelinde yatay taşma yok: belge genişliği ve kaydırma genişliği eşit.

Tarayıcı kontrolü için oluşturulan geçici ürün ve yüklemeleri silindi. Gerçek katalogda yalnızca sekiz örnek ürün bırakıldı.

## Sınırlar

Docker imajı bu ortamda çalıştırılmadı. Gerçek telefon cihazı, yüksek eşzamanlı yük, üretim HTTPS/proxy dağıtımı ve harici güvenlik denetimi yapılmadı. Fotoğraf doğrulaması dosya boyutu ve dosya imzasını kontrol eder; fotoğrafları yeniden kodlayan bir medya işleme servisi içermez.
