using AutoMapper;
using Bibliotec.Controllers;
using Bibliotec.DTOs;
using Bibliotec.Models;

namespace Bibliotec.Profiles;

public class EmprestimoProfile : Profile
{
    public EmprestimoProfile()
    {
        CreateMap<EmprestimoRequest, Emprestimo>();
        CreateMap<Emprestimo, ReadEmprestimoDto>()
            .ForMember(dest => dest.TituloLivro, opt => opt.MapFrom(src => src.Livro != null ? src.Livro.Nome : string.Empty))
            .ForMember(dest => dest.LivroId, opt => opt.MapFrom(src => src.LivroId))
            .ForMember(dest => dest.GeneroLivro, opt => opt.MapFrom(src => src.Livro != null ? src.Livro.Genero : string.Empty))
            .ForMember(dest => dest.UsuarioId, opt => opt.MapFrom(src => src.UsuarioId))
            .ForMember(dest => dest.UsuarioNome, opt => opt.MapFrom(src => src.Usuario != null ? src.Usuario.Nome : string.Empty));
    }
}
