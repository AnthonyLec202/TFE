import { useState } from 'react';
import { createPost, createPostWithAttachments } from '../../services/wallService';
import type { PostResponse } from '../../types/wall';
import type { PatientUserRole } from '../../types/patient';
import { CreatePostForm } from './components/CreatePostForm';

interface Props {
  patientId: string;
  userRole: PatientUserRole;
  onCreated: (post: PostResponse) => void;
}

export function CreatePostContainer({ patientId, userRole, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(content: string, excludedRoles: string[], files: File[]) {
    setError('');
    setLoading(true);
    try {
      const post = files.length > 0
        ? await createPostWithAttachments(patientId, content, excludedRoles, files)
        : await createPost(patientId, { content, excludedRoles });
      onCreated(post);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
      throw err; // rethrow so the form stays populated on failure
    } finally {
      setLoading(false);
    }
  }

  return (
    <CreatePostForm
      userRole={userRole}
      onSubmit={handleSubmit}
      loading={loading}
      error={error}
    />
  );
}
