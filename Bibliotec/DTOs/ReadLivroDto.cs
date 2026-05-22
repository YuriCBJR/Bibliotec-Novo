using Bibliotec.Models;

namespace Bibliotec.DTOs;

public class ReadLivroDto
{
    public Guid Id { get; set; }
    public string Nome { get; set; }
    public string AutorNome { get; set; }
    public string Genero { get; set; }
    public int Ano { get; set; }
    public int Codigo { get; set; }
    public string Cor { get; set; }
    public string Resumo { get; set; }
    public int Quantidade { get; set; }
    public bool Disponivel { get; set; }
}
