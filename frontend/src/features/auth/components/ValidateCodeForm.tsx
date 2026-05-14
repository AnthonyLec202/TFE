import { useState } from 'react';
import { Button } from '../../../components/ui/Button';

interface Props {
  onSubmit: (code: string) => void;
}

export function ValidateCodeForm({ onSubmit }: Props) {
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
          onChange={e => setCode(e.target.value)}
          placeholder="A3F9K2Z1"
          maxLength={8}
          required
          autoComplete="off"
          className="w-full rounded-xl border-2 border-blue-100 bg-blue-50 px-4 py-4 text-center text-2xl font-mono tracking-widest uppercase text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
        />
        <p className="text-xs text-center text-slate-400">8 caractères alphanumériques</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-slate-100" />
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          Créez votre compte
        </span>
        <div className="flex-1 border-t border-slate-100" />
      </div>

      <Button type="submit" disabled={!code.trim()} className="w-full">
        Continuer
      </Button>
    </form>
  );
}
