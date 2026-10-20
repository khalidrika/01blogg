import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../auth/auth.service';
import { ProfilePost } from './profile.service';

@Injectable({ providedIn: 'root' })
export class PostService {
  private http = inject(HttpClient);

  createPost(title: string, content: string, media: File | null) {
    const body = new FormData();
    body.append('title', title); body.append('content', content);
    if (media) body.append('media', media);
    return this.http.post<ProfilePost>(`${API_URL}/posts`, body);
  }

  deletePost(id: number) {
    return this.http.delete<void>(`${API_URL}/posts/${id}`);
  }

  getPost(id: number) {
    return this.http.get<ProfilePost>(`${API_URL}/posts/${id}`);
  }

  updatePost(id: number, title: string, content: string, media: File | null) {
    const body = new FormData();
    body.append('title', title);
    body.append('content', content);
    if (media) body.append('media', media);
    return this.http.put<ProfilePost>(`${API_URL}/posts/${id}`, body);
  }
}
