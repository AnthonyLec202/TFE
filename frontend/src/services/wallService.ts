import { apiClient } from './apiClient';
import type {
  CommentResponse,
  CreateCommentPayload,
  CreatePostPayload,
  PostResponse,
  UpdateCommentPayload,
  UpdatePostPayload,
} from '../types/wall';

const base = (patientId: string) => `/api/patients/${patientId}/wall`;

export const getWall = (patientId: string): Promise<PostResponse[]> =>
  apiClient.get<PostResponse[]>(base(patientId));

export const createPost = (patientId: string, data: CreatePostPayload): Promise<PostResponse> =>
  apiClient.post<PostResponse>(`${base(patientId)}/posts`, data);

export const createPostWithAttachments = (
  patientId: string,
  content: string,
  excludedRoles: string[],
  files: File[],
): Promise<PostResponse> => {
  const form = new FormData();
  form.append('Content', content);
  excludedRoles.forEach(role => form.append('ExcludedRoles', role));
  files.forEach(file => form.append('Attachments', file));
  return apiClient.postForm<PostResponse>(`${base(patientId)}/posts/multipart`, form);
};

export const updatePost = (patientId: string, postId: string, data: UpdatePostPayload): Promise<PostResponse> =>
  apiClient.put<PostResponse>(`${base(patientId)}/posts/${postId}`, data);

export const deletePost = (patientId: string, postId: string): Promise<void> =>
  apiClient.delete<void>(`${base(patientId)}/posts/${postId}`);

export const createComment = (patientId: string, postId: string, data: CreateCommentPayload): Promise<CommentResponse> =>
  apiClient.post<CommentResponse>(`${base(patientId)}/posts/${postId}/comments`, data);

export const updateComment = (
  patientId: string, postId: string, commentId: string, data: UpdateCommentPayload
): Promise<CommentResponse> =>
  apiClient.put<CommentResponse>(`${base(patientId)}/posts/${postId}/comments/${commentId}`, data);

export const deleteComment = (patientId: string, postId: string, commentId: string): Promise<void> =>
  apiClient.delete<void>(`${base(patientId)}/posts/${postId}/comments/${commentId}`);
