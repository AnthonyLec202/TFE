import { useState } from 'react';
import { createComment, deletePost, updatePost } from '../../services/wallService';
import type { CommentResponse, PostResponse } from '../../types/wall';
import type { PatientUserRole } from '../../types/patient';
import { PostCard } from './components/PostCard';
import { CommentItemContainer } from './CommentItemContainer';

interface Props {
  post: PostResponse;
  patientId: string;
  currentUserId: string;
  userRole: PatientUserRole;
  onUpdated: (p: PostResponse) => void;
  onDeleted: (postId: string) => void;
}

export function PostCardContainer({
  post, patientId, currentUserId, userRole, onUpdated, onDeleted,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [comments, setComments] = useState<CommentResponse[]>(post.comments);
  const [submittingComment, setSubmittingComment] = useState(false);

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
    try {
      await deletePost(patientId, post.id);
      onDeleted(post.id);
    } catch {
      // no error UI for delete — matches original behaviour
    }
  }

  async function handleAddComment(content: string) {
    setSubmittingComment(true);
    try {
      const newComment = await createComment(patientId, post.id, { content });
      setComments(prev => [...prev, newComment]);
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
      onUpdated={handleCommentUpdated}
      onDeleted={handleCommentDeleted}
    />
  ));

  return (
    <PostCard
      post={post}
      currentUserId={currentUserId}
      userRole={userRole}
      onSavePost={handleSavePost}
      onDeletePost={handleDeletePost}
      saving={saving}
      commentCount={comments.length}
      commentItems={commentItems}
      onAddComment={handleAddComment}
      submittingComment={submittingComment}
    />
  );
}
