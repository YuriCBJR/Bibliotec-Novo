namespace Bibliotec.DTOs;

using System.ComponentModel.DataAnnotations;

public class CreateAutorDto
{
    [Required(ErrorMessage = "O nome do autor é obrigatório.")]
    public string Nome { get; set; }
}
