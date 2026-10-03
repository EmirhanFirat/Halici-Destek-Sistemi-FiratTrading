# Katalog kapasitesi ve AI sergi görseli değerlendirmesi

Tarih: 3 Ekim 2026. Bu belge mevcut uygulamanın denetimidir; AI özelliği henüz uygulanmamıştır.

## Katalog kapasitesi

Mevcut SQLite veritabanında 8 örnek ürün vardır. Instagram'daki 560 ürün aktarılmış değildir. Instagram sayfasının içeriği doğrulanamadığından 560 sayısı kullanıcının verdiği planlama girdisidir; gönderi sayısı benzersiz ürün sayısı anlamına gelmeyebilir.

Ürün bilgileri `Rugs.Payload` JSON alanında, fotoğraflar `App_Data/uploads` dizininde tutulur. Veritabanı fotoğraf baytlarını değil yollarını saklar. Ürün başına 1–10 fotoğraf, dosya başına 8 MiB sınırı vardır. İstek başına 40 MiB sınırı nedeniyle 10 adet 8 MiB fotoğraf tek istekte yüklenemez.

Üretim veritabanının salt okunur bağlantıdan alınan geçici kopyasında, gerçek uygulamanın derlenmiş DLL'i ayrı portta çalıştırılarak ölçüm yapıldı. Her ürün 10 sentetik fotoğraf bağlantısı içerdi. Bir ısınma isteğinden sonra 10 ardışık isteğin medyanı alındı. Canlı katalog değiştirilmedi.

| Ürün | Bilgi veritabanı | API yanıt boyutu | Yerel API medyanı | En yavaş istek |
| --- | --- | --- | --- | --- |
| 560 | 786.432 bayt / 0,75 MiB | 714.345 bayt | 40,85 ms | 47,96 ms |
| 5.600 | 7.684.096 bayt / 7,33 MiB | 7.154.587 bayt | 178,33 ms | 231,61 ms |

Bu sonuçlar bilgi ve bağlantı kapasitesini gösterir. Fotoğraf aktarımı, tarayıcı çizimi, eşzamanlı ziyaretçiler ve uzak sunucu performansı ölçülmedi; canlı performans garantisi değildir. Yerel ölçüm çıktısı `artifacts/capacity-audit/result.json` içindedir (Git dışında).

Depolama örnekleri:

- 560 ürün × 3 fotoğraf × 2 MiB = 3,28 GiB.
- 560 ürün × 10 fotoğraf × 8 MiB = 43,75 GiB.
- AI sürümleri, önizlemeler ve yedekler ayrıca yer kullanır.

SQLite 560 ürün için yeterlidir; sırf bu adet nedeniyle SQL Server kurmak gerekmez. Ancak tüm ürünler tek API yanıtında yükleniyor, filtreleme tarayıcıda yapılıyor ve `Find` bütün kataloğu okuyor. Yayın öncesi öneriler:

1. Sunucuda arama/filtreleme ve 24–36 ürünlük sayfalama; tek ürün için doğrudan ID sorgusu.
2. Küçük WebP önizlemeler, farklı ekran boyutları için görsel sürümleri; orijinali yalnızca galeri gerektirdiğinde yükleme.
3. Yüklenen dosyaları tam görsel olarak çözümleyip boyut/piksel sınırı uygulama; mevcut imza kontrolünü güçlendirme.
4. Fotoğraflar için nesne depolama/CDN; SQLite için kalıcı yerel disk ve tutarlı yedekleme. Çoklu uygulama sunucusuna geçilirse PostgreSQL gibi merkezi veritabanını değerlendirme.
5. Geri yüklemesi denenmiş veritabanı ve fotoğraf yedekleri.

## Gerçekçi sergi görseli

Yapılabilir; fakat her sıradan fotoğraftan kusursuz sonuç veya motiflerin üretken model tarafından aynen korunması garanti edilemez. Mevcut CSS 3D animasyonu bu özellikten ayrıdır.

Önerilen ürün akışı: Yönetici temiz, köşeleri görünen orijinal fotoğrafı yükler → halının sınırları ayrılır ve gerekirse dört köşe onaylanır → sergi/salon şablonu seçilir → ortam, ışık ve gölge hazırlanır → iki aday gösterilir → yönetici motif, renk ve saçakları orijinalle karşılaştırıp yayını onaylar.

