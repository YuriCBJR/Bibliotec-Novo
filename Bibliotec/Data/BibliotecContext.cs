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
    public DbSet<Livro> Livros { get; set; }
    public DbSet<Usuario> Usuario { get; set; }
    public DbSet<Autor> Autores {get; set; }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
    }
}
