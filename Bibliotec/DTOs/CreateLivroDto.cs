using System.ComponentModel.DataAnnotations;

namespace Bibliotec.DTOs;
public class CreateLivroDto
{
    public string Nome { get; set; }
    public Guid AutorId { get; set; }
    public bool Disponivel { get; set; } = true;
    public string Genero { get; set; }
}
