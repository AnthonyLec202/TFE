import { useState } from 'react';
import { createComment, createCommentWithAttachments, deletePost, updatePost } from '../../services/wallService';
import type { CommentResponse, PostResponse } from '../../types/wall';
import type { PatientUserRole } from '../../types/patient';
import { PostCard } from './components/PostCard';
import { CommentItemContainer } from './CommentItemContainer';
import { canModify, PURGED_CONTENT } from './utils/wallUtils';

interface Props {
  post: PostResponse;
  patientId: string;
  currentUserId: string;
  userRole: PatientUserRole;
  // Archived dossier → suppress every mutation control (edit/delete, comment composer).
  readOnly?: boolean;
  onUpdated: (p: PostResponse) => void;
  onDeleted: (postId: string) => void;
  onCommentAdded: (comment: CommentResponse) => void;
}

export function PostCardContainer({
  post, patientId, currentUserId, userRole, readOnly = false, onUpdated, onDeleted, onCommentAdded,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [comments, setComments] = useState<CommentResponse[]>(post.comments);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Re-sync local comments when the post prop is replaced by the parent (e.g. after a sibling mutation
  // triggers updatePostState and the server returns a new post object with updated comment data).
  // Performed during render: an effect would show the previous comment list for one commit first.
  const [syncedComments, setSyncedComments] = useState(post.comments);
  if (syncedComments !== post.comments) {
    setSyncedComments(post.comments);
    setComments(post.comments);
  }

  const isPurged = post.content === PURGED_CONTENT;
  const isAdmin = userRole === 'Admin';
  // A read-only (archived) wall withdraws all mutation rights, mirroring the backend guard.
  const canEdit = !readOnly && canModify(post.createdAt, post.createdById, currentUserId, userRole) && !isPurged;
  // Admins can delete purged posts (author account deleted) — the backend enforces the same rule.
  const canDelete = !readOnly && (isAdmin || canEdit);

  async function handleSavePost(content: string, excludedRoles: string[]) {
    setSaving(true);
    try {
      const updated = await updatePost(patientId, post.id, { content, excludedRoles });
      onUpdated(updated);
    } finally {
      setSaving(false);
    }
    // throws on error — propagated to PostCard so it keeps the edit form open
  }

  async function handleDeletePost() {
    setDeleting(true);
    try {
      await deletePost(patientId, post.id);
      onDeleted(post.id);
    } catch {
      // no error UI for delete — matches original behaviour
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddComment(content: string, files: File[]) {
    setSubmittingComment(true);
    try {
      const newComment = files.length > 0
        ? await createCommentWithAttachments(patientId, post.id, content, files)
        : await createComment(patientId, post.id, { content });
      // Route through the parent's addCommentToPost (same path as SignalR receivers) so the
      // dedup guard in that function blocks the subsequent SignalR broadcast for the sender.
      onCommentAdded(newComment);
    } finally {
      setSubmittingComment(false);
    }
  }

  function handleCommentUpdated(updated: CommentResponse) {
    setComments(prev => prev.map(c => c.id === updated.id ? updated : c));
  }

  function handleCommentDeleted(commentId: string) {
    setComments(prev => prev.filter(c => c.id !== commentId));
  }

  const commentItems = comments.map(c => (
    <CommentItemContainer
      key={c.id}
      comment={c}
      patientId={patientId}
      postId={post.id}
      currentUserId={currentUserId}
      userRole={userRole}
      readOnly={readOnly}
      onUpdated={handleCommentUpdated}
      onDeleted={handleCommentDeleted}
    />
  ));

  return (
    <PostCard
      post={post}
      canEdit={canEdit}
      canDelete={canDelete}
      isPurged={isPurged}
      isAdmin={isAdmin}
      readOnly={readOnly}
      onSavePost={handleSavePost}
      onDeletePost={handleDeletePost}
      saving={saving}
      deleting={deleting}
      commentCount={comments.length}
      commentItems={commentItems}
      onAddComment={handleAddComment}
      submittingComment={submittingComment}
    />
  );
}
