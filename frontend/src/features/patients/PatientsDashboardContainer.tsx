import { useState } from 'react';
import { useAuth } from '../auth';
import { ConsumeInvitationContainer } from '../invitations';
import { DashboardContainer } from './DashboardContainer';

interface Props {
  onSelectPatient: (id: string) => void;
}

export function PatientsDashboardContainer({ onSelectPatient }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('Admin') ?? false;

  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [dashboardKey, setDashboardKey] = useState(0);

  function handleJoinSuccess() {
    setIsJoinModalOpen(false);
    setDashboardKey(k => k + 1); // forces DashboardContainer to remount and re-fetch
  }

  return (
    <>
      <DashboardContainer
        key={dashboardKey}
        onSelectPatient={onSelectPatient}
        onJoinPatient={!isAdmin ? () => setIsJoinModalOpen(true) : undefined}
      />
      {isJoinModalOpen && (
        <ConsumeInvitationContainer
          onSuccess={handleJoinSuccess}
          onClose={() => setIsJoinModalOpen(false)}
        />
      )}
    </>
  );
}
