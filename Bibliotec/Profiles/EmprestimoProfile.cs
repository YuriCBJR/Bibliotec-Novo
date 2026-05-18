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
        CreateMap<Emprestimo, ReadEmprestimoDto>().ForMember(dest => dest.TituloLivro, opt => opt.MapFrom(src => src.Livro.Nome));
    }
}
