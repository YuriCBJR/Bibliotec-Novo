using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bibliotec.Migrations
{
    /// <inheritdoc />
    public partial class AtualizandoModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Ano",
                table: "Livros",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Codigo",
                table: "Livros",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Cor",
                table: "Livros",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "Quantidade",
                table: "Livros",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Resumo",
                table: "Livros",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Ano",
                table: "Livros");

            migrationBuilder.DropColumn(
                name: "Codigo",
                table: "Livros");

            migrationBuilder.DropColumn(
                name: "Cor",
                table: "Livros");

            migrationBuilder.DropColumn(
                name: "Quantidade",
                table: "Livros");

            migrationBuilder.DropColumn(
                name: "Resumo",
                table: "Livros");
        }
    }
}
