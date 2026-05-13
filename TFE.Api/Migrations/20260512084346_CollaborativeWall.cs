using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TFE.Api.Migrations
{
    /// <inheritdoc />
    public partial class CollaborativeWall : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RestrictedToRole",
                table: "Posts");

            migrationBuilder.RenameColumn(
                name: "ContentText",
                table: "Posts",
                newName: "Content");

            migrationBuilder.RenameColumn(
                name: "ContentText",
                table: "Comments",
                newName: "Content");

            migrationBuilder.AddColumn<string[]>(
                name: "ExcludedRoles",
                table: "Posts",
                type: "text[]",
                nullable: false,
                defaultValue: new string[0]);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExcludedRoles",
                table: "Posts");

            migrationBuilder.RenameColumn(
                name: "Content",
                table: "Posts",
                newName: "ContentText");

            migrationBuilder.RenameColumn(
                name: "Content",
                table: "Comments",
                newName: "ContentText");

            migrationBuilder.AddColumn<int>(
                name: "RestrictedToRole",
                table: "Posts",
                type: "integer",
                nullable: true);
        }
    }
}
