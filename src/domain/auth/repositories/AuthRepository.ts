import type { LoginInput, ProfileUpdate, RegisterInput, User } from '@shared/types/user';

/** Contrat d'authentification (implémenté côté infrastructure). */
export interface AuthRepository {
  /** Utilisateur courant, ou null si non connecté. */
  me(): Promise<User | null>;
  register(input: RegisterInput): Promise<User>;
  login(input: LoginInput): Promise<User>;
  logout(): Promise<void>;
  updateProfile(patch: ProfileUpdate): Promise<User>;
}
