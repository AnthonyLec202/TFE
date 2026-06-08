import { useRef, useState } from 'react';
import { Paperclip, Send, X } from 'lucide-react';
import type { PatientUserRole } from '../../../types/patient';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { SPECIFIC_ROLES, pillClass, whitelistToBlacklist } from '../utils/wallUtils';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export interface CreatePostFormProps {
  userRole: PatientUserRole;
  onSubmit: (content: string, excludedRoles: string[], files: File[]) => Promise<void>;
  loading: boolean;
  error: string;
}

export function CreatePostForm({ userRole, onSubmit, loading, error }: CreatePostFormProps) {
  const [content, setContent] = useState('');
  const [visibleToRoles, setVisibleToRoles] = useState<string[]>([]); // [] = TOUS
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleVisibility(role: string) {
    setVisibleToRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role],
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []);
    const valid = incoming.filter(f => f.size <= MAX_FILE_SIZE);
    setSelectedFiles(prev => [...prev, ...valid]);
    // Reset the input so the same file can be re-selected after removal
    e.target.value = '';
  }

  function removeFile(index: number) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      await onSubmit(content.trim(), whitelistToBlacklist(visibleToRoles), selectedFiles);
      setContent('');
      setVisibleToRoles([]);
      setSelectedFiles([]);
    } catch {
      // error displayed via the error prop injected by the container
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

        {selectedFiles.length > 0 && (
          <ul className="flex flex-col gap-1">
            {selectedFiles.map((file, index) => (
              <li
                key={index}
                className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700"
              >
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="shrink-0 text-slate-400 hover:text-red-500 transition-colors"
                  aria-label={`Retirer ${file.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

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

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors"
            aria-label="Joindre des fichiers"
          >
            <Paperclip className="h-4 w-4" />
            Joindre un fichier
          </button>

          <Button type="submit" size="sm" loading={loading} disabled={(!content || !content.trim()) && selectedFiles.length === 0}>
            <Send className="h-3.5 w-3.5" />
            Publier
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.docx"
          className="hidden"
          onChange={handleFileChange}
        />
      </form>
    </Card>
  );
}
