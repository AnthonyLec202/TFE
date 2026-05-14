import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { CommentResponse } from '../../../types/wall';
import type { PatientUserRole } from '../../../types/patient';
import { Button } from '../../../components/ui/Button';
import { PURGED_CONTENT, canModify, metaLabel } from '../utils/wallUtils';

export interface CommentItemProps {
  comment: CommentResponse;
  currentUserId: string;
  userRole: PatientUserRole;
  onSave: (content: string) => Promise<void>;
  onDelete: () => Promise<void>;
  saving: boolean;
}

export function CommentItem({ comment, currentUserId, userRole, onSave, onDelete, saving }: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  const isPurged = comment.content === PURGED_CONTENT;
  const allowed = canModify(comment.createdAt, comment.createdById, currentUserId, userRole);

  async function handleSave() {
    if (!editContent.trim()) return;
    try {
      await onSave(editContent.trim());
      setEditing(false);
    } catch {
      // container propagates on error — edit form stays open
    }
  }

  return (
    <div className={`flex flex-col gap-1 pl-4 border-l-2 ${isPurged ? 'border-slate-200 opacity-60' : 'border-slate-100'}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-slate-500">
          {metaLabel(comment.authorFirstName, comment.authorLastName, comment.authorRole, comment.createdAt, comment.updatedAt)}
        </span>
        {allowed && !editing && !isPurged && (
          <div className="flex items-center gap-1">
            <button onClick={() => setEditing(true)} className="text-slate-300 hover:text-slate-500 transition-colors">
              <Pencil className="h-3 w-3" />
            </button>
            <button onClick={onDelete} className="text-slate-300 hover:text-red-500 transition-colors">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="flex gap-2 items-end">
          <textarea
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            rows={2}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex flex-col gap-1">
            <Button size="sm" loading={saving} onClick={handleSave}>OK</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>✕</Button>
          </div>
        </div>
      ) : isPurged ? (
        <p className="text-sm italic text-slate-400 bg-slate-50 rounded px-2 py-1 select-none">
          {comment.content}
        </p>
      ) : (
        <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.content}</p>
      )}
    </div>
  );
}
