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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-1">
      <div className="flex flex-col gap-2">
        <label className="text-[12.5px] font-medium text-taupe-600">Code d'invitation</label>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="A3F9K2Z1"
          maxLength={8}
          required
          autoComplete="off"
          className="w-full rounded-xl border-2 border-petrol-100 bg-petrol-50 px-4 py-4 text-center text-2xl font-mono tracking-widest uppercase text-ink placeholder:text-taupe-400 focus:outline-none focus:border-petrol-600 focus:bg-white transition-colors"
        />
        <p className="text-xs text-center text-taupe-400">8 caractères alphanumériques</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-sand-200" />
        <span className="text-xs font-medium text-taupe-400 uppercase tracking-wide">
          Créez votre compte
        </span>
        <div className="flex-1 border-t border-sand-200" />
      </div>

      <Button type="submit" disabled={!code.trim()} className="w-full mt-auto">
        Continuer
      </Button>
    </form>
  );
}
