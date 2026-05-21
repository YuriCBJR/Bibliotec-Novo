using AutoMapper;
using Bibliotec.Data;
using Bibliotec.DTOs;
using Bibliotec.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

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

    [HttpPost]
    [Authorize] // 🔒 Bloqueia para usuários não logados (Leitor ou Admin)
    public async Task<IActionResult> PostEmprestimo([FromBody] CreateEmprestimoDto dto)
    {
        try
        {
            // 1. 🛡️ SEGURANÇA: Captura o Email do usuário logado direto do Token JWT
            var usuarioEmail = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(usuarioEmail))
            {
                return Unauthorized(new { mensagem = "Usuário não identificado no token." });
            }

            // 2. Busca o usuário real no MySQL para pegar o ID correto dele
            var usuarioDb = await _context.Usuarios.FirstOrDefaultAsync(u => u.Email == usuarioEmail);
            if (usuarioDb == null)
            {
                return NotFound(new { mensagem = "Usuário não encontrado no banco de dados." });
            }

            // 3. Valida se o livro realmente existe e se está disponível
            var livroDb = await _context.Livros.FirstOrDefaultAsync(l => l.Id == dto.LivroId);
            if (livroDb == null)
            {
                return NotFound(new { mensagem = "O livro solicitado não existe." });
            }

            // Validação baseada no booleano de disponibilidade do seu banco
            if (!livroDb.Disponivel)
            {
                return BadRequest(new { message = "Este livro já está emprestado no momento." });
            }

            // 4. Cria o objeto do Empréstimo cruzando as chaves (UsuarioId + LivroId)
            var novoEmprestimo = new Emprestimo
            {
                Id = Guid.NewGuid(),
                LivroId = dto.LivroId,
                UsuarioId = usuarioDb.Id // Injeta o ID real pescado do Token
            };

            // 5. Atualiza o status do livro para indisponível
            livroDb.Disponivel = false;

            // 6. Salva tudo na mesma transação no MySQL
            _context.Emprestimo.Add(novoEmprestimo);
            _context.Livros.Update(livroDb);
            await _context.SaveChangesAsync();

            // 🟢 Correção de sintaxe aplicada aqui:
            return Ok(new { mensagem = "Empréstimo registrado com sucesso!" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { mensagem = "Erro ao processar empréstimo.", detalhe = ex.Message });
        }
    }

    [Authorize(Roles = "Colaborador,Admin")]
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
    [Authorize(Roles = "Admin")]

    [HttpGet("usuario/")]
    public async Task<IActionResult> EmprestimosUsuario([FromQuery] Guid usuarioId)
    {
        try
        {
            // Validação de Segurança
            var loggedInUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var loggedInUserRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;

            if (loggedInUserId != usuarioId.ToString() && loggedInUserRole != "Admin" && loggedInUserRole != "Colaborador")
            {
                return Forbid();
            }

            var usuarioExiste = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId);
            if (usuarioExiste == null)
            {
                return NotFound("Usuário não encontrado");
            }
            var listaEmprestimo = await _context.Emprestimo
                .Include(e => e.Livro)
                .Include(e => e.Usuario)
                .Where(e => e.UsuarioId == usuarioId)
                .ToListAsync();
            
            var listaEmprestimoDto = _mapper.Map<List<ReadEmprestimoDto>>(listaEmprestimo);
            return Ok(listaEmprestimoDto);
        }
        catch(Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
   
    

