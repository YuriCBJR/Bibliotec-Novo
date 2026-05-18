using AutoMapper;
using Bibliotec.Data;
using Bibliotec.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bibliotec.Controllers;

public class EmprestimoRequest
{
    public Guid LivroId { get; set; }
    public DateTime DataEmprestimo {  get; set; }
}

[ApiController]
[Route("api/[controller]")]
public class EmprestimoController : Controller
{
    private readonly BibliotecContext _context;
    private readonly IMapper _mapper;

    public EmprestimoController(BibliotecContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    [HttpGet]
    public async Task<IActionResult> GetEmprestimo()
    {
        var emprestimo = await _context.Emprestimo.ToListAsync();
        return Ok(emprestimo);
    }

    [HttpPost]
    public async Task<IActionResult> RealizarEmprestimo([FromBody] EmprestimoRequest emprestimoRequest)
    {
        try
        {
            var livro = await _context.Livros.FirstOrDefaultAsync(l => l.Id == emprestimoRequest.LivroId);
            if (livro == null)
            {
                return BadRequest(new { mensagem = "Livro não encontrado." });
            }
            if (!livro.Disponivel)
            {
                return BadRequest(new { mensagem = "Este livro já está emprestado no momento." });
            }
            // 3. Segue o fluxo normal se tudo estiver ok
            var emprestimo = _mapper.Map<Emprestimo>(emprestimoRequest);

            // Regra de negócio: deixa o livro indisponível e coloca a data do emprestimo
            livro.Disponivel = false;
            emprestimo.DataEmprestimo = DateTime.Now;

            _context.Emprestimo.Add(emprestimo);
            await _context.SaveChangesAsync(); // <-- Linha 47 protegida!

            return Ok(new { mensagem = "Empréstimo realizado com sucesso!" });
        }

        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
   
    

