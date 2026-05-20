using AutoMapper;
using Bibliotec.DTOs;
using Bibliotec.Models;

namespace Bibliotec.Profiles;

public class UsuarioProfile : Profile
{
    public UsuarioProfile()
    {
        // POST: DTO -> Model
        CreateMap<CreateUsuarioDto, Usuario>();

        // GET: Model -> DTO
        CreateMap<Usuario, ReadUsuarioDto>();
    }
}
