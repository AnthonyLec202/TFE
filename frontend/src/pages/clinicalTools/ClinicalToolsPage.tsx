import { ClinicalToolsContainer } from '../../features/clinicalTools';

export function ClinicalToolsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Mes Outils</h1>
        <p className="text-sm text-slate-500">
          Outils thérapeutiques TCC — recherche locale instantanée, disponible hors-ligne.
        </p>
      </header>
      <ClinicalToolsContainer />
    </div>
  );
}
