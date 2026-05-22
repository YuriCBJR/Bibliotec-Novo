using Bibliotec.Models;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text.RegularExpressions;

namespace Bibliotec.Data;

public static class DbSeeder
{
    public static async Task PopularBanco(BibliotecContext context)
    {
        Console.WriteLine("\n⏳ [SEEDER] Iniciando leitura do CSV para popular o banco...");

        var caminhoCsv = Path.Combine(Directory.GetCurrentDirectory(), "dados_iniciais.csv");

        if (!File.Exists(caminhoCsv))
        {
            Console.WriteLine($"❌ [SEEDER ERRO] Arquivo CSV não encontrado no caminho: {caminhoCsv}");
            return;
        }

        // Lê todo o conteúdo do arquivo como uma string única para lidar com as quebras de linha dentro das aspas
        string conteudoArquivo = await File.ReadAllTextAsync(caminhoCsv);

        // Expressão regular para separar o CSV respeitando campos entre aspas que contêm quebras de linha ou ;
        var linhas = SepararLinhasCsv(conteudoArquivo);

        Console.WriteLine($"📖 [SEEDER] Arquivo lido. Analisando as {linhas.Count} linhas encontradas...");

        int adicionados = 0;
        int erros = 0;
        int duplicados = 0;

        // Pula o cabeçalho (ajuste o Skip dependendo de quantas linhas de lixo tem no topo do arquivo)
        foreach (var linha in linhas.Skip(2))
        {
            // Ignora linhas totalmente vazias ou o lixo do final do arquivo do Excel
            if (string.IsNullOrWhiteSpace(linha) || linha.StartsWith(";;;;;;;;O livro;")) continue;

            // Expressão regular para dar Split por ';' mas ignorar os ';' que estão dentro de aspas duplas
            var dados = Regex.Split(linha, ";(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)").Select(x => x.Trim('"').Trim()).ToArray();

            // Se a linha não tiver colunas suficientes ou não tiver título, pula
            if (dados.Length < 10 || string.IsNullOrWhiteSpace(dados[1])) continue;

            string nomeLivro = LimparTexto(dados[1]);

            // Se o livro já existir, não cadastra de novo
            if (await context.Livros.AnyAsync(l => l.Nome == nomeLivro))
            {
                duplicados++;
                continue;
            }

            try
            {
                string nomeAutor = string.IsNullOrWhiteSpace(dados[2]) ? "Desconhecido" : LimparTexto(dados[2]);
                string genero = LimparTexto(dados[7]);
                string resumo = LimparTexto(dados[8]);

                // Converte Ano (Lida com anos vazios ou letras soltas)
                int ano = 0;
                if (!string.IsNullOrWhiteSpace(dados[4]))
                {
                    double.TryParse(dados[4], NumberStyles.Any, CultureInfo.InvariantCulture, out double a);
                    ano = (int)a;
                }

                // Converte CDD (Código)
                int codigoCdd = 0;
                if (!string.IsNullOrWhiteSpace(dados[5]))
                {
                    double.TryParse(dados[5], NumberStyles.Any, CultureInfo.InvariantCulture, out double c);
                    codigoCdd = (int)c;
                }

                // Converte Quantidade
                int qtd = 1;
                if (!string.IsNullOrWhiteSpace(dados[9]))
                {
                    double.TryParse(dados[9], NumberStyles.Any, CultureInfo.InvariantCulture, out double q);
                    qtd = (int)q;
                }
                if (qtd <= 0) qtd = 1;

                string corEtiqueta = ObterCorPorCodigo(codigoCdd);

                // Cadastra o Autor se não existir
                var autorDb = await context.Autores.FirstOrDefaultAsync(x => x.Nome == nomeAutor);
                if (autorDb == null)
                {
                    autorDb = new Autor { Id = Guid.NewGuid(), Nome = nomeAutor };
                    context.Autores.Add(autorDb);
                    await context.SaveChangesAsync(); // Salva logo o autor para obter o ID
                }

                var novoLivro = new Livro
                {
                    Id = Guid.NewGuid(),
                    Nome = nomeLivro,
                    AutorId = autorDb.Id,
                    Ano = ano,
                    Codigo = codigoCdd,
                    Genero = genero,
                    Resumo = resumo,
                    Cor = corEtiqueta,
                    Quantidade = qtd,
                    Disponivel = qtd > 0
                };

                context.Livros.Add(novoLivro);
                adicionados++;
            }
            catch (Exception ex)
            {
                erros++;
                Console.WriteLine($"⚠️ Erro ao processar o livro '{nomeLivro}': {ex.Message}");
            }
        }

        await context.SaveChangesAsync();
        Console.WriteLine($"✅ [SEEDER SUCESSO] Resumo da Importação:");
        Console.WriteLine($"   - 📚 Novos Livros Cadastrados: {adicionados}");
        Console.WriteLine($"   - 🔄 Livros Ignorados (Já existiam): {duplicados}");
        if (erros > 0) Console.WriteLine($"   - ❌ Erros de Leitura: {erros}");
    }

    // Função auxiliar para quebrar as linhas corretamente, respeitando aspas multilinha do Excel
    private static List<string> SepararLinhasCsv(string csvConteudo)
    {
        var linhas = new List<string>();
        var linhaAtual = string.Empty;
        bool dentroDeAspas = false;

        foreach (char c in csvConteudo)
        {
            if (c == '"') dentroDeAspas = !dentroDeAspas;

            if (c == '\n' && !dentroDeAspas)
            {
                linhas.Add(linhaAtual);
                linhaAtual = string.Empty;
            }
            else if (c != '\r') // Ignora o \r do padrão \r\n do Windows
            {
                linhaAtual += c;
            }
        }

        if (!string.IsNullOrWhiteSpace(linhaAtual)) linhas.Add(linhaAtual);
        return linhas;
    }

    // Remove quebras de linha sujas (\n, \r) do meio dos títulos e resumos
    private static string LimparTexto(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return "Não Informado";
        return texto.Replace("\r", " ").Replace("\n", " ").Trim();
    }

    private static string ObterCorPorCodigo(int codigo)
    {
        return codigo switch
        {
            >= 100 and < 200 => "#F1BD36", // 100 Filosofia = Amarelo Fiotec
            >= 900 and < 1000 => "#0082C6", // 900 História/Geo = Azul Fiotec
            >= 300 and < 400 => "#F04A42", // 300 Sociologia = Vermelho Fiotec
            >= 500 and < 600 => "#70BF4A", // 500 Ciências = Verde Fiotec
            >= 800 and < 900 => "#9E519F", // 800 Literatura = Roxo Fiotec
            >= 600 and < 700 => "#A9ADB1", // 600 Administração = Cinza
            >= 700 and < 800 => "#4E4E4E", // 700 Artes = Cinza Escuro
            _ => "#A9ADB1" // Demais = Cinza Fiotec
        };
    }
}