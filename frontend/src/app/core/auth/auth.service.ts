import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { tap } from 'rxjs';

export const API_URL = 'http://localhost:8080/api';
interface LoginResponse {
  token: string;
  id: number;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  get token(): string | null { return localStorage.getItem('token'); }
  get role(): string | null { return localStorage.getItem('role'); }

  isAuthenticated(): boolean {
    try {
      const parts = this.token?.split('.');
      if (parts?.length !== 3) return false;
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
      // UI expiry check only: the backend verifies signatures and permissions.
      return typeof claims.exp === 'number' && claims.exp * 1000 > Date.now()
        && Number(localStorage.getItem('userId')) > 0;
    } catch { return false; }
  }

  login(email: string, password: string) {
    return this.http.post<LoginResponse>(`${API_URL}/login`, { email, password }).pipe(
      tap(response => {
        localStorage.setItem('token', response.token);
        localStorage.setItem('userId', String(response.id));
        localStorage.setItem('role', response.role);
      })
    );
  }

  register(username: string, email: string, password: string) {
    return this.http.post(`${API_URL}/register`, { username, email, password });
  }

  logout(): void {
    for (const key of ['token', 'userId', 'role']) localStorage.removeItem(key);
  }
}

export function authErrorMessage(error: HttpErrorResponse): string {
  if (error.status === 0) return 'Cannot reach the server. Please try again.';
  if (error.status >= 500) return 'Something went wrong. Please try again later.';
  if (typeof error.error?.message === 'string') return error.error.message;
  if (error.error && typeof error.error === 'object') {
    const messages = Object.values(error.error).filter(value => typeof value === 'string');
    if (messages.length) return messages.join(' ');
  }
  return 'Your request could not be completed. Please try again.';
}
