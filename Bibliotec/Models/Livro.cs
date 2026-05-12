using System.ComponentModel.DataAnnotations;

namespace Bibliotec.Models;

public class Livro
{
    [Key]
    public Guid Id { get; set; }
    public string Nome { get; set; }
    public string Autor {  get; set; }
    public bool Disponivel { get; set; }
  
}
