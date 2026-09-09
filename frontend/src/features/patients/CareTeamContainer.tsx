import { useEffect, useState } from 'react';
import { getCareTeam, removeCareTeamMember } from '../../services/patientService';
import type { CareTeamMemberResponse } from '../../types/patient';
import { CareTeamModal } from './components/CareTeamModal';

interface Props {
  patientId: string;
  /** Whether the current user holds the Admin role and may remove members. */
  isAdmin: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export function CareTeamContainer({ patientId, isAdmin, isOpen, onClose }: Props) {
  const [members, setMembers] = useState<CareTeamMemberResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  // Fetch the care team each time the modal opens, so the list reflects any recent changes.
  const [requested, setRequested] = useState({ isOpen, patientId });
  if (requested.isOpen !== isOpen || requested.patientId !== patientId) {
    setRequested({ isOpen, patientId });
    if (isOpen) {
      setLoading(true);
      setError('');
    }
  }

  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;
    getCareTeam(patientId)
      .then(data => { if (!ignore) setMembers(data); })
      .catch(() => { if (!ignore) setError('Impossible de charger l\'équipe.'); })
      .finally(() => { if (!ignore) setLoading(false); });

    return () => { ignore = true; };
  }, [isOpen, patientId]);

  async function handleRemove(userId: string): Promise<void> {
    setRemovingUserId(userId);
    setError('');
    try {
      await removeCareTeamMember(patientId, userId);
      // Local state update on success: drop the removed member without a refetch.
      setMembers(prev => prev.filter(member => member.userId !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de retirer ce membre.');
    } finally {
      setRemovingUserId(null);
    }
  }

  return (
    <CareTeamModal
      isOpen={isOpen}
      members={members}
      loading={loading}
      error={error}
      isAdmin={isAdmin}
      removingUserId={removingUserId}
      onRemove={handleRemove}
      onClose={onClose}
    />
  );
}
