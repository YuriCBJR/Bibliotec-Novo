using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bibliotec.Migrations
{
    /// <inheritdoc />
    public partial class AdicionandoAtributos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.RenameColumn(
                name: "Emprestado",
                table: "Emprestimo",
                newName: "Ativo");

            migrationBuilder.AddColumn<Guid>(
                name: "AutorId",
                table: "Livro",
                type: "char(36)",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<Guid>(
                name: "UsuarioId",
                table: "Emprestimo",
                type: "char(36)",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                collation: "ascii_general_ci");

            migrationBuilder.CreateTable(
                name: "Autor",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Nome = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Autor", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_Livro_AutorId",
                table: "Livro",
                column: "AutorId");

            migrationBuilder.CreateIndex(
                name: "IX_Emprestimo_UsuarioId",
                table: "Emprestimo",
                column: "UsuarioId");

            migrationBuilder.AddForeignKey(
                name: "FK_Emprestimo_Usuario_UsuarioId",
                table: "Emprestimo",
                column: "UsuarioId",
                principalTable: "Usuario",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Livro_Autor_AutorId",
                table: "Livro",
                column: "AutorId",
                principalTable: "Autor",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Emprestimo_Usuario_UsuarioId",
                table: "Emprestimo");

            migrationBuilder.DropForeignKey(
                name: "FK_Livro_Autor_AutorId",
                table: "Livro");

            migrationBuilder.DropTable(
                name: "Autor");

            migrationBuilder.DropIndex(
                name: "IX_Livro_AutorId",
                table: "Livro");

            migrationBuilder.DropIndex(
                name: "IX_Emprestimo_UsuarioId",
                table: "Emprestimo");

            migrationBuilder.DropColumn(
                name: "AutorId",
                table: "Livro");

            migrationBuilder.DropColumn(
                name: "UsuarioId",
                table: "Emprestimo");

            migrationBuilder.AddColumn<string>(
                name: "Autor",
                table: "Livro",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");
        }
    }
}
