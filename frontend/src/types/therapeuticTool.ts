import type { ToolType, CbtTheme } from '../core/offline/LocalDatabase';

/** Server projection of a therapeutic tool (mirrors TFE.Api.DTOs.ClinicalTools.TherapeuticToolResponse). */
export interface TherapeuticToolResponse {
  id: string;
  title: string;
  description: string;
  type: ToolType;
  theme: CbtTheme;
  downGradingStrategy: string;
  upGradingStrategy: string;
}

/** Request body to create a tool. The optional id lets an offline-authored tool keep a stable identity. */
export interface CreateTherapeuticToolPayload {
  id?: string;
  title: string;
  description: string;
  type: ToolType;
  theme: CbtTheme;
  downGradingStrategy: string;
  upGradingStrategy: string;
}

/** Request body to edit an existing tool. */
export type UpdateTherapeuticToolPayload = Omit<CreateTherapeuticToolPayload, 'id'>;
