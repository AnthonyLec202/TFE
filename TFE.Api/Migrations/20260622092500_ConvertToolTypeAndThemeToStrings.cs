using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TFE.Api.Migrations
{
    /// <inheritdoc />
    public partial class ConvertToolTypeAndThemeToStrings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // PostgreSQL has no implicit/assignment cast from integer to text, so the column-type
            // change requires an explicit USING clause (which AlterColumn cannot emit). Convert the
            // columns, then map the legacy enum ordinals to the free-form French category labels the
            // application now uses, so the seeded catalog keeps its categories.
            migrationBuilder.Sql(@"ALTER TABLE ""TherapeuticTools"" ALTER COLUMN ""Type"" TYPE text USING ""Type""::text;");
            migrationBuilder.Sql(@"ALTER TABLE ""TherapeuticTools"" ALTER COLUMN ""Theme"" TYPE text USING ""Theme""::text;");

            // ToolType ordinals: 0 BehavioralContract, 1 CognitiveRestructuringSheet,
            // 2 ExposureProtocol, 3 RelaxationExercise, 4 PsychoeducationMaterial.
            migrationBuilder.Sql(@"
                UPDATE ""TherapeuticTools"" SET ""Type"" = CASE ""Type""
                    WHEN '0' THEN 'Contrat comportemental'
                    WHEN '1' THEN 'Fiche de restructuration cognitive'
                    WHEN '2' THEN 'Protocole d''exposition'
                    WHEN '3' THEN 'Exercice de relaxation'
                    WHEN '4' THEN 'Matériel de psychoéducation'
                    ELSE ""Type"" END;");

            // CbtTheme ordinals: 0 AnxietyManagement, 1 EmotionalRegulation, 2 SocialSkills,
            // 3 CognitiveDistortions, 4 Assertiveness.
            migrationBuilder.Sql(@"
                UPDATE ""TherapeuticTools"" SET ""Theme"" = CASE ""Theme""
                    WHEN '0' THEN 'Gestion de l''anxiété'
                    WHEN '1' THEN 'Régulation émotionnelle'
                    WHEN '2' THEN 'Compétences sociales'
                    WHEN '3' THEN 'Distorsions cognitives'
                    WHEN '4' THEN 'Affirmation de soi'
                    ELSE ""Theme"" END;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Reverse the label mapping back to the enum ordinals, then revert the column type to
            // integer with an explicit USING cast.
            migrationBuilder.Sql(@"
                UPDATE ""TherapeuticTools"" SET ""Type"" = CASE ""Type""
                    WHEN 'Contrat comportemental' THEN '0'
                    WHEN 'Fiche de restructuration cognitive' THEN '1'
                    WHEN 'Protocole d''exposition' THEN '2'
                    WHEN 'Exercice de relaxation' THEN '3'
                    WHEN 'Matériel de psychoéducation' THEN '4'
                    ELSE '0' END;");
            migrationBuilder.Sql(@"
                UPDATE ""TherapeuticTools"" SET ""Theme"" = CASE ""Theme""
                    WHEN 'Gestion de l''anxiété' THEN '0'
                    WHEN 'Régulation émotionnelle' THEN '1'
                    WHEN 'Compétences sociales' THEN '2'
                    WHEN 'Distorsions cognitives' THEN '3'
                    WHEN 'Affirmation de soi' THEN '4'
                    ELSE '0' END;");

            migrationBuilder.Sql(@"ALTER TABLE ""TherapeuticTools"" ALTER COLUMN ""Type"" TYPE integer USING ""Type""::integer;");
            migrationBuilder.Sql(@"ALTER TABLE ""TherapeuticTools"" ALTER COLUMN ""Theme"" TYPE integer USING ""Theme""::integer;");
        }
    }
}
