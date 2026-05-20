using System.Security.Claims;
using Bibliotec.Data;
using Bibliotec.Models;
using Bibliotec.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bibliotec.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AutenticacaoController : ControllerBase
{
    private readonly BibliotecContext _context;
    private readonly TokenService _tokenService;

    public AutenticacaoController(BibliotecContext context, TokenService tokenService)
    {
        _context = context;
        _tokenService = tokenService;
    }

    [Authorize(AuthenticationSchemes = "AzureAdScheme")]
    [HttpPost("login-azure")]
    public async Task<IActionResult> LoginAzure()
    {
        try
        {
            // 1. CAPTURA OS DADOS DA AZURE: Puxa o e-mail e o nome direto do Token da Microsoft
            var emailAzure = User.FindFirst("preferred_username")?.Value ?? User.FindFirst(ClaimTypes.Email)?.Value;
            var nomeAzure = User.FindFirst("name")?.Value;

            if (string.IsNullOrEmpty(emailAzure))
            {
                return BadRequest(new { mensagem = "Não foi possível recuperar os dados da conta Azure." });
            }

            // 2. BUSCA NO SEU BANCO LOCAL: O usuário já está na sua tabela local?
            var usuarioLocal = await _context.Usuarios.FirstOrDefaultAsync(u => u.Email == emailAzure);

            // 3. SE NÃO EXISTIR, CADASTRA AUTOMATICAMENTE (Vira um usuário do seu sistema)
            if (usuarioLocal == null)
            {
                usuarioLocal = new Usuario
                {
                    Id = Guid.NewGuid(),
                    Nome = nomeAzure ?? "Usuário Azure",
                    Email = emailAzure,
                    Password = "LOGADO_VIA_AZURE_" + Guid.NewGuid().ToString().Substring(0, 8), // Senha dummy segura
                    Permissao = "Leitor" // Dá a Role padrão do seu sistema
                };

                _context.Usuarios.Add(usuarioLocal);
                await _context.SaveChangesAsync();
            }

            // 4. GERA O SEU JWT LOCAL: Cria o seu próprio token contendo as SUAS Roles locais
            var tokenSistema = _tokenService.GerarToken(usuarioLocal);

            return Ok(new
            {
                usuario = new { id = usuarioLocal.Id, nome = usuarioLocal.Nome, email = usuarioLocal.Email, permissao = usuarioLocal.Permissao },
                token = tokenSistema
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }
}