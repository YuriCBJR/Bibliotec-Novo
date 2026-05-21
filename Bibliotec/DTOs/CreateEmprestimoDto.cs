using System.ComponentModel.DataAnnotations;

namespace Bibliotec.DTOs;

public class CreateEmprestimoDto
{
    [Required(ErrorMessage = "O ID do livro é obrigatório.")]
    public Guid LivroId { get; set; }
    public DateTime DataEmprestimo {  get; set; }
}
