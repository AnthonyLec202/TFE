import { apiClient } from './apiClient';
import type { CurrentUser, ConsumeTokenRequest, LoginRequest } from '../types/auth';

// All three set/clear the HttpOnly session cookie server-side; the body carries only the identity.
export const login = (data: LoginRequest): Promise<CurrentUser> =>
  apiClient.post<CurrentUser>('/api/auth/login', data);

export const consumeToken = (data: ConsumeTokenRequest): Promise<CurrentUser> =>
  apiClient.post<CurrentUser>('/api/enrollment/consume', data);

// Restores the session on page load by reading the cookie server-side. Throws AuthError (401) when
// no valid session cookie is present.
export const getCurrentUser = (): Promise<CurrentUser> =>
  apiClient.get<CurrentUser>('/api/auth/me');

export const logout = (): Promise<void> =>
  apiClient.postVoid('/api/auth/logout', {});

export const forgotPassword = (email: string): Promise<{ message: string }> =>
  apiClient.post<{ message: string }>('/api/auth/forgot-password', { email });

export const resetPassword = (
  email: string,
  token: string,
  newPassword: string
): Promise<{ message: string }> =>
  apiClient.post<{ message: string }>('/api/auth/reset-password', { email, token, newPassword });

export const changePassword = (
  currentPassword: string,
  newPassword: string
): Promise<{ message: string }> =>
  apiClient.post<{ message: string }>('/api/auth/change-password', { currentPassword, newPassword });

// Records the authenticated user's acceptance of the given policy version (204 NoContent).
export const updateConsent = (version: string): Promise<void> =>
  apiClient.postVoid('/api/auth/me/consent', { version });
