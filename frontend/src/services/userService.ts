import { apiClient } from './apiClient';

// Permanently deletes the account (GDPR Right to Erasure): anonymises the user's posts and
// comments, removes their attachments, and revokes their care-team access.
export const deleteAccount = (userId: string): Promise<void> =>
  apiClient.delete<void>(`/api/users/${userId}`);
