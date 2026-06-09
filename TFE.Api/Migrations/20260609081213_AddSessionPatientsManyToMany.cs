using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TFE.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSessionPatientsManyToMany : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Create PatientSession join table first so we can populate it
            //    from the old PatientId column before that column is dropped.
            migrationBuilder.CreateTable(
                name: "PatientSession",
                columns: table => new
                {
                    SessionsId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientsId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PatientSession", x => new { x.SessionsId, x.PatientsId });
                    table.ForeignKey(
                        name: "FK_PatientSession_Patients_PatientsId",
                        column: x => x.PatientsId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PatientSession_Sessions_SessionsId",
                        column: x => x.SessionsId,
                        principalTable: "Sessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // 2. Migrate existing one-to-many data into the new join table
            //    before the source column is removed.
            migrationBuilder.Sql(
                "INSERT INTO \"PatientSession\" (\"SessionsId\", \"PatientsId\") " +
                "SELECT \"Id\", \"PatientId\" FROM \"Sessions\" WHERE \"PatientId\" IS NOT NULL;");

            // 3. Remove the old FK, index, and column.
            migrationBuilder.DropForeignKey(
                name: "FK_Sessions_Patients_PatientId",
                table: "Sessions");

            migrationBuilder.DropIndex(
                name: "IX_Sessions_PatientId",
                table: "Sessions");

            migrationBuilder.DropColumn(
                name: "PatientId",
                table: "Sessions");

            // 4. Update remaining columns on Sessions.
            migrationBuilder.AlterColumn<string>(
                name: "Date",
                table: "Sessions",
                type: "text",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.AddColumn<string>(
                name: "Time",
                table: "Sessions",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Title",
                table: "Sessions",
                type: "text",
                nullable: false,
                defaultValue: "");

            // 5. Create the Notes table for the local-first sync feature.
            migrationBuilder.CreateTable(
                name: "Notes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Content = table.Column<string>(type: "text", nullable: false),
                    LastModifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Notes_Sessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "Sessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Notes_SessionId",
                table: "Notes",
                column: "SessionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PatientSession_PatientsId",
                table: "PatientSession",
                column: "PatientsId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Notes");

            migrationBuilder.DropTable(
                name: "PatientSession");

            migrationBuilder.DropColumn(
                name: "Time",
                table: "Sessions");

            migrationBuilder.DropColumn(
                name: "Title",
                table: "Sessions");

            migrationBuilder.AlterColumn<DateTime>(
                name: "Date",
                table: "Sessions",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<Guid>(
                name: "PatientId",
                table: "Sessions",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_Sessions_PatientId",
                table: "Sessions",
                column: "PatientId");

            migrationBuilder.AddForeignKey(
                name: "FK_Sessions_Patients_PatientId",
                table: "Sessions",
                column: "PatientId",
                principalTable: "Patients",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
