import { useEffect, useState } from 'react';
import { getWall } from '../../../services/wallService';
import type { CommentResponse, PostResponse } from '../../../types/wall';

export interface UseCollaborativeWallResult {
  posts: PostResponse[];
  loading: boolean;
  error: string;
  addPost: (post: PostResponse) => void;
  updatePostState: (updated: PostResponse) => void;
  deletePostState: (postId: string) => void;
  addCommentToPost: (comment: CommentResponse) => void;
  updateCommentInPost: (comment: CommentResponse) => void;
  deleteCommentFromPost: (postId: string, commentId: string) => void;
}

export function useCollaborativeWall(patientId: string): UseCollaborativeWallResult {
  const [posts, setPosts] = useState<PostResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError('');
    getWall(patientId)
      .then(data => { if (!ignore) setPosts(data); })
      .catch(() => { if (!ignore) setError('Impossible de charger le mur collaboratif.'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [patientId]);

  // Guards against duplicates: the author's own REST response and the SignalR broadcast for the
  // same post can both call this for the same id.
  function addPost(post: PostResponse) {
    setPosts(prev => prev.some(p => p.id === post.id) ? prev : [post, ...prev]);
  }

  function updatePostState(updated: PostResponse) {
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
  }

  function deletePostState(postId: string) {
    setPosts(prev => prev.filter(p => p.id !== postId));
  }

  function addCommentToPost(comment: CommentResponse) {
    setPosts(prev => prev.map(p => {
      if (p.id !== comment.postId) return p;
      if (p.comments.some(c => c.id === comment.id)) return p;
      return { ...p, comments: [...p.comments, comment] };
    }));
  }

  function updateCommentInPost(comment: CommentResponse) {
    setPosts(prev => prev.map(p => {
      if (p.id !== comment.postId) return p;
      return { ...p, comments: p.comments.map(c => c.id === comment.id ? comment : c) };
    }));
  }

  function deleteCommentFromPost(postId: string, commentId: string) {
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return { ...p, comments: p.comments.filter(c => c.id !== commentId) };
    }));
  }

  return {
    posts, loading, error,
    addPost, updatePostState, deletePostState,
    addCommentToPost, updateCommentInPost, deleteCommentFromPost,
  };
}
