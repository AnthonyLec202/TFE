import { useState } from 'react';
import { Download, FileText, Pencil, Trash2 } from 'lucide-react';
import type { CommentResponse } from '../../../types/wall';
import { Button } from '../../../components/ui/Button';
import { metaLabel } from '../utils/wallUtils';

export interface CommentItemProps {
  comment: CommentResponse;
  isPurged: boolean;
  canEdit: boolean;
  onSave: (content: string) => Promise<void>;
  onDelete: () => Promise<void>;
  saving: boolean;
}

export function CommentItem({ comment, isPurged, canEdit, onSave, onDelete, saving }: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

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
        {canEdit && !editing && (
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
      ) : comment.content ? (
        <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.content}</p>
      ) : null}

      {/* Attachments */}
      {!editing && !isPurged && comment.attachments?.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          {comment.attachments.map(attachment => (
            attachment.filetype.includes('image') ? (
              <a
                key={attachment.id}
                href={attachment.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <img
                  src={attachment.fileUrl}
                  alt={attachment.filename}
                  className="max-h-40 w-full rounded-md object-cover border border-slate-100"
                />
              </a>
            ) : (
              <a
                key={attachment.id}
                href={attachment.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="flex-1 truncate">{attachment.filename}</span>
                <Download className="h-3 w-3 shrink-0 text-slate-400" />
              </a>
            )
          ))}
        </div>
      )}
    </div>
  );
}
