using Microsoft.EntityFrameworkCore.Storage.ValueConversion.Internal;

namespace Bibliotec.Models;

public class Autor
{
    public Guid Id { get; set; }
    public string Nome { get; set; }
    public ICollection<Livro> Livros { get; set; } = new List<Livro>();

}
