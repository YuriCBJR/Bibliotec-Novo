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

    // Bug 1 corrigido: restrito a Admin/Colaborador
    [HttpGet]
    [Authorize(Roles = "Admin, Colaborador")]
    public async Task<IActionResult> GetEmprestimo()
    {
        var emprestimo = await _context.Emprestimo
            .Include(e => e.Usuario)
            .Include(e => e.Livro)
            .ToListAsync();
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
            // Tenta pegar o email do ClaimTypes.Email e, como fallback, do Claim "email" nativo do JWT
            var usuarioEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Email)?.Value;

            if (string.IsNullOrEmpty(usuarioEmail))
            {
                 // Verificando a coleção de claims se falhar na busca rápida (Log)
                 var claimsInfo = string.Join(", ", User.Claims.Select(c => $"{c.Type}: {c.Value}"));
                 return Unauthorized(new { mensagem = $"Usuário não identificado no token. Suas Claims são: {claimsInfo}" });
            }

            var usuarioDb = await _context.Usuarios.FirstOrDefaultAsync(u => u.Email == usuarioEmail);
            if (usuarioDb == null)
                return NotFound(new { mensagem = "Usuário não encontrado no banco de dados." });

            var livroDb = await _context.Livros.FirstOrDefaultAsync(l => l.Id == dto.LivroId);
            if (livroDb == null)
                return NotFound(new { mensagem = "O livro solicitado não existe." });

            // Bug 4 corrigido: verifica Quantidade em vez de apenas Disponivel
            if (livroDb.Quantidade <= 0)
                return BadRequest(new { mensagem = "Não há exemplares disponíveis no momento." });

            var novoEmprestimo = new Emprestimo
            {
                Id = Guid.NewGuid(),
                LivroId = dto.LivroId,
                UsuarioId = usuarioDb.Id,
                DataEmprestimo = dto.DataEmprestimo != default ? dto.DataEmprestimo : DateTime.UtcNow,
                DataDevolucao = null, // Ativo, ainda sem devolução
                Ativo = true
            };

            // Bug 4 corrigido: decrementa Quantidade e recalcula Disponivel
            livroDb.Quantidade--;
            livroDb.Disponivel = livroDb.Quantidade > 0;

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
                return NotFound(new { mensagem = "Empréstimo não encontrado." });

            if (!emprestimo.Ativo)
                return BadRequest(new { mensagem = "Este empréstimo já foi devolvido anteriormente." });

            // Bug 2 corrigido: seta DataDevolucao
            emprestimo.Ativo = false;
            emprestimo.DataDevolucao = DateTime.UtcNow;

            if (emprestimo.Livro != null)
            {
                // Bug 5 corrigido: incrementa Quantidade ao devolver
                emprestimo.Livro.Quantidade++;
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

            // Bug 6 corrigido: verificação segura evitando null
            bool ehOProprioUsuario = !string.IsNullOrEmpty(loggedInUserId)
                && loggedInUserId == usuarioId.ToString();
            bool ehAdminOuColab = loggedInUserRole == "Admin" || loggedInUserRole == "Colaborador";

            if (!ehOProprioUsuario && !ehAdminOuColab)
                return Forbid();

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