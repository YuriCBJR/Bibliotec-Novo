namespace Bibliotec.DTOs;

public class ReadEmprestimoDto
{
    public Guid Id { get; set; }
    public string TituloLivro { get; set; }
    public DateTime DataEmprestimo { get; set; }
    public DateTime? DataDevolucao { get; set; }
}