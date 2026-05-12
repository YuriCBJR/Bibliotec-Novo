using Bibliotec.Models;
using Microsoft.EntityFrameworkCore;

namespace Bibliotec.Data;

public class BibliotecContext : DbContext
{
    public BibliotecContext(DbContextOptions<BibliotecContext> options) : base(options)
    {

    }
    public DbSet<Colaborador> Colaborador { get; set;  }
    public DbSet<Emprestimo> Emprestimo { get; set; }
    public DbSet<Livro> Livro { get; set; }
    public DbSet<Usuario> Usuario { get; set; }
}
