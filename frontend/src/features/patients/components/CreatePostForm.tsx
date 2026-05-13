import { useState } from 'react';
import { Send } from 'lucide-react';
import { createPost } from '../../../services/wallService';
import type { PostResponse } from '../../../types/wall';
import type { PatientUserRole } from '../../../types/patient';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { SPECIFIC_ROLES, pillClass, whitelistToBlacklist } from '../utils/wallUtils';

export interface CreatePostFormProps {
  patientId: string;
  userRole: PatientUserRole;
  onCreated: (post: PostResponse) => void;
}

export function CreatePostForm({ patientId, userRole, onCreated }: CreatePostFormProps) {
  const [content, setContent] = useState('');
  const [visibleToRoles, setVisibleToRoles] = useState<string[]>([]); // [] = TOUS
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleVisibility(role: string) {
    setVisibleToRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role],
    );
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!content.trim()) return;
    setError('');
    setLoading(true);
    try {
      const post = await createPost(patientId, {
        content: content.trim(),
        excludedRoles: whitelistToBlacklist(visibleToRoles),
      });
      onCreated(post);
      setContent('');
      setVisibleToRoles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-5 flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Partagez une observation, un progrès, un commentaire…"
          rows={3}
          required
          className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        {userRole === 'Admin' && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Visible par :
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setVisibleToRoles([])} className={pillClass(visibleToRoles.length === 0, true)}>
                TOUS
              </button>
              {SPECIFIC_ROLES.map(({ value, label }) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => toggleVisibility(value)}
                  className={pillClass(visibleToRoles.includes(value))}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex justify-end">
          <Button type="submit" size="sm" loading={loading} disabled={!content.trim()}>
            <Send className="h-3.5 w-3.5" />
            Publier
          </Button>
        </div>
      </form>
    </Card>
  );
}
