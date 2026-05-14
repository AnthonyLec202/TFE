import { useState } from 'react';
import { Button } from '../../../components/ui/Button';

interface Props {
  onSubmit: (code: string) => void;
  loading: boolean;
  error: string;
}

export function ConsumeInvitationForm({ onSubmit, loading, error }: Props) {
  const [code, setCode] = useState('');

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!code.trim()) return;
    onSubmit(code.toUpperCase().trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-700">Code d'invitation</label>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="A3F9K2Z1"
          maxLength={8}
          required
          autoComplete="off"
          autoFocus
          className="w-full rounded-xl border-2 border-blue-100 bg-blue-50 px-4 py-4 text-center text-2xl font-mono tracking-widest uppercase text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
        />
        <p className="text-xs text-center text-slate-400">8 caractères alphanumériques</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <Button type="submit" loading={loading} disabled={code.trim().length !== 8} className="w-full">
        Rejoindre
      </Button>
    </form>
  );
}
