import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, distinctUntilChanged, map } from 'rxjs';
import { API_URL } from '../../core/auth/auth.service';
import { ProfilePost, ProfileService, UserProfile } from '../../core/services/profile.service';
import { Navbar } from '../../shared/navbar/navbar';
import { FollowService, followErrorMessage } from '../../core/services/follow.service';
import { DeletePost, PostRemoval } from '../../shared/delete-post/delete-post';
import { PostInteractions } from '../../shared/post-interactions/post-interactions';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, RouterLink, Navbar, DeletePost, PostInteractions],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile implements OnInit, OnDestroy {
  profile = signal<UserProfile | null>(null);
  posts = signal<ProfilePost[]>([]);
  profileLoading = signal(false);
  postsLoading = signal(false);
  profileError = signal('');
  postsError = signal('');
  postStatus = signal('');
  reportReason = signal('');
  reportError = signal('');
  reportStatus = signal('');
  reportConfirmation = signal<string | null>(null);
  readonly reportReasonLimit = 255;
  actionStatus = signal('');
  followPending = signal(false);
  isFollowing = signal(false);
  followStatusLoaded = signal(false);
  followStatusLoading = signal(false);
  followError = signal('');
  reporting = signal(false);
  userId = 0;
  readonly mediaOrigin = new URL(API_URL).origin;
  private routeSubscription?: Subscription;
  private profileRequest?: Subscription;
  private postsRequest?: Subscription;
  private followRequest?: Subscription;
  private pageSubscriptions = new Subscription();
  private readonly removedPostIds = new Set<number>();

  constructor(private profiles: ProfileService, private route: ActivatedRoute, private follows: FollowService) {}

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.pipe(
      map(params => params.get('id')),
      distinctUntilChanged()
    ).subscribe(id => {
      // Cancel requests for the previous user before displaying the next profile.
      this.pageSubscriptions.unsubscribe();
      this.pageSubscriptions = new Subscription();
      this.profile.set(null);
      this.posts.set([]);
      this.profileError.set('');
      this.postsError.set('');
      this.postStatus.set('');
      this.reportReason.set('');
      this.reportError.set('');
      this.reportStatus.set('');
      this.reportConfirmation.set(null);
      this.actionStatus.set('');
      this.followPending.set(false);
      this.isFollowing.set(false);
      this.followStatusLoaded.set(false);
      this.followStatusLoading.set(false);
      this.followError.set('');
      this.reporting.set(false);
      this.profileLoading.set(false);
      this.postsLoading.set(false);
      this.userId = Number(id);
      if (!id || !/^\d+$/.test(id) || !Number.isSafeInteger(this.userId) || this.userId <= 0) {
        this.profileError.set('Invalid profile address.');
        return;
      }
      this.loadProfile();
      this.loadPosts();
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.pageSubscriptions.unsubscribe();
  }

  loadProfile(): void {
    this.profileRequest?.unsubscribe();
    this.profileLoading.set(true);
    this.profileError.set('');
    this.profileRequest = this.profiles.getProfile(this.userId).subscribe({
      next: profile => {
        this.profile.set(profile);
        this.profileLoading.set(false);
        if (this.userId !== this.currentUserId) this.loadFollowStatus();
      },
      error: error => {
        this.profileLoading.set(false);
        this.profileError.set(error.status === 404 ? 'User not found.' : 'Could not load this profile. Please try again.');
      }
    });
    this.pageSubscriptions.add(this.profileRequest);
  }

  loadPosts(): void {
    this.postsRequest?.unsubscribe();
    this.postsLoading.set(true);
    this.postsError.set('');
    this.postsRequest = this.profiles.getPosts(this.userId).subscribe({
      next: posts => {
        this.posts.set(posts.filter(post => !this.removedPostIds.has(post.id))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id));
        this.postsLoading.set(false);
      },
      error: () => {
        this.postsLoading.set(false);
        this.postsError.set('Could not load posts. Please try again.');
      }
    });
    this.pageSubscriptions.add(this.postsRequest);
  }

  onPostRemoved(event: PostRemoval): void {
    this.removedPostIds.add(event.id);
    this.posts.update(posts => posts.filter(post => post.id !== event.id));
    this.postStatus.set(event.message);
  }

  onPostUnavailable(id: number): void {
    this.onPostRemoved({ id, message: 'This post is no longer available and has been removed from the list.' });
  }

  loadFollowStatus(): void {
    if (this.userId === this.currentUserId || !this.profile() || this.followPending()) return;
    this.followRequest?.unsubscribe();
    this.followStatusLoaded.set(false);
    this.followStatusLoading.set(true);
    this.followError.set('');
    this.followRequest = this.follows.getStatus(this.userId).subscribe({
      next: result => {
        this.isFollowing.set(result.following);
        this.profile.update(profile => profile ? { ...profile, followersCount: result.followersCount } : null);
        this.followStatusLoaded.set(true);
        this.followStatusLoading.set(false);
      },
      error: () => {
        this.followStatusLoading.set(false);
        this.followError.set('Could not load follow status. Please retry.');
      }
    });
    this.pageSubscriptions.add(this.followRequest);
  }

  followUser(): void {
    if (this.followPending() || !this.followStatusLoaded() || this.userId === this.currentUserId) return;
    this.followPending.set(true);
    this.followError.set('');
    this.actionStatus.set('');
    this.pageSubscriptions.add(this.follows.setFollowing(this.userId, !this.isFollowing()).subscribe({
      next: result => {
        this.followPending.set(false);
        this.isFollowing.set(result.following);
        this.profile.update(profile => profile ? { ...profile, followersCount: result.followersCount } : null);
        this.actionStatus.set(result.following ? 'You are now following this user.' : 'You unfollowed this user.');
      },
      error: error => {
        this.followPending.set(false);
        this.followError.set(followErrorMessage(error));
      }
    }));
  }

  get postUpdated(): boolean {
    return this.userId === this.currentUserId && this.route.snapshot.queryParamMap.get('updated') === 'true';
  }

  get currentUserId(): number {
    return Number(localStorage.getItem('userId'));
  }

  reportUser(): void {
    if (this.reporting() || !this.profile() || this.userId === this.currentUserId) return;
    const reason = this.reportReason().trim();
    this.reportError.set('');
    this.reportStatus.set('');
    if (!reason || reason.length > this.reportReasonLimit) {
      this.reportError.set(!reason ? 'Please explain why you are reporting this user.' : 'Reason must be 255 characters or fewer.');
      return;
    }
    this.reportConfirmation.set(reason);
  }

  cancelReport(): void {
    if (this.reporting()) return;
    this.reportConfirmation.set(null);
    this.reportError.set('');
  }

  confirmReport(): void {
    const reason = this.reportConfirmation();
    if (!reason || this.reporting() || !this.profile() || this.userId === this.currentUserId) return;
    this.reporting.set(true);
    this.reportError.set('');
    this.pageSubscriptions.add(this.profiles.reportUser(this.userId, reason).subscribe({
      next: () => {
        this.reporting.set(false);
        this.reportReason.set('');
        this.reportConfirmation.set(null);
        this.reportStatus.set('Report sent. An administrator will review it.');
      },
      error: error => {
        this.reporting.set(false);
        this.reportError.set(error.status === 404 ? 'This user no longer exists.'
          : error.status === 403 ? 'You do not have permission to report this user.'
          : error.status === 400 ? 'Your report was not accepted. Please check the reason.'
          : 'Could not send your report. Please try again.');
      }
    }));
  }
}
