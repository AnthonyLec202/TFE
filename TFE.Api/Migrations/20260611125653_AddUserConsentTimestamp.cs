using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TFE.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUserConsentTimestamp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ConsentGivenAt",
                table: "AspNetUsers",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConsentGivenAt",
                table: "AspNetUsers");
        }
    }
}
