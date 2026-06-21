using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TFE.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTherapeuticTools : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TherapeuticTools",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Theme = table.Column<int>(type: "integer", nullable: false),
                    DownGradingStrategy = table.Column<string>(type: "text", nullable: false),
                    UpGradingStrategy = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TherapeuticTools", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SessionTherapeuticTool",
                columns: table => new
                {
                    TherapeuticToolsId = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionsId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SessionTherapeuticTool", x => new { x.TherapeuticToolsId, x.SessionsId });
                    table.ForeignKey(
                        name: "FK_SessionTherapeuticTool_Sessions_SessionsId",
                        column: x => x.SessionsId,
                        principalTable: "Sessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SessionTherapeuticTool_TherapeuticTools_TherapeuticToolsId",
                        column: x => x.TherapeuticToolsId,
                        principalTable: "TherapeuticTools",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SessionTherapeuticTool_SessionsId",
                table: "SessionTherapeuticTool",
                column: "SessionsId");

            migrationBuilder.CreateIndex(
                name: "IX_TherapeuticTools_Theme",
                table: "TherapeuticTools",
                column: "Theme");

            migrationBuilder.CreateIndex(
                name: "IX_TherapeuticTools_Type",
                table: "TherapeuticTools",
                column: "Type");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SessionTherapeuticTool");

            migrationBuilder.DropTable(
                name: "TherapeuticTools");
        }
    }
}
