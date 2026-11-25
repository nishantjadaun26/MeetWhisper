export interface User {
  id: string;
  email: string;
  full_name: string;
  auth_provider?: string;
  avatar_url?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AuthProvidersConfig {
  google_enabled: boolean;
  google_client_id: string | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  full_name: string;
  password: string;
}
