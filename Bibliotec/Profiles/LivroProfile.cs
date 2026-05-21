using AutoMapper;
using Bibliotec.DTOs;
using Bibliotec.Models;

namespace Bibliotec.Profiles;

public class LivroProfile : Profile
{
    public LivroProfile()
    {
        // 1. Mapeamento Simples: DTO -> Model (Para Criação)
        CreateMap<CreateLivroDto, Livro>();
        CreateMap<Livro, ReadLivroDto>().ForMember(dest => dest.AutorNome, opt => opt.MapFrom(src => src.Autor.Nome));
    }
}