using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace Halici.Web;

public sealed class Catalog
{
    private readonly string connectionString;
    public Catalog(string path)
    {
        connectionString = new SqliteConnectionStringBuilder { DataSource = path }.ToString();
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS Rugs (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Payload TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS Settings (Key TEXT PRIMARY KEY, Value TEXT NOT NULL);
            """;
        cmd.ExecuteNonQuery();
        cmd.CommandText = "SELECT COUNT(*) FROM Settings WHERE Key='seeded'";
        if ((long)cmd.ExecuteScalar()! == 0)
        {
            using var transaction = db.BeginTransaction();
            var names = new[] { "Renklerin hikâyesi", "Anadolu'nun izleri", "Bordo miras", "Altın çerçeve", "Yumuşak bir dokunuş", "Geometrik ahenk", "Toprağın tonları", "Mavi yolculuk" };
            var types = new[] { "Kilim", "Kilim", "Klasik halı", "Klasik halı", "Shaggy", "Kilim", "Modern halı", "Yolluk" };
            for (var i = 0; i < 8; i++)
            {
                var rug = new Rug(0, names[i], types[i], i == 7 ? 80 : 160, i == 7 ? 300 : 230,
                    "Bilgi eklenecek", "Referans fotoğrafından hazırlanmış örnek ürün. Tür ve ölçüler gösterim amaçlıdır; gerçek ürün bilgileri yönetim panelinden güncellenebilir.", true, true,
                    [new Photo("/images/collection-reference.png", i)]);
                cmd.Transaction = transaction;
                cmd.CommandText = "INSERT INTO Rugs(Payload) VALUES($payload)";
                cmd.Parameters.Clear();
                cmd.Parameters.AddWithValue("$payload", JsonSerializer.Serialize(rug));
                cmd.ExecuteNonQuery();
            }
            cmd.CommandText = "INSERT INTO Settings VALUES('seeded','1')";
            cmd.Parameters.Clear();
            cmd.ExecuteNonQuery();
            transaction.Commit();
        }
    }

    private SqliteConnection Open() { var db = new SqliteConnection(connectionString); db.Open(); return db; }
    public List<Rug> All()
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT Id,Payload FROM Rugs ORDER BY Id DESC";
        using var reader = cmd.ExecuteReader();
        var rugs = new List<Rug>();
        while (reader.Read()) rugs.Add(JsonSerializer.Deserialize<Rug>(reader.GetString(1))! with { Id = reader.GetInt64(0) });
        return rugs;
    }
    public Rug? Find(long id) => All().FirstOrDefault(x => x.Id == id);
    public long Save(Rug rug)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = rug.Id == 0 ? "INSERT INTO Rugs(Payload) VALUES($payload) RETURNING Id" : "UPDATE Rugs SET Payload=$payload WHERE Id=$id RETURNING Id";
        cmd.Parameters.AddWithValue("$payload", JsonSerializer.Serialize(rug));
        cmd.Parameters.AddWithValue("$id", rug.Id);
        return Convert.ToInt64(cmd.ExecuteScalar());
    }
    public void Delete(long id)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "DELETE FROM Rugs WHERE Id=$id";
        cmd.Parameters.AddWithValue("$id", id);
        cmd.ExecuteNonQuery();
    }
}
