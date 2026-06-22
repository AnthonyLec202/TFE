import { useNavigate } from 'react-router-dom';
import { ClinicalToolsContainer } from '../../features/clinicalTools';
import { useGlobalNetworkState } from '../../core/offline/NetworkStateProvider';
import { OfflinePill } from '../../components/ui/OfflinePill';

export function ClinicalToolsPage() {
  const navigate = useNavigate();
  // Read the persisted global state synchronously — no per-page ping, so no flash on remount.
  const isOnline = useGlobalNetworkState();

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-[30px] font-semibold tracking-[-0.015em] text-ink">Mes outils</h1>
        
        </div>
        {!isOnline && <OfflinePill />}
      </div>
      <ClinicalToolsContainer onSelectTool={id => navigate(`/clinical-tools/${id}`)} />
    </div>
  );
}
