using System.ComponentModel.DataAnnotations;

namespace Bibliotec.Models;

public class Colaborador
{
    [Key]
    public Guid Id { get; set; }
    public string Nome { get; set; }
    public string Setor {  get; set; }
    [EmailAddress]
    public string EmailInstitucional { get; set; }
    //Relacionamento pro entity
    public Guid UsuarioId { get; set; }
    public Usuario Usuario { get; set; }

}
