using Bibliotec.Data;
using Bibliotec.Models;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bibliotec.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LivroController : Controller
{
    private readonly BibliotecContext _context;
    public LivroController(BibliotecContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetLivros()
    {
        try
        {
            var livros = await _context.Livro.ToListAsync();
            return Ok(livros);
        }
        catch(Exception ex)
        {
            return BadRequest(ex.Message);
        }
        }

    [HttpPost("/api/adicionarLivro")]
    public async Task<IActionResult> AdicionarLivro(Livro livro)
    {
        _context.Add(livro);
        _context.SaveChanges();
        return Ok();

    }

    [HttpDelete("{Id}")]
    public async Task<IActionResult> DeletarLivro([FromRoute] Guid Id)
    {
        var livro = await _context.Livro.FindAsync(Id);
        if (livro == null)
        {
            return NotFound();
        }
        _context.Livro.Remove(livro);
        await _context.SaveChangesAsync();
        return Ok();

    }

    [HttpGet("{Id}")]
    public async Task<IActionResult> GetLivroById([FromRoute] Guid Id)
    {
        var livro = _context.Livro.Find(Id);
        return Ok(livro);
    }

    [HttpGet("disponiveis")]
    public IActionResult GetLivroDisponivel([FromQuery] bool disponivel)
    {
        var livro = _context.Livro.Where(l => l.Disponivel == disponivel);
        return Ok(livro);

    }
}





