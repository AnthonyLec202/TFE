// Public façade of the clinicalTools (Matériauthèque) feature.
export { ClinicalToolsContainer } from './ClinicalToolsContainer';
export type { ToolAssociationContext } from './ClinicalToolsContainer';
export { ToolDetailContainer } from './ToolDetailContainer';
export { syncTherapeuticToolsFromServer } from './services/therapeuticToolSyncService';
// Read-side resolver: lets a session-owning consumer turn its associated tool ids into tool records
// (e.g. to list their titles) without reaching into the feature's internals.
export { getToolsByIds } from './services/localTherapeuticToolService';
