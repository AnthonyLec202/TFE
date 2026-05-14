import { apiClient } from './apiClient';

export const consumeInvitation = (secretCode: string): Promise<void> =>
  apiClient.post<void>('/api/invitations/consume', { secretCode });
