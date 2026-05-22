using AutoMapper;
using Bibliotec.Data;
using Bibliotec.DTOs;
using Bibliotec.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Bibliotec.Controllers;

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

    // Carrega os empréstimos do usuário logado baseado no Token JWT
    [HttpGet("meus-emprestimos")]
    public async Task<IActionResult> GetMeusEmprestimos()
    {
        try
        {
            var usuarioEmail = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(usuarioEmail)) return Unauthorized();

            var usuarioDb = await _context.Usuarios.FirstOrDefaultAsync(u => u.Email == usuarioEmail);
            if (usuarioDb == null) return NotFound("Usuário não encontrado.");

            var emprestimos = await _context.Emprestimo
                .Include(e => e.Livro)
                .Where(e => e.UsuarioId == usuarioDb.Id)
                .ToListAsync();

            var emprestimosDto = _mapper.Map<List<ReadEmprestimoDto>>(emprestimos);
            return Ok(emprestimosDto);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> PostEmprestimo([FromBody] CreateEmprestimoDto dto)
    {
        try
        {
            var usuarioEmail = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(usuarioEmail))
            {
                return Unauthorized(new { mensagem = "Usuário não identificado no token." });
            }

            var usuarioDb = await _context.Usuarios.FirstOrDefaultAsync(u => u.Email == usuarioEmail);
            if (usuarioDb == null)
            {
                return NotFound(new { mensagem = "Usuário não encontrado no banco de dados." });
            }

            var livroDb = await _context.Livros.FirstOrDefaultAsync(l => l.Id == dto.LivroId);
            if (livroDb == null)
            {
                return NotFound(new { margin = "O livro solicitado não existe." });
            }

            if (!livroDb.Disponivel)
            {
                return BadRequest(new { message = "Este livro já está emprestado no momento." });
            }

            var novoEmprestimo = new Emprestimo
            {
                Id = Guid.NewGuid(),
                LivroId = dto.LivroId,
                UsuarioId = usuarioDb.Id,
                DataEmprestimo = dto.DataEmprestimo != default ? dto.DataEmprestimo : DateTime.UtcNow,
                Ativo = true
            };

            livroDb.Disponivel = false;

            _context.Emprestimo.Add(novoEmprestimo);
            _context.Livros.Update(livroDb);
            await _context.SaveChangesAsync();

            return Ok(new { mensagem = "Empréstimo registrado com sucesso!" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { mensagem = "Erro ao processar empréstimo.", detalhe = ex.Message });
        }
    }

    [HttpPost("{id}/devolver")]
    public async Task<IActionResult> DevolverLivro([FromRoute] Guid id)
    {
        try
        {
            var emprestimo = await _context.Emprestimo
                .Include(e => e.Livro)
                .FirstOrDefaultAsync(e => e.Id == id);

            if (emprestimo == null)
            {
                return NotFound(new { mensagem = "Empréstimo não encontrado." });
            }

            if (!emprestimo.Ativo)
            {
                return BadRequest(new { mensagem = "Este empréstimo já foi devolvido anteriormente." });
            }

            emprestimo.Ativo = false;
            if (emprestimo.Livro != null)
            {
                emprestimo.Livro.Disponivel = true;
            }

            await _context.SaveChangesAsync();
            return Ok(new { mensagem = "Livro devolvido com sucesso!" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpGet("usuario")]
    public async Task<IActionResult> EmprestimosUsuario([FromQuery] Guid usuarioId)
    {
        try
        {
            var loggedInUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var loggedInUserRole = User.FindFirst(ClaimTypes.Role)?.Value;

            if (loggedInUserId != usuarioId.ToString() && loggedInUserRole != "Admin" && loggedInUserRole != "Colaborador")
            {
                return Forbid();
            }

            var usuarioExiste = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId);
            if (usuarioExiste == null) return NotFound("Usuário não encontrado");

            var listaEmprestimo = await _context.Emprestimo
                .Include(e => e.Livro)
                .Include(e => e.Usuario)
                .Where(e => e.UsuarioId == usuarioId)
                .ToListAsync();

            var listaEmprestimoDto = _mapper.Map<List<ReadEmprestimoDto>>(listaEmprestimo);
            return Ok(listaEmprestimoDto);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }
}