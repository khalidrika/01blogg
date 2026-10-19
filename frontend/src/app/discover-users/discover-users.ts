import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Navbar } from '../shared/navbar/navbar';
import { ProfileService, UserProfile } from '../core/services/profile.service';
import { FollowService, followErrorMessage } from '../core/services/follow.service';

@Component({
  selector: 'app-discover-users',
  imports: [RouterLink, Navbar],
  templateUrl: './discover-users.html',
  styleUrl: './discover-users.css'
})
export class DiscoverUsers implements OnInit {
  users = signal<UserProfile[]>([]);
  followingIds = signal<number[]>([]);
  togglingIds = signal<number[]>([]);
  loading = signal(false);
  error = signal('');
  followError = signal('');
  status = signal('');
  followStatusLoaded = signal(false);
  followStatusLoading = signal(false);
  readonly currentUserId = Number(localStorage.getItem('userId'));
  private profiles = inject(ProfileService);
  private follows = inject(FollowService);
  private destroyRef = inject(DestroyRef);

  ngOnInit(): void { this.loadUsers(); }

  loadUsers(): void {
    if (this.loading() || this.togglingIds().length) return;
    if (!Number.isSafeInteger(this.currentUserId) || this.currentUserId <= 0) {
      this.error.set('Please log in again.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.status.set('');
    this.followStatusLoaded.set(false);
    this.profiles.getProfiles().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: users => {
        this.users.set(users.filter(user => user.id !== this.currentUserId));
        this.loading.set(false);
        this.loadFollowing();
      },
      error: () => {
        this.error.set('Could not load users. Please try again.');
        this.loading.set(false);
      }
    });
  }

  loadFollowing(): void {
    if (this.followStatusLoading() || this.togglingIds().length) return;
    this.followStatusLoading.set(true);
    this.followStatusLoaded.set(false);
    this.followError.set('');
    this.follows.getFollowing(this.currentUserId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: following => {
        this.followingIds.set(following.map(user => user.id));
        this.followStatusLoaded.set(true);
        this.followStatusLoading.set(false);
      },
      error: () => {
        this.followStatusLoading.set(false);
        this.followError.set('Could not load follow status. Please retry.');
      }
    });
  }

  isFollowing(userId: number): boolean { return this.followingIds().includes(userId); }

  toggleFollow(userId: number): void {
    const user = this.users().find(user => user.id === userId);
    if (!user || userId === this.currentUserId || !this.followStatusLoaded() || this.togglingIds().includes(userId)) return;
    this.followError.set('');
    this.status.set('');
    this.togglingIds.update(ids => [...ids, userId]);
    this.follows.setFollowing(userId, !this.isFollowing(userId)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.followingIds.update(ids => result.following ? [...new Set([...ids, userId])] : ids.filter(id => id !== userId));
        this.users.update(users => users.map(item => item.id === userId ? { ...item, followersCount: result.followersCount } : item));
        this.status.set(result.following ? `You are now following ${user.username}.` : `You unfollowed ${user.username}.`);
        this.togglingIds.update(ids => ids.filter(id => id !== userId));
      },
      error: error => {
        this.followError.set(followErrorMessage(error));
        this.togglingIds.update(ids => ids.filter(id => id !== userId));
      }
    });
  }
}
