import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Download, FileText, MessageSquare, Paperclip, Pencil, Send, Trash2, X } from 'lucide-react';
import type { PostResponse } from '../../../types/wall';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import {
  SPECIFIC_ROLES,
  blacklistToWhitelist, metaLabel, pillClass, whitelistToBlacklist,
} from '../utils/wallUtils';

export interface PostCardProps {
  post: PostResponse;
  canEdit: boolean;
  canDelete: boolean;
  isPurged: boolean;
  isAdmin: boolean;
  // Archived dossier → read-only: the comment composer is not rendered.
  readOnly?: boolean;
  // Post action callbacks
  onSavePost: (content: string, excludedRoles: string[]) => Promise<void>;
  onDeletePost: () => Promise<void>;
  saving: boolean;
  // Comment thread
  commentCount: number;
  commentItems: ReactNode;
  onAddComment: (content: string, files: File[]) => Promise<void>;
  submittingComment: boolean;
}

export function PostCard({
  post, canEdit, canDelete, isPurged, isAdmin, readOnly = false,
  onSavePost, onDeletePost, saving,
  commentCount, commentItems, onAddComment, submittingComment,
}: PostCardProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [visibleToRoles, setVisibleToRoles] = useState<string[]>(() => blacklistToWhitelist(post.excludedRoles));
  // Auto-expand the comment thread on mount when the post already has comments, so existing
  // discussion is visible without an extra click. Collapsed by default when there are none.
  const [showComments, setShowComments] = useState(() => commentCount > 0);
  const [commentInput, setCommentInput] = useState('');
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const commentFileInputRef = useRef<HTMLInputElement>(null);

  const MAX_COMMENT_FILE_SIZE = 10 * 1024 * 1024;

  function handleCommentFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []);
    const valid = incoming.filter(f => f.size <= MAX_COMMENT_FILE_SIZE);
    setCommentFiles(prev => [...prev, ...valid]);
    e.target.value = '';
  }

  function removeCommentFile(index: number) {
    setCommentFiles(prev => prev.filter((_, i) => i !== index));
  }

  // Re-sync visibility state when the post is replaced externally (e.g. parent mutation),
  // but only while the edit form is closed to avoid discarding in-progress edits.
  useEffect(() => {
    if (!editing) {
      setVisibleToRoles(blacklistToWhitelist(post.excludedRoles));
    }
  }, [post.excludedRoles, editing]);

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
    if ((!commentInput || !commentInput.trim()) && commentFiles.length === 0) return;
    try {
      await onAddComment(commentInput.trim(), commentFiles);
      setCommentInput('');
      setCommentFiles([]);
    } catch {
      // silent — matches original behaviour
    }
  }

  const visibleByLabels = blacklistToWhitelist(post.excludedRoles)
    .map(v => SPECIFIC_ROLES.find(r => r.value === v)?.label ?? v);

  return (
    <Card id={`post-${post.id}`} className="p-5 flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-slate-500">
          {metaLabel(post.authorFirstName, post.authorLastName, post.authorRole, post.createdAt, post.updatedAt)}
        </span>
        {(canEdit || canDelete) && !editing && (
          <div className="flex items-center gap-1.5">
            {canEdit && (
              <button onClick={enterEdit} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {canDelete && (
              <button onClick={onDeletePost} className="text-slate-400 hover:text-red-500 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Visibility badge (Admin view, not editing) */}
      {isAdmin && !editing && (
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
          {isAdmin && (
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
      ) : post.content ? (
        <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{post.content}</p>
      ) : null}

      {/* Attachments */}
      {!editing && !isPurged && post.attachments?.length > 0 && (
        <div className="flex flex-col gap-2">
          {post.attachments.map(attachment => (
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
                  className="max-h-64 w-full rounded-lg object-cover border border-slate-100"
                />
              </a>
            ) : (
              <a
                key={attachment.id}
                href={attachment.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="flex-1 truncate">{attachment.filename}</span>
                <Download className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              </a>
            )
          ))}
        </div>
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
            {!readOnly && (
            <form onSubmit={handleAddCommentSubmit} className="flex flex-col gap-2">
              <div className="flex gap-2 items-end">
                <textarea
                  value={commentInput}
                  onChange={e => setCommentInput(e.target.value)}
                  placeholder="Ajouter un commentaire…"
                  rows={2}
                  required={commentFiles.length === 0}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => commentFileInputRef.current?.click()}
                    className="flex items-center justify-center h-8 w-8 rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                    aria-label="Joindre un fichier"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </button>
                  <Button
                    type="submit"
                    size="sm"
                    variant="secondary"
                    loading={submittingComment}
                    disabled={!commentInput.trim() && commentFiles.length === 0}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {commentFiles.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {commentFiles.map((file, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600"
                    >
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeCommentFile(index)}
                        className="shrink-0 text-slate-400 hover:text-red-500 transition-colors"
                        aria-label={`Retirer ${file.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <input
                ref={commentFileInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.docx"
                className="hidden"
                onChange={handleCommentFileChange}
              />
            </form>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
