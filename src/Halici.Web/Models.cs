using System.ComponentModel.DataAnnotations;

namespace Halici.Web;

public record Photo(string Url, int? Sample = null);
public record Rug(long Id, string Name, string Type, int Width, int Length,
    string Material, string Description, bool Available, bool Demo, List<Photo> Photos);

public class RugInput
{
    [Required, StringLength(100, MinimumLength = 2)] public string Name { get; set; } = "";
    [Required, StringLength(60)] public string Type { get; set; } = "";
    [Range(10, 2000)] public int Width { get; set; }
    [Range(10, 2000)] public int Length { get; set; }
    [Required, StringLength(100)] public string Material { get; set; } = "";
    [StringLength(2000)] public string Description { get; set; } = "";
    public bool Available { get; set; } = true;
    public List<Photo> KeepPhotos { get; set; } = [];
    public List<int>? PhotoOrder { get; set; }
}
