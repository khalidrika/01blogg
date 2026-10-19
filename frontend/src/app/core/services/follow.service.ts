import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { API_URL } from '../auth/auth.service';

export interface FollowStatus { following: boolean; followersCount: number; }

@Injectable({ providedIn: 'root' })
export class FollowService {
  private http = inject(HttpClient);

  getFollowing(userId: number) {
    return this.http.get<{ id: number }[]>(`${API_URL}/users/${userId}/following`);
  }

  getStatus(userId: number) {
    return this.http.get<FollowStatus>(`${API_URL}/users/${userId}/follow`);
  }

  setFollowing(userId: number, following: boolean) {
    const url = `${API_URL}/users/${userId}/follow`;
    return following ? this.http.put<FollowStatus>(url, {}) : this.http.delete<FollowStatus>(url);
  }
}

export function followErrorMessage(error: HttpErrorResponse): string {
  if (error.status === 404) return 'This user is no longer available.';
  if (error.status === 400 && typeof error.error?.message === 'string') return error.error.message;
  if (error.status === 403) return 'You do not have permission to follow this user.';
  return 'Could not update follow status. Please try again.';
}
