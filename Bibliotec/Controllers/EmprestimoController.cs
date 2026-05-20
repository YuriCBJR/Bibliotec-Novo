using AutoMapper;
using Bibliotec.Data;
using Bibliotec.DTOs;
using Bibliotec.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bibliotec.Controllers;

public class EmprestimoRequest
{
    public Guid LivroId { get; set; }
    public DateTime DataEmprestimo {  get; set; }
    public Guid UsuarioId { get; set; }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
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
        var emprestimo = await _context.Emprestimo.
            Include(e => e.Usuario).
            Include(e => e.Livro).
            ToListAsync();
        var emprestimosDto = _mapper.Map<List<ReadEmprestimoDto>>(emprestimo);
        return Ok(emprestimosDto);
    }

    [Authorize(Roles = "Colaborador")]
    [HttpPost]
    public async Task<IActionResult> RealizarEmprestimo([FromBody] EmprestimoRequest emprestimoRequest)
    {
        try
        {
            var usuarioExiste = await _context.Usuarios.AnyAsync(u => u.Id == emprestimoRequest.UsuarioId);
            if (!usuarioExiste)
            {
                return BadRequest();
            }
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
            emprestimo.DataEmprestimo = DateTime.UtcNow;
            emprestimo.DataDevolucao = DateTime.UtcNow.AddDays(30);

            _context.Emprestimo.Add(emprestimo);
            await _context.SaveChangesAsync(); // <-- Linha 47 protegida!

            return Ok(new { mensagem = "Empréstimo realizado com sucesso!" });
        }

        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }
    [HttpGet("usuario/")]
    public async Task<IActionResult> EmprestimosUsuario([FromQuery] Guid usuarioId)
    {
        try
        {
            var usuarioExiste = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId);
            if (usuarioExiste == null)
            {
                return NotFound("Usuário não encontrado");
            }
            var listaEmprestimo = await _context.Emprestimo.Include(e => e.Livro)
                .Where(e => e.UsuarioId == usuarioId).
                ToListAsync();
            if (!listaEmprestimo.Any())
            {
                return BadRequest(new { mensagem = "Este usuário não possui nenhum empréstimo" });
            }
            else
            {
                var listaEmprestimoDto = _mapper.Map<List<ReadEmprestimoDto>>(listaEmprestimo);
                return Ok(listaEmprestimoDto);
            }
        }
        catch(Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
   
    

