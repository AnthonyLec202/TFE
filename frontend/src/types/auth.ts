export interface LoginRequest {
  email: string;
  password: string;
}

// The authenticated user's identity, returned by login, enrollment, and GET /api/auth/me.
// No token field: the JWT lives only in the HttpOnly session cookie and is never readable by JS.
export interface CurrentUser {
  userId: string;
  email: string;
  roles: string[];
}

export interface ConsumeTokenRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  secretCode: string;
  consent: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export type AuthUser = CurrentUser;

export interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  // True once the session has been restored from the server (GET /api/auth/me) AND, when a session
  // exists, the at-rest encryption key has been derived. Consumers must wait for this before firing
  // authenticated requests or reading encrypted notes, so neither races ahead of the key.
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  enroll: (data: ConsumeTokenRequest) => Promise<void>;
  logout: () => Promise<void>;
}
