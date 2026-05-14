import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardContainer } from '../../features/patients';
import { ConsumeInvitationContainer } from '../../features/invitations';
import { useAuth } from '../../features/auth';

export function DashboardPage() {
  const navigate = useNavigate();
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
        onSelectPatient={id => navigate(`/patients/${id}`)}
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
