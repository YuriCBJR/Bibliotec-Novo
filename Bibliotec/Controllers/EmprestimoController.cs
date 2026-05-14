using Bibliotec.Data;
using Bibliotec.Models;
using Microsoft.AspNetCore.Mvc;

namespace Bibliotec.Controllers;

public class EmprestimoRequest
{
    public Guid LivroId { get; set; }
}

[ApiController]
[Route("api/[controller]")]
public class EmprestimoController : Controller
{
    private readonly BibliotecContext _context;

    public EmprestimoController(BibliotecContext context)
    {
        _context = context;
    }

    [HttpGet]
    public IActionResult GetEmprestimos()
    {
        var emprestimo = _context.Emprestimo.ToList();
        return Ok(emprestimo);
    }

    [HttpPost]
    public async Task<IActionResult> RealizarEmprestimo([FromBody] EmprestimoRequest emprestimoRequest)
    {
        var livro = await _context.Livro.FindAsync(emprestimoRequest.LivroId);
        if (livro == null && !livro.Disponivel)
        {
            return BadRequest("Livro não disponivel no momento");
        }
        var emprestimo = new Emprestimo
        {
            LivroId = emprestimoRequest.LivroId,
            DataEmprestimo = DateTime.Now

        };
        livro.Disponivel = false;
        _context.Emprestimo.Add(emprestimo);
        _context.Update(livro);
        await _context.SaveChangesAsync();
        return Ok(emprestimo);
    }
}
    

