import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Navbar } from '../../shared/navbar/navbar';
import { PostInteractions } from '../../shared/post-interactions/post-interactions';
import { API_URL } from '../../core/auth/auth.service';
import { ProfilePost } from '../../core/services/profile.service';

@Component({
  selector: 'app-feed',
  imports: [CommonModule, Navbar, RouterLink, PostInteractions],
  templateUrl: './feed.html',
  styleUrl: './feed.css'
})
export class Feed implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private request?: Subscription;
  readonly posts = signal<ProfilePost[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly status = signal('');
  readonly mediaOrigin = new URL(API_URL).origin;
  private readonly unavailableIds = new Set<number>();

  ngOnInit(): void { this.loadFeed(); }
  ngOnDestroy(): void { this.request?.unsubscribe(); }

  loadFeed(): void {
    this.request?.unsubscribe();
    this.loading.set(true); this.error.set('');
    this.request = this.http.get<ProfilePost[]>(`${API_URL}/posts/feed`).subscribe({
      next: posts => {
        // A feed snapshot started before a post deletion must not restore it.
        this.posts.set(posts.filter(post => !this.unavailableIds.has(post.id)));
        this.loading.set(false); this.loaded.set(true);
      },
      error: () => { this.loading.set(false); this.error.set('Could not load your feed. Please try again.'); }
    });
  }

  removeUnavailablePost(id: number): void {
    this.unavailableIds.add(id);
    this.posts.update(posts => posts.filter(post => post.id !== id));
    this.status.set('A post is no longer available and has been removed from your feed.');
  }
}
