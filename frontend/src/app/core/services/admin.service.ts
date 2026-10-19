import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../auth/auth.service';
import { ProfilePost } from './profile.service';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
  banned: boolean;
}

export interface UserReport {
  id: number;
  reporterId: number;
  reporterUsername: string;
  reportedUserId: number;
  reportedUsername: string;
  reason: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/admin`;

  getUsers() { return this.http.get<AdminUser[]>(`${this.url}/users`); }
  getPosts() { return this.http.get<ProfilePost[]>(`${this.url}/posts`); }
  getReports() { return this.http.get<UserReport[]>(`${this.url}/reports`); }
  setBanned(id: number, banned: boolean) {
    return this.http.put<void>(`${this.url}/users/${id}/${banned ? 'ban' : 'unban'}`, {});
  }
  deleteUser(id: number) { return this.http.delete<void>(`${this.url}/users/${id}`); }
  deletePost(id: number) { return this.http.delete<void>(`${this.url}/posts/${id}`); }
}
