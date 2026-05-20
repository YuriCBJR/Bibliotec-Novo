using System.ComponentModel.DataAnnotations;

namespace Bibliotec.DTOs;

public class LoginDto
{
    [Required(ErrorMessage = "O e-mail é obrigatório.")]
    [EmailAddress(ErrorMessage = "Insira um e-mail válido.")]
    public string Email { get; set; }

    [Required(ErrorMessage = "A senha é obrigatória.")]
    [StringLength(30, MinimumLength = 6, ErrorMessage = "A senha deve ter entre 6 e 30 caracteres.")]
    public string Password { get; set; }

}
