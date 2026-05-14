import { X } from 'lucide-react';
import { useConsumeInvitation } from './hooks/useConsumeInvitation';
import { ConsumeInvitationForm } from './components/ConsumeInvitationForm';

interface Props {
  onSuccess: () => void;
  onClose: () => void;
}

export function ConsumeInvitationContainer({ onSuccess, onClose }: Props) {
  const { loading, error, consume, reset } = useConsumeInvitation();

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(code: string) {
    try {
      await consume(code);
      onSuccess();
    } catch {
      // error is shown via the form's error prop — no further action needed
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/25 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget && !loading) handleClose(); }}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-sm p-6 flex flex-col gap-5">

        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            Rejoindre un dossier patient
          </h3>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-slate-500 leading-relaxed">
          Entrez le code d'invitation que vous avez reçu pour accéder au dossier d'un patient.
        </p>

        <ConsumeInvitationForm
          onSubmit={handleSubmit}
          loading={loading}
          error={error}
        />

      </div>
    </div>
  );
}
