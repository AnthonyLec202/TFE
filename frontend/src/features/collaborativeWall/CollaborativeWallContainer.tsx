import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Archive } from 'lucide-react';
import { useAuth } from '../auth';
import type { PatientUserRole } from '../../types/patient';
import { useCollaborativeWall } from './hooks/useCollaborativeWall';
import { useCollaborativeWallSocket } from './hooks/useCollaborativeWallSocket';
import { CreatePostContainer } from './CreatePostContainer';
import { PostCardContainer } from './PostCardContainer';

interface Props {
  patientId: string;
  userRole: PatientUserRole;
  // When the parent patient is archived, the wall becomes strictly read-only: the composer is
  // unmounted, edit/delete and comment inputs are suppressed, and a banner explains why.
  isArchived?: boolean;
}

export function CollaborativeWallContainer({ patientId, userRole, isArchived = false }: Props) {
  const { user } = useAuth();
  const currentUserId = user?.userId ?? '';

  const [searchParams] = useSearchParams();
  const targetPostId = searchParams.get('postId');
  const targetCommentId = searchParams.get('commentId');
  // Tracks the composite key of the last scroll target so re-renders from unrelated state
  // changes (e.g. SignalR updates) don't re-trigger the animation, while a genuinely new
  // notification target (different postId or commentId) does.
  const lastScrolledTargetRef = useRef<string | null>(null);
  // Holds a reference to the currently highlighted element so the class can be removed
  // immediately if the user clicks a different notification before the 2.5 s timer fires.
  const highlightedElementRef = useRef<HTMLElement | null>(null);

  const {
    posts, loading, error,
    addPost, updatePostState, deletePostState,
    addCommentToPost, updateCommentInPost, deleteCommentFromPost,
  } = useCollaborativeWall(patientId);

  useCollaborativeWallSocket(patientId, {
    onPostReceived:    addPost,
    onPostUpdated:     updatePostState,
    onPostDeleted:     deletePostState,
    onCommentReceived: addCommentToPost,
    onCommentUpdated:  updateCommentInPost,
    onCommentDeleted:  deleteCommentFromPost,
  });

  useEffect(() => {
    if (loading || !targetPostId) return;

    // A composite key distinguishes "same notification re-rendered" from "new notification clicked".
    const targetKey = `${targetPostId}:${targetCommentId ?? ''}`;
    if (lastScrolledTargetRef.current === targetKey) return;

    const element =
      (targetCommentId ? document.getElementById(`comment-${targetCommentId}`) : null)
      ?? document.getElementById(`post-${targetPostId}`);

    if (!element) return;

    // Strip the animation class from the previously highlighted element before starting a new one.
    if (highlightedElementRef.current) {
      highlightedElementRef.current.classList.remove('highlight-flash');
    }

    lastScrolledTargetRef.current = targetKey;
    highlightedElementRef.current = element;

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add('highlight-flash');
    const timer = setTimeout(() => {
      element.classList.remove('highlight-flash');
      highlightedElementRef.current = null;
    }, 2500);

    // clearTimeout fires on cleanup (dep change or unmount), preventing a stale timer from
    // removing the class of a newly highlighted element.
    return () => clearTimeout(timer);
  }, [loading, posts, targetPostId, targetCommentId]);

  if (loading) return <div className="py-12 text-center text-sm text-slate-400">Chargement…</div>;
  if (error) return <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>;

  return (
    <div className="flex flex-col gap-5">
      {isArchived ? (
        <div className="flex items-center gap-2 rounded-lg border border-[#E4D2A6] bg-[#F7EFDC] px-4 py-3 text-[#9A6A18]">
          <Archive className="h-4 w-4 shrink-0" strokeWidth={1.85} />
          <p className="text-sm font-medium">Dossier archivé — Mode lecture seule</p>
        </div>
      ) : (
        <CreatePostContainer
          patientId={patientId}
          userRole={userRole}
          onCreated={addPost}
        />
      )}
      {posts.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-slate-400">Aucune publication pour le moment.</p>
        </div>
      ) : (
        posts.map(post => (
          <PostCardContainer
            key={post.id}
            post={post}
            patientId={patientId}
            currentUserId={currentUserId}
            userRole={userRole}
            readOnly={isArchived}
            onUpdated={updatePostState}
            onDeleted={deletePostState}
            onCommentAdded={addCommentToPost}
          />
        ))
      )}
    </div>
  );
}
