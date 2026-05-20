using System.ComponentModel.DataAnnotations;

namespace Bibliotec.Models;

public class Usuario
{
    [Key]
    public Guid Id { get; set; }
    public string Nome { get; set; }
    public string Email { get; set; }
    [Required]
    public string Password { get; set; }
    public string Permissao { get; set; }
}
