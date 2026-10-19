import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { API_URL } from '../../core/auth/auth.service';
import { ProfilePost, ProfileService } from '../../core/services/profile.service';
import { DeletePost, PostRemoval } from '../../shared/delete-post/delete-post';
import { Navbar } from '../../shared/navbar/navbar';
import { PostInteractions } from '../../shared/post-interactions/post-interactions';

@Component({
  selector: 'app-my-posts',
  imports: [CommonModule, RouterLink, DeletePost, Navbar, PostInteractions],
  templateUrl: './my-posts.html',
  styleUrl: './my-posts.css'
})
export class MyPosts implements OnInit {
  posts = signal<ProfilePost[]>([]);
  loading = signal(false);
  error = signal('');
  status = signal('');
  readonly mediaOrigin = new URL(API_URL).origin;
  private profiles = inject(ProfileService);
  private destroyRef = inject(DestroyRef);
  private readonly removedPostIds = new Set<number>();

  ngOnInit(): void { this.loadMyPosts(); }

  get currentUserId(): number { return Number(localStorage.getItem('userId')); }

  loadMyPosts(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.profiles.getPosts(this.currentUserId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: posts => {
        this.posts.set(posts.filter(post => !this.removedPostIds.has(post.id))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load your posts. Please try again.');
        this.loading.set(false);
      }
    });
  }

  onPostRemoved(event: PostRemoval): void {
    this.removedPostIds.add(event.id);
    this.posts.update(posts => posts.filter(post => post.id !== event.id));
    this.status.set(event.message);
  }

  onPostUnavailable(id: number): void {
    this.onPostRemoved({ id, message: 'This post is no longer available and has been removed from the list.' });
  }
}
