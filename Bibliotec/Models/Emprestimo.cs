using System.ComponentModel.DataAnnotations;

namespace Bibliotec.Models;

public class Emprestimo
{
    [Key]
    public Guid Id { get; set; }
    public DateTime DataEmprestimo { get; set; }
    public DateTime DataDevolucao { get; set; }
    public bool Emprestado {  get; set; }
    //Relacionamento Entity
    public Guid LivroId { get; set; }
    public Livro Livro { get; set; }

}
