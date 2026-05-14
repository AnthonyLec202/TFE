import { type ReactNode, useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquare, Pencil, Send, Trash2 } from 'lucide-react';
import type { PostResponse } from '../../../types/wall';
import type { PatientUserRole } from '../../../types/patient';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import {
  PURGED_CONTENT, SPECIFIC_ROLES,
  blacklistToWhitelist, canModify, metaLabel, pillClass, whitelistToBlacklist,
} from '../utils/wallUtils';

export interface PostCardProps {
  post: PostResponse;
  currentUserId: string;
  userRole: PatientUserRole;
  // Post action callbacks
  onSavePost: (content: string, excludedRoles: string[]) => Promise<void>;
  onDeletePost: () => Promise<void>;
  saving: boolean;
  // Comment thread
  commentCount: number;
  commentItems: ReactNode;
  onAddComment: (content: string) => Promise<void>;
  submittingComment: boolean;
}

export function PostCard({
  post, currentUserId, userRole,
  onSavePost, onDeletePost, saving,
  commentCount, commentItems, onAddComment, submittingComment,
}: PostCardProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [visibleToRoles, setVisibleToRoles] = useState<string[]>(() => blacklistToWhitelist(post.excludedRoles));
  const [showComments, setShowComments] = useState(false);
  const [commentInput, setCommentInput] = useState('');

  const isPurged = post.content === PURGED_CONTENT;
  const allowed = canModify(post.createdAt, post.createdById, currentUserId, userRole) && !isPurged;

  function enterEdit() {
    setEditContent(post.content);
    setVisibleToRoles(blacklistToWhitelist(post.excludedRoles));
    setEditing(true);
  }

  function toggleVisibility(role: string) {
    setVisibleToRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role],
    );
  }

  async function handleSaveClick() {
    try {
      await onSavePost(editContent.trim(), whitelistToBlacklist(visibleToRoles));
      setEditing(false);
    } catch {
      // container propagates on error — edit form stays open
    }
  }

  async function handleAddCommentSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!commentInput.trim()) return;
    try {
      await onAddComment(commentInput.trim());
      setCommentInput('');
    } catch {
      // silent — matches original behaviour
    }
  }

  const visibleByLabels = blacklistToWhitelist(post.excludedRoles)
    .map(v => SPECIFIC_ROLES.find(r => r.value === v)?.label ?? v);

  return (
    <Card className="p-5 flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-slate-500">
          {metaLabel(post.authorFirstName, post.authorLastName, post.authorRole, post.createdAt, post.updatedAt)}
        </span>
        {allowed && !editing && (
          <div className="flex items-center gap-1.5">
            <button onClick={enterEdit} className="text-slate-400 hover:text-slate-600 transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDeletePost} className="text-slate-400 hover:text-red-500 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Visibility badge (Admin view, not editing) */}
      {userRole === 'Admin' && !editing && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400">Visible par :</span>
          {post.excludedRoles.length === 0 ? (
            <span className="text-xs font-medium text-slate-500">Tous</span>
          ) : visibleByLabels.length === 0 ? (
            <span className="text-xs font-medium text-amber-600">Personne</span>
          ) : (
            visibleByLabels.map(label => (
              <span key={label} className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200">
                {label}
              </span>
            ))
          )}
        </div>
      )}

      {/* Content / Edit form */}
      {editing ? (
        <div className="flex flex-col gap-3">
          <textarea
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          {userRole === 'Admin' && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Visible par :</p>
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
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>Annuler</Button>
            <Button size="sm" loading={saving} onClick={handleSaveClick}>Enregistrer</Button>
          </div>
        </div>
      ) : isPurged ? (
        <p className="text-sm italic text-slate-400 bg-slate-50 rounded-lg px-3 py-2 select-none">
          {post.content}
        </p>
      ) : (
        <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{post.content}</p>
      )}

      {/* Comments */}
      <div className="border-t border-slate-100 pt-3 flex flex-col gap-3">
        <button
          onClick={() => setShowComments(v => !v)}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors w-fit"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {commentCount} commentaire{commentCount !== 1 ? 's' : ''}
          {showComments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {showComments && (
          <div className="flex flex-col gap-3">
            {commentItems}
            <form onSubmit={handleAddCommentSubmit} className="flex gap-2 items-end">
              <textarea
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                placeholder="Ajouter un commentaire…"
                rows={2}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button type="submit" size="sm" variant="secondary" loading={submittingComment} disabled={!commentInput.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
        )}
      </div>
    </Card>
  );
}
