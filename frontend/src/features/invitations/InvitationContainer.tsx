import { useGenerateInvitation } from './hooks/useGenerateInvitation';
import { InvitationModal } from './components/InvitationModal';

interface Props {
  isOpen: boolean;
  patientId: string;
  onClose: () => void;
}

export function InvitationContainer({ isOpen, patientId, onClose }: Props) {
  const { generating, invitation, error, copied, generate, copyToClipboard, reset } =
    useGenerateInvitation();

  async function handleGenerate(role: string) {
    await generate(patientId, role);
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <InvitationModal
      isOpen={isOpen}
      onClose={handleClose}
      onGenerate={handleGenerate}
      invitation={invitation}
      generating={generating}
      error={error}
      copied={copied}
      onCopy={copyToClipboard}
    />
  );
}
