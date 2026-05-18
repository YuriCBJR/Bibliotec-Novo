using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bibliotec.Models;

public class Livro
{
    [Key]
    public Guid Id { get; set; }
    [Required]
    public string Nome { get; set; }
    [Required]
    public bool Disponivel { get; set; }
    [Required]
    public string Genero { get; set;  }
    [Required]
    public Guid AutorId { get; set; }
    [ForeignKey("AutorId")]
    public virtual Autor? Autor { get; set; }
  
}
