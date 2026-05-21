using BCrypt.Net;
using Bibliotec.Data;
using Bibliotec.DTOs;
using Bibliotec.Models;
using Bibliotec.Services;
using Bibliotec.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Identity.Client;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Bibliotec.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AutenticacaoController : ControllerBase
{
    private readonly BibliotecContext _context;
    private readonly TokenService _tokenService;
    private readonly IConfiguration _configuration;

    public AutenticacaoController(BibliotecContext context, TokenService tokenService, IConfiguration configuration)
    {
        _context = context;
        _tokenService = tokenService;
        _configuration = configuration;
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
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody]LoginDto loginDto)
    {
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Email == loginDto.Email);
        if(usuario == null || !BCrypt.Net.BCrypt.Verify(loginDto.Password, usuario.Password))
            {
            return Unauthorized("Email ou senha incorretos");
        }
        var token = GerarTokenJwtLocal(usuario);
        return Ok(new
        {
            token = token,
            usuario = new
            {
                nome = usuario.Nome,
                permissao = usuario.Permissao
            }
        });
    }
    [HttpPost("registrar")]
    public async Task<IActionResult> Registrar([FromBody] CreateUsuarioDto dto)
    {
        // Verifica se o e-mail já existe no MySQL
        var usuarioExiste = await _context.Usuarios.AnyAsync(u => u.Email == dto.Email);
        if (usuarioExiste) return BadRequest("Este e-mail já está cadastrado.");

        // Criptografa a senha antes de salvar
        string senhaCriptografada = BCrypt.Net.BCrypt.HashPassword(dto.Password);

        // Cria o objeto da sua Model de Usuário (Ajuste as propriedades conforme sua Model)
        var novoUsuario = new Usuario
        {
            Id = Guid.NewGuid(),
            Nome = dto.Nome,
            Email = dto.Email,
            Password = senhaCriptografada, // Salva o hash criptografado
            Permissao = dto.Permissao
        };

        _context.Usuarios.Add(novoUsuario);
        await _context.SaveChangesAsync();

        return Ok(new { mensagem = "Usuário criado com sucesso!" });
    }
    private string GerarTokenJwtLocal(Usuario usuario)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var chave = Encoding.ASCII.GetBytes(_configuration["Jwt:SecretKey"] ?? "hufwehfiuhweuifh9wuhcj8ue8r8uy9dijciojsoij98y7qyr7dj9afndfnfhnuiwhçskc2");

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.Name, usuario.Nome),
                new Claim(ClaimTypes.Email, usuario.Email),
                new Claim(ClaimTypes.Role, usuario.Permissao) // Injeta a role (Admin/Leitor) no token!
            }),
            Expires = DateTime.UtcNow.AddHours(3), // Expira em 3 horas
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(chave), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }
}
