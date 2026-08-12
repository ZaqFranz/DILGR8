export interface AuthUser {
  id: string;
  email: string;
  role: "APPLICANT" | "ADMIN" | "PANEL";
  mustChangePassword: boolean;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface Credentials {
  email: string;
  password: string;
}
