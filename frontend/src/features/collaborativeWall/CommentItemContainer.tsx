import { useState } from 'react';
import { deleteComment, updateComment } from '../../services/wallService';
import type { CommentResponse } from '../../types/wall';
import type { PatientUserRole } from '../../types/patient';
import { CommentItem } from './components/CommentItem';

interface Props {
  comment: CommentResponse;
  patientId: string;
  postId: string;
  currentUserId: string;
  userRole: PatientUserRole;
  onUpdated: (c: CommentResponse) => void;
  onDeleted: (commentId: string) => void;
}

export function CommentItemContainer({
  comment, patientId, postId, currentUserId, userRole, onUpdated, onDeleted,
}: Props) {
  const [saving, setSaving] = useState(false);

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
      currentUserId={currentUserId}
      userRole={userRole}
      onSave={handleSave}
      onDelete={handleDelete}
      saving={saving}
    />
  );
}
