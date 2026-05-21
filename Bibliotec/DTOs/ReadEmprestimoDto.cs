namespace Bibliotec.DTOs;

public class ReadEmprestimoDto
{
    public Guid Id { get; set; }
    public string TituloLivro { get; set; }
    public Guid LivroId { get; set; }
    public string GeneroLivro { get; set; }
    public Guid UsuarioId { get; set; }
    public string UsuarioNome { get; set; }
    public DateTime DataEmprestimo { get; set; }
    public DateTime? DataDevolucao { get; set; }
    public bool Ativo { get; set; }
}