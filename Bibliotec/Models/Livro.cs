using System.ComponentModel.DataAnnotations;

namespace Bibliotec.Models;

public class Livro
{
    [Key]
    public Guid Id { get; set; }
    public string Nome { get; set; }
    public Guid AutorId { get; set; }
    public Autor Autor { get; set; }
    public bool Disponivel { get; set; }
  
}
