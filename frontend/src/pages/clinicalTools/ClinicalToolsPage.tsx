import { useNavigate } from 'react-router-dom';
import { ClinicalToolsContainer } from '../../features/clinicalTools';
import { useApiReachability } from '../../core/offline/hooks/useApiReachability';
import { OfflinePill } from '../../components/ui/OfflinePill';

export function ClinicalToolsPage() {
  const navigate = useNavigate();
  const isOnline = useApiReachability();

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-[30px] font-semibold tracking-[-0.015em] text-ink">Mes outils</h1>
          <p className="text-[14.5px] text-taupe-500">
            Matériauthèque thérapeutique TCC — recherche locale instantanée, disponible hors-ligne.
          </p>
        </div>
        {!isOnline && <OfflinePill />}
      </div>
      <ClinicalToolsContainer onSelectTool={id => navigate(`/clinical-tools/${id}`)} />
    </div>
  );
}
