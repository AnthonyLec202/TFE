export interface AttachmentResponse {
  id: string;
  filename: string;
  filetype: string;
  fileUrl: string;
  postId: string | null;
  commentId: string | null;
  createdAt: string;
  createdById: string;
}

export interface CommentResponse {
  id: string;
  postId: string;
  content: string;
  createdById: string | null;
  authorFirstName: string;
  authorLastName: string;
  authorRole: string;   // Human-readable French label (e.g. "Psychologue", "Parent")
  createdAt: string;
  updatedAt?: string;
  attachments: AttachmentResponse[];
}

export interface PostResponse {
  id: string;
  patientId: string;
  content: string;
  excludedRoles: string[];
  createdById: string | null;
  authorFirstName: string;
  authorLastName: string;
  authorRole: string;   // Human-readable French label
  createdAt: string;
  updatedAt?: string;
  comments: CommentResponse[];
  attachments: AttachmentResponse[];
}

export interface CreatePostPayload {
  content: string;
  excludedRoles: string[];
}

export interface UpdatePostPayload {
  content: string;
  excludedRoles: string[];
}

export interface CreateCommentPayload {
  content: string;
}

export interface UpdateCommentPayload {
  content: string;
}
