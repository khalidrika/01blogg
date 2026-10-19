import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../auth/auth.service';

export interface LikeStatus { liked: boolean; count: number; }
export interface PostComment {
  id: number; content: string; authorId: number; authorUsername: string; postId: number; createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class InteractionService {
  private readonly http = inject(HttpClient);
  getLikes(id: number) { return this.http.get<LikeStatus>(`${API_URL}/posts/${id}/likes`); }
  setLiked(id: number, liked: boolean) {
    return liked ? this.http.put<LikeStatus>(`${API_URL}/posts/${id}/likes`, {})
      : this.http.delete<LikeStatus>(`${API_URL}/posts/${id}/likes`);
  }
  getComments(id: number) { return this.http.get<PostComment[]>(`${API_URL}/posts/${id}/comments`); }
  addComment(id: number, content: string) { return this.http.post<PostComment>(`${API_URL}/posts/${id}/comments`, { content }); }
  deleteComment(id: number) { return this.http.delete<void>(`${API_URL}/posts/comments/${id}`); }
}
