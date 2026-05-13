import { apiClient } from './apiClient';
import type { AuthResponse, ConsumeTokenRequest, LoginRequest } from '../types/auth';

export const login = (data: LoginRequest): Promise<AuthResponse> =>
  apiClient.post<AuthResponse>('/api/auth/login', data);

export const consumeToken = (data: ConsumeTokenRequest): Promise<AuthResponse> =>
  apiClient.post<AuthResponse>('/api/enrollment/consume', data);

export const forgotPassword = (email: string): Promise<{ message: string }> =>
  apiClient.post<{ message: string }>('/api/auth/forgot-password', { email });

export const resetPassword = (
  email: string,
  token: string,
  newPassword: string
): Promise<{ message: string }> =>
  apiClient.post<{ message: string }>('/api/auth/reset-password', { email, token, newPassword });
