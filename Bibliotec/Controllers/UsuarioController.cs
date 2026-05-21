using AutoMapper;
using Bibliotec.Data;
using Bibliotec.DTOs;
using Bibliotec.Models;
using Bibliotec.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bibliotec.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsuarioController : Controller
    {
        private readonly BibliotecContext _context;
        private readonly IMapper _mapper;
        private readonly TokenService _tokenService;

        public UsuarioController(BibliotecContext context, IMapper mapper, TokenService tokenService)
        {
            _context = context;
            _mapper = mapper;
            _tokenService = tokenService;
        }
        [HttpGet]
        [Authorize(Roles = "Admin, Colaborador")]
        public async Task<IActionResult> GetUsuario()
        {
            try
            {
                var usuario = await _context.Usuarios.ToListAsync();
                var usuarioDto = _mapper.Map<List<ReadUsuarioDto>>(usuario);
                return Ok(usuarioDto);
            }
            catch
            {
                return BadRequest();
            }
        }
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> PostUsuario([FromBody] CreateUsuarioDto usuarioDto)
        {
            try
            {
                var usuarioExiste = await _context.Usuarios.AnyAsync(u => u.Email == usuarioDto.Email);
                if (usuarioExiste) return BadRequest(new { erro = "Este e-mail já está cadastrado no sistema." });

                // 2. Faz o mapeamento padrão do AutoMapper
                var usuario = _mapper.Map<Usuario>(usuarioDto);

                // 3. 🛡️ SEGURANÇA: Criptografa a senha antes de mandar para o MySQL
                usuario.Password = BCrypt.Net.BCrypt.HashPassword(usuarioDto.Password);
                usuario.Id = Guid.NewGuid();

                _context.Usuarios.Add(usuario);
                await _context.SaveChangesAsync();

                return Ok(new { mensagem = $"Usuário {usuario.Nome} cadastrado com sucesso pelo Administrador!" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { erro = ex.Message, detalhe = ex.InnerException?.Message });
            }
        }
        [Authorize(Roles = "Admin")]
        [HttpDelete("{Id}")]
        public async Task<IActionResult> DeleteUsuario([FromRoute] Guid Id)
        {
            try
            {
                Usuario usuario = await _context.Usuarios.FindAsync(Id);
                if (usuario != null)
                {
                    _context.Remove(usuario);
                    await _context.SaveChangesAsync();
                    return Ok();
                }
                else
                {
                    return BadRequest();
                }
            }
            catch
            {
                return BadRequest();
            }
        }
    
        [HttpPost]
        [Route("Login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login([FromBody] LoginDto loginDto)
        {
            var usuario = _context.Usuarios.Where(u => u.Email == loginDto.Email).FirstOrDefault();
            if (usuario == null)
            {
                return NotFound("Usuario Inválido");
            }
            if (usuario.Password != loginDto.Password)
            {
                return BadRequest("Senha não confere");
            }

            var token = _tokenService.GerarToken(usuario);

            usuario.Password = "";

            var result = new UsuarioResponse()
            {
                Usuario = usuario,
                Token = token
            };
            
            return Ok(result);
        } 
        
    }
}
