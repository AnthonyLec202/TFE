import { ToolType, CbtTheme } from '../../../core/offline/LocalDatabase';

// Human-readable French labels for the clinical enums, presented to the practitioner. Pure data —
// no React, no I/O — so it lives in the feature's utils per the architecture rules.

export const TOOL_TYPE_LABELS: Record<ToolType, string> = {
  [ToolType.BehavioralContract]: 'Contrat comportemental',
  [ToolType.CognitiveRestructuringSheet]: 'Fiche de restructuration cognitive',
  [ToolType.ExposureProtocol]: "Protocole d'exposition",
  [ToolType.RelaxationExercise]: 'Exercice de relaxation',
  [ToolType.PsychoeducationMaterial]: 'Matériel de psychoéducation',
};

export const CBT_THEME_LABELS: Record<CbtTheme, string> = {
  [CbtTheme.AnxietyManagement]: "Gestion de l'anxiété",
  [CbtTheme.EmotionalRegulation]: 'Régulation émotionnelle',
  [CbtTheme.SocialSkills]: 'Compétences sociales',
  [CbtTheme.CognitiveDistortions]: 'Distorsions cognitives',
  [CbtTheme.Assertiveness]: 'Affirmation de soi',
};

export interface EnumOption<T> {
  value: T;
  label: string;
}

// Ordered option lists for the filter/select controls. Derived once from the label maps so a new
// enum member only has to be added to the map above.
export const TOOL_TYPE_OPTIONS: EnumOption<ToolType>[] = (
  Object.values(ToolType).filter(v => typeof v === 'number') as ToolType[]
).map(value => ({ value, label: TOOL_TYPE_LABELS[value] }));

export const CBT_THEME_OPTIONS: EnumOption<CbtTheme>[] = (
  Object.values(CbtTheme).filter(v => typeof v === 'number') as CbtTheme[]
).map(value => ({ value, label: CBT_THEME_LABELS[value] }));
