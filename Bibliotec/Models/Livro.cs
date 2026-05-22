using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bibliotec.Models;

public class Livro
{
    public Guid Id { get; set; }
    public string Nome { get; set; } // Será preenchido pela coluna TÍTULO
    public Guid AutorId { get; set; }
    public Autor Autor { get; set; }

    public string Genero { get; set; } // Será preenchido por ASSUNTO
    public int Ano { get; set; }
    public int Codigo { get; set; } // Será o CDD MACRO
    public string Cor { get; set; } // Será calculada via código (ex: 900 = #F1BD36)
    public string Resumo { get; set; }

    public int Quantidade { get; set; }
    public bool Disponivel { get; set; }
}
