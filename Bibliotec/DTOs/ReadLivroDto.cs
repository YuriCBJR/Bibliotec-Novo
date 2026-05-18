using Bibliotec.Models;

namespace Bibliotec.DTOs;

public class ReadLivroDto
{
    public Guid Id { get; set; }
    public string Nome { get; set; }
    public string Genero { get; set; } 
    public bool Disponivel { get; set; }
    public string Autor { get; set; }
}
