import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../auth/auth.service';

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  role: string;
  followersCount: number;
  followingCount: number;
}

export interface ProfilePost {
  id: number;
  title: string;
  content: string;
  authorid: number;
  authorusername: string;
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private http = inject(HttpClient);

  getProfiles() {
    return this.http.get<UserProfile[]>(`${API_URL}/users`);
  }

  getProfile(userId: number) {
    return this.http.get<UserProfile>(`${API_URL}/users/${userId}`);
  }

  getPosts(userId: number) {
    return this.http.get<ProfilePost[]>(`${API_URL}/users/${userId}/posts`);
  }

  reportUser(userId: number, reason: string) {
    return this.http.post<void>(`${API_URL}/users/${userId}/report`, { reason });
  }
}
