import type { AuthRepository } from '@/domain/auth/repositories/AuthRepository';
import { httpClient, HttpError } from '@/infrastructure/http/httpClient';
import type { LoginInput, ProfileUpdate, RegisterInput, User } from '@shared/types/user';

export class HttpAuthRepository implements AuthRepository {
  async me(): Promise<User | null> {
    try {
      return await httpClient.get<User>('/auth/me');
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) return null;
      throw err;
    }
  }

  register(input: RegisterInput): Promise<User> {
    return httpClient.post<User>('/auth/register', input);
  }

  login(input: LoginInput): Promise<User> {
    return httpClient.post<User>('/auth/login', input);
  }

  logout(): Promise<void> {
    return httpClient.post<void>('/auth/logout');
  }

  updateProfile(patch: ProfileUpdate): Promise<User> {
    return httpClient.patch<User>('/auth/me', patch);
  }
}

export const authRepository: AuthRepository = new HttpAuthRepository();
