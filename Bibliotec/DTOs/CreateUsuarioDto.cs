using System.ComponentModel.DataAnnotations;

namespace Bibliotec.DTOs;

public class CreateUsuarioDto
{
    [Required(ErrorMessage = "O nome é obrigatório.")]
    [StringLength(100, ErrorMessage = "O nome não pode passar de 100 caracteres.")]
    public string Nome { get; set; }

    [Required(ErrorMessage = "O e-mail é obrigatório.")]
    [EmailAddress(ErrorMessage = "Insira um e-mail válido.")]
    public string Email { get; set; }

    [Required(ErrorMessage = "A senha é obrigatória.")]
    [StringLength(30, MinimumLength = 6, ErrorMessage = "A senha deve ter entre 6 e 30 caracteres.")]
    public string Password { get; set; }

    [Required(ErrorMessage = "A confirmação de senha é obrigatória.")]
    [Compare("Password", ErrorMessage = "As senhas não conferem.")] // Validação automática do .NET
    public string Repassword{ get; set; }

    public string Permissao { get; set; }
}