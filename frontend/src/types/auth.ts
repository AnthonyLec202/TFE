export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  userId: string;
  email: string;
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

export interface AuthUser {
  userId: string;
  email: string;
  roles: string[];
}

export interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  enroll: (data: ConsumeTokenRequest) => Promise<void>;
  logout: () => void;
}
