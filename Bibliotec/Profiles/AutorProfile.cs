using AutoMapper;
using Bibliotec.DTOs;
using Bibliotec.Models;

namespace Bibliotec.Profiles;

public class AutorProfile : Profile
{
    public AutorProfile()
    {
        // DTO -> Model (Para o cadastro)
        CreateMap<CreateAutorDto, Autor>();
        CreateMap<Autor, ReadAutorDto>();
    }
}
