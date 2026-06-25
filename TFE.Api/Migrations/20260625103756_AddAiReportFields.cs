using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TFE.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAiReportFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AiReport",
                table: "Sessions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsReportValidated",
                table: "Sessions",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AiReport",
                table: "Sessions");

            migrationBuilder.DropColumn(
                name: "IsReportValidated",
                table: "Sessions");
        }
    }
}