Ürün doğruluğu için gerçek halı dokusunu koruyan birleştirme tercih edilmeli: AI ortamı hazırlarken halı orijinalden ayrı katman olarak perspektifle yerleştirilir. Maskeli düzenleme yardımcı olabilir, fakat maskeler kesin piksel koruması garantisi değildir. Orijinal fotoğraf her zaman saklanmalı ve galeride erişilebilir olmalıdır. Dekoratif sonuç “Dekorasyon görselleştirmesi” olarak belirtilmelidir. Kaynak: [OpenAI görsel üretimi ve düzenleme rehberi](https://developers.openai.com/api/docs/guides/image-generation).

.NET tarafında kalıcı iş kaydı ve kuyruk (bekliyor/işleniyor/tamamlandı/başarısız), sunucuda saklanan API anahtarı, sınırlı yeniden deneme, maliyet limiti ve yönetici onayı gerekir. Görsel kayıtları orijinal/sergi/önizleme türünü, kaynak görseli, model sürümünü ve onay durumunu tutmalıdır. API anahtarı tarayıcıya gönderilmez. Onaylanan dosya kaydedilir; ziyaretçiler baktıkça yeniden AI üretilmez.

## Maliyet hesabı (USD)

Karşılaştırılabilir referans: GPT Image 2, 1536×1024, high çıktısı için resmî tabloda görsel başına 0,165 USD. Bu yalnızca çıktı ücretidir; giriş görseli ve metin ayrıca ücretlenir. Model seçimi küçük pilotta kalite/maliyet karşılaştırmasıyla kesinleştirilmelidir. Kaynak: [OpenAI görsel ücret tablosu](https://developers.openai.com/api/docs/guides/image-generation), [API fiyatlandırması](https://developers.openai.com/api/docs/pricing).

Bütçe sütunu bir sağlayıcı fiyat teklifi değildir: deneme başına girişler için pay dahil 0,20 USD varsayımı ve beğenilmeyen sonuçlar için %25 ek deneme kullanır. Formül: ürün × sahne × aday × 1,25 × 0,20 USD. Gerçek giriş tüketimi ve kabul oranı bütçeyi değiştirebilir.

| Senaryo | Planlanan üretim | Yalnız çıktı | Paylı AI bütçesi |
| --- | --- | --- | --- |
| 10 halıda iki aday pilot | 20 | $3,30 | $5 |
| 560 halıda bir aday | 560 | $92,40 | $140 |
| 560 halıda iki aday | 1.120 | $184,80 | $280 |
| 560 halıda üç sahne, her sahnede iki aday | 3.360 | $554,40 | $840 |

İlk katalog üretimi tek seferliktir. Aynı varsayımla ayda 100 yeni ürünün ikişer aday üretimi yaklaşık $50 AI bütçesi gerektirir. Geliştirme emeği, manuel rötuş, ücretli ek araçlar ve vergiler bu hesapta yoktur. TL karşılığı ödeme gününün kuruna bağlıdır.

Başlangıç barındırma örneği: [DigitalOcean](https://www.digitalocean.com/pricing/droplets) 2 GiB RAM/1 vCPU sunucu $12/ay, haftalık sunucu yedeği %20 = $2,40/ay. [Cloudflare R2](https://developers.cloudflare.com/r2/pricing/) standart depolama $0,015/GB-ay; aylık ücretsiz 10 GB çıkarıldığında toplam 50 GB fotoğraf için $0,60/ay. İşlem kullanımı ücretsiz kotalarda kaldığında toplam yaklaşık $15/ay olur. Alan adı, vergi, ayrı fotoğraf yedekleri ve kota aşımı dahil değildir. Bu sunucu seçimi eşzamanlı trafik testiyle doğrulanmalıdır; sunucu yedeği harici R2 fotoğraflarının yedeği değildir.

Önerilen sıra: Önce 10 farklı halıyla yaklaşık $5 AI pilot bütçesiyle kaliteyi doğrulamak; ardından sayfalama, görsel işleme, depolama/yedekleme ve onaylı üretim akışını eklemek. 560 ürünün toplu üretimi ancak pilotta desen koruması ve kabul oranı görüldükten sonra yapılmalıdır. Bu denetimde ücretli görsel üretimi başlatılmadı.
