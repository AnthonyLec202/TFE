using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TFE.Api.Migrations
{
    /// <inheritdoc />
    public partial class CascadeDeleteOnPatient : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CareTeams_Patients_PatientId",
                table: "CareTeams");

            migrationBuilder.DropForeignKey(
                name: "FK_Posts_Patients_PatientId",
                table: "Posts");

            migrationBuilder.DropForeignKey(
                name: "FK_Sessions_Patients_PatientId",
                table: "Sessions");

            migrationBuilder.AddForeignKey(
                name: "FK_CareTeams_Patients_PatientId",
                table: "CareTeams",
                column: "PatientId",
                principalTable: "Patients",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Posts_Patients_PatientId",
                table: "Posts",
                column: "PatientId",
                principalTable: "Patients",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Sessions_Patients_PatientId",
                table: "Sessions",
                column: "PatientId",
                principalTable: "Patients",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CareTeams_Patients_PatientId",
                table: "CareTeams");

            migrationBuilder.DropForeignKey(
                name: "FK_Posts_Patients_PatientId",
                table: "Posts");

            migrationBuilder.DropForeignKey(
                name: "FK_Sessions_Patients_PatientId",
                table: "Sessions");

            migrationBuilder.AddForeignKey(
                name: "FK_CareTeams_Patients_PatientId",
                table: "CareTeams",
                column: "PatientId",
                principalTable: "Patients",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Posts_Patients_PatientId",
                table: "Posts",
                column: "PatientId",
                principalTable: "Patients",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Sessions_Patients_PatientId",
                table: "Sessions",
                column: "PatientId",
                principalTable: "Patients",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
