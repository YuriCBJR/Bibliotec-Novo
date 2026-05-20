using AutoMapper;
using Bibliotec.Data;
using Bibliotec.DTOs;
using Bibliotec.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bibliotec.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LivroController : Controller
{
    private readonly BibliotecContext _context;
    private readonly IMapper _mapper;
    public LivroController(BibliotecContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    [HttpGet]
    public async Task<IActionResult> GetLivros()
    {
        try
        {
            var livro = await _context.Livros.Include(l=> l.Autor).ToListAsync();
            var livrosDto = _mapper.Map<List<ReadLivroDto>>(livro);
            return Ok(livrosDto);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("/api/adicionarLivro")]
    public async Task<IActionResult> AdicionarLivro([FromBody] CreateLivroDto livroDto)
    {
        try
        {
            var livro = _mapper.Map<Livro>(livroDto);

            _context.Livros.Add(livro);

            await _context.SaveChangesAsync();

            return Ok(new { mensagem = "Livro adicionado com sucesso!" });
        }
        catch (Exception ex)
        {

            return BadRequest(new { erro = ex.Message, detalhe = ex.InnerException?.Message });
        }
    }

    [HttpGet("pesquisa")]
    public async Task<IActionResult> GetLivroPesquisa([FromQuery] string valor)
    {
        try
        {
            var query = _context.Livros.Include(o => o.Autor)
                        .Where(o => o.Nome.Contains(valor) || o.Autor.Nome.Contains(valor));
            var lista = await query.ToListAsync();
            return Ok("Alterações feitas!");
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("disponiveis")]
    public IActionResult GetLivroDisponivel([FromQuery] bool disponivel = true)
    {
        var livro = _context.Livros.Where(l => l.Disponivel == disponivel);
        return Ok(livro);

    }

    [Authorize]
    [HttpPut("alterar")]
    public async Task<IActionResult> PutLivro([FromBody] Livro livro)
    {
        try
        {
            _context.Livros.Update(livro);
            await _context.SaveChangesAsync();
            return Ok("Sucesso, alterado!");
        }
        catch
        {
            return BadRequest();
        }
    }
    [HttpDelete("{Id}")]
    public async Task<IActionResult> DeleteLivro([FromRoute] Guid Id)
    {
        try
        {
            Livro livro = await _context.Livros.FindAsync(Id);
            if(livro != null)
            {
                _context.Livros.Remove(livro);
                await _context.SaveChangesAsync();
                return Ok();

            }
            else
            {
                return NotFound("Erro, o livro não existe ou já foi excluído");
            }
        }
        catch
        {
            return BadRequest();
        }
    }
        
}





