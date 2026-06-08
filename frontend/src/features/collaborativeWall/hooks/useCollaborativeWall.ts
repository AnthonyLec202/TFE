import { useEffect, useState } from 'react';
import { getWall } from '../../../services/wallService';
import type { PostResponse } from '../../../types/wall';

export interface UseCollaborativeWallResult {
  posts: PostResponse[];
  loading: boolean;
  error: string;
  addPost: (post: PostResponse) => void;
  updatePostState: (updated: PostResponse) => void;
  deletePostState: (postId: string) => void;
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

  function addPost(post: PostResponse) {
    setPosts(prev => [post, ...prev]);
  }

  function updatePostState(updated: PostResponse) {
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
  }

  function deletePostState(postId: string) {
    setPosts(prev => prev.filter(p => p.id !== postId));
  }

  return { posts, loading, error, addPost, updatePostState, deletePostState };
}
