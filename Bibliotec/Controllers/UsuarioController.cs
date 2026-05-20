using AutoMapper;
using Bibliotec.Data;
using Bibliotec.DTOs;
using Bibliotec.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bibliotec.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsuarioController : Controller
    {
        private readonly BibliotecContext _context;
        private readonly IMapper _mapper;

        public UsuarioController(BibliotecContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }
        [HttpGet]
        public async Task<IActionResult> GetUsuario()
        {
            try
            {
                var usuario = await _context.Usuario.ToListAsync();
                var usuarioDto = _mapper.Map<List<ReadUsuarioDto>>(usuario);
                return Ok(usuarioDto);
            }
            catch
            {
                return BadRequest();
            }
        }
        [HttpPost]
        public async Task<IActionResult> PostUsuario([FromBody] CreateUsuarioDto usuarioDto)
        {
            try
            {
                var usuario = _mapper.Map<Usuario>(usuarioDto);
                _context.Usuario.Add(usuario);
               await _context.SaveChangesAsync();
                return Ok();
            }
            catch (Exception ex)
            {

                return BadRequest(new { erro = ex.Message, detalhe = ex.InnerException?.Message });
            }
        }
        [HttpDelete("{Id}")]
        public async Task<IActionResult> DeleteUsuario([FromRoute] Guid Id)
        {
            try
            {
                Usuario usuario = await _context.Usuario.FindAsync(Id);
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
    }
}
