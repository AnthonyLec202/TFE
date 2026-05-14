import { useAuth } from '../auth';
import type { PatientUserRole } from '../../types/patient';
import { useCollaborativeWall } from './hooks/useCollaborativeWall';
import { CreatePostContainer } from './CreatePostContainer';
import { PostCardContainer } from './PostCardContainer';

interface Props {
  patientId: string;
  userRole: PatientUserRole;
}

export function CollaborativeWallContainer({ patientId, userRole }: Props) {
  const { user } = useAuth();
  const currentUserId = user?.userId ?? '';

  const { posts, loading, error, addPost, updatePostState, deletePostState } =
    useCollaborativeWall(patientId);

  if (loading) return <div className="py-12 text-center text-sm text-slate-400">Chargement…</div>;
  if (error) return <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>;

  return (
    <div className="flex flex-col gap-5">
      <CreatePostContainer
        patientId={patientId}
        userRole={userRole}
        onCreated={addPost}
      />
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
            onUpdated={updatePostState}
            onDeleted={deletePostState}
          />
        ))
      )}
    </div>
  );
}
