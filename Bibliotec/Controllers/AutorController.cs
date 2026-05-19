using AutoMapper;
using Bibliotec.Data;
using Bibliotec.DTOs;
using Bibliotec.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bibliotec.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AutorController : Controller
{
    private readonly BibliotecContext _context;
    private readonly IMapper _mapper;

    public AutorController(BibliotecContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    [HttpGet]
    public async Task<IActionResult> GetAutor()
    {
        try
        {
            var autor = await _context.Autores.ToListAsync();
            var autorDto = _mapper.Map<List<ReadAutorDto>>(autor);
            return Ok(autorDto);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }
    [HttpPost]
    public async Task<IActionResult> PostAutor([FromBody] CreateAutorDto autorDto)
    {
        try
        {
            string nomeFormatado = autorDto.Nome.Trim();
            bool autorJaExiste = await _context.Autores
                .AnyAsync(a => a.Nome.ToLower() == nomeFormatado.ToLower());

            if (autorJaExiste)
            {
                return BadRequest(new { mensagem = "Este autor já está cadastrado no sistema!" });
            }
            var autor = _mapper.Map<Autor>(autorDto);
            autor.Nome = nomeFormatado;

            _context.Autores.Add(autor);
            await _context.SaveChangesAsync();

            return Ok(new { mensagem = "Autor criado com sucesso!", id = autor.Id });
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }
    [HttpGet("{autorId}/livros")]
    public async Task<IActionResult> GetLivrosAutor(Guid autorId)
    {
        try
        {
            var listaAutor = await _context.Autores.Include(l=> l.Livros).FirstOrDefaultAsync(l => l.Id == autorId);
            var livrosDto = _mapper.Map<List<ReadLivroDto>>(listaAutor.Livros);
            return Ok(livrosDto);
        }
        catch
        {
            return BadRequest();
        }
    }

}
