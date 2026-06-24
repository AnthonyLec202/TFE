import { useState } from 'react';
import { deleteComment, updateComment } from '../../services/wallService';
import type { CommentResponse } from '../../types/wall';
import type { PatientUserRole } from '../../types/patient';
import { CommentItem } from './components/CommentItem';
import { canModify, PURGED_CONTENT } from './utils/wallUtils';

interface Props {
  comment: CommentResponse;
  patientId: string;
  postId: string;
  currentUserId: string;
  userRole: PatientUserRole;
  // Archived dossier → read-only: withdraw edit/delete on existing comments.
  readOnly?: boolean;
  onUpdated: (c: CommentResponse) => void;
  onDeleted: (commentId: string) => void;
}

export function CommentItemContainer({
  comment, patientId, postId, currentUserId, userRole, readOnly = false, onUpdated, onDeleted,
}: Props) {
  const [saving, setSaving] = useState(false);

  const isPurged = comment.content === PURGED_CONTENT;
  const canEdit = !readOnly && canModify(comment.createdAt, comment.createdById, currentUserId, userRole) && !isPurged;
  const canDelete = !readOnly && (userRole === 'Admin' || canEdit);

  async function handleSave(content: string) {
    setSaving(true);
    try {
      const updated = await updateComment(patientId, postId, comment.id, { content });
      onUpdated(updated);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await deleteComment(patientId, postId, comment.id);
      onDeleted(comment.id);
    } catch {
      // no error UI for delete — matches original behaviour
    }
  }

  return (
    <CommentItem
      comment={comment}
      isPurged={isPurged}
      canEdit={canEdit}
      canDelete={canDelete}
      onSave={handleSave}
      onDelete={handleDelete}
      saving={saving}
    />
  );
}
