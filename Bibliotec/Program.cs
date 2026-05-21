using AutoMapper;
using Bibliotec.Data;
using Bibliotec.Models;
using Bibliotec.Profiles;
using Bibliotec.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Identity.Web;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

var connectionString = builder.Configuration.GetConnectionString("ConnectionMySql");
builder.Services.AddDbContext<BibliotecContext>(opts =>
    opts.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddAutoMapper(typeof(Program).Assembly);

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var chaveString = builder.Configuration.GetValue<string>("JwtSettings:Chave")
                  ?? "hufwehfiuhweuifh9wuhcj8ue8r8uy9dijciojsoij98y7qyr7dj9afndfnfhnuiwhçskc2";

var chave = Encoding.ASCII.GetBytes(chaveString);

builder.Services.AddAuthentication(
    x =>
    {
        x.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
        x.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    }
).AddJwtBearer(
    x =>
    {
        x.RequireHttpsMetadata = false;
        x.SaveToken = true;
        x.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(chave),
            ValidateIssuer = false,
            ValidateAudience = false
        };
    }).AddMicrosoftIdentityWebApi(builder.Configuration, "AzureAd", "AzureAdScheme");

builder.Services.Configure<JwtBearerOptions>("AzureAdScheme", options =>
{
    // Força a API a aceitar o token mesmo se houver divergência de URLs locais/computador
    options.TokenValidationParameters.ValidateAudience = false;
    options.TokenValidationParameters.ValidateIssuer = false;

    // Isso ajuda a debugar: se der erro, o .NET te diz o motivo real no console do VS
    options.IncludeErrorDetails = true;
});


builder.Services.AddSingleton<TokenService>();

var app = builder.Build();

// Seed Database
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<BibliotecContext>();
    try
    {
        context.Database.EnsureCreated();
        if (!context.Usuarios.Any())
        {
            var admin = new Usuario
            {
                Id = Guid.NewGuid(),
                Nome = "Administrador Fiotec",
                Email = "admin@bibliotec.com",
                Password = "admin123",
                Permissao = "Admin"
            };
            
            var colab = new Usuario
            {
                Id = Guid.NewGuid(),
                Nome = "Colaborador Fiotec",
                Email = "colab@bibliotec.com",
                Password = "colab123",
                Permissao = "Colaborador"
            };
            
            var leitor = new Usuario
            {
                Id = Guid.NewGuid(),
                Nome = "Leitor Fiotec",
                Email = "leitor@bibliotec.com",
                Password = "leitor123",
                Permissao = "Leitor"
            };

            context.Usuarios.AddRange(admin, colab, leitor);

            var autor1 = new Autor { Id = Guid.NewGuid(), Nome = "Machado de Assis" };
            var autor2 = new Autor { Id = Guid.NewGuid(), Nome = "Clarice Lispector" };
            var autor3 = new Autor { Id = Guid.NewGuid(), Nome = "Jorge Amado" };
            context.Autores.AddRange(autor1, autor2, autor3);

            var livro1 = new Livro { Id = Guid.NewGuid(), Nome = "Dom Casmurro", Genero = "Clássico", Disponivel = true, AutorId = autor1.Id };
            var livro2 = new Livro { Id = Guid.NewGuid(), Nome = "A Hora da Estrela", Genero = "Ficção", Disponivel = true, AutorId = autor2.Id };
            var livro3 = new Livro { Id = Guid.NewGuid(), Nome = "Capitães da Areia", Genero = "Drama", Disponivel = true, AutorId = autor3.Id };
            context.Livros.AddRange(livro1, livro2, livro3);

            context.SaveChanges();
        }
    }
    catch (Exception ex)
    {
        // Se falhar o seed (por exemplo se DB não estiver pronto), continua a execução
        Console.WriteLine($"Erro ao rodar o seeding do banco: {ex.Message}");
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors(policy => policy.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin());

app.UseAuthentication();

app.UseAuthorization();

app.MapControllers();

app.Run();
