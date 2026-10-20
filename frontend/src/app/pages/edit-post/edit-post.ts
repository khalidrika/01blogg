import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, distinctUntilChanged, map } from 'rxjs';
import { API_URL } from '../../core/auth/auth.service';
import { ProfilePost } from '../../core/services/profile.service';
import { PostService } from '../../core/services/post.service';
import { Navbar } from '../../shared/navbar/navbar';
import { mediaError } from '../../core/services/media-validation';

@Component({
  selector: 'app-edit-post',
  imports: [FormsModule, RouterLink, Navbar],
  templateUrl: './edit-post.html',
  styleUrl: './edit-post.css'
})
export class EditPost implements OnInit, OnDestroy {
  post = signal<ProfilePost | null>(null);
  loading = signal(false);
  saving = signal(false);
  loadError = signal('');
  saveError = signal('');
  fileError = signal('');
  retryable = signal(false);
  title = '';
  content = '';
  selectedFile: File | null = null;
  private objectUrl: string | null = null;
  private replacementType: 'image' | 'video' | null = null;
  private postId = 0;
  private routeSubscription?: Subscription;
  private loadRequest?: Subscription;
  private saveRequest?: Subscription;

  constructor(private posts: PostService, private route: ActivatedRoute, private router: Router) {}

  get currentUserId(): number { return Number(localStorage.getItem('userId')); }
  get previewUrl(): string | null {
    const media = this.post()?.mediaUrl;
    return this.objectUrl ?? (media ? new URL(API_URL).origin + media : null);
  }
  get previewType(): 'image' | 'video' | null {
    return this.objectUrl ? this.replacementType : this.post()?.mediaType ?? null;
  }

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.pipe(
      map(params => params.get('id')), distinctUntilChanged()
    ).subscribe(id => {
      this.loadRequest?.unsubscribe();
      this.saveRequest?.unsubscribe();
      this.clearReplacement();
      this.post.set(null);
      this.title = this.content = '';
      this.loadError.set('');
      this.saveError.set('');
      this.loading.set(false);
      this.saving.set(false);
      this.retryable.set(false);
      this.postId = Number(id);
      if (!id || !/^\d+$/.test(id) || !Number.isSafeInteger(this.postId) || this.postId <= 0) {
        this.loadError.set('Invalid post address.');
        return;
      }
      this.loadPost();
    });
  }

  loadPost(): void {
    this.loadRequest?.unsubscribe();
    this.loading.set(true);
    this.loadError.set('');
    this.retryable.set(false);
    this.loadRequest = this.posts.getPost(this.postId).subscribe({
      next: post => {
        this.loading.set(false);
        if (post.authorid !== this.currentUserId) {
          this.loadError.set('You can only edit your own posts.');
          return;
        }
        this.post.set(post);
        this.title = post.title;
        this.content = post.content;
      },
      error: error => {
        this.loading.set(false);
        this.retryable.set(![401, 403, 404].includes(error.status));
        this.loadError.set(error.status === 404 ? 'Post not found.'
          : error.status === 403 ? 'You do not have permission to edit this post.'
          : 'Could not load the post. Please try again.');
      }
    });
  }

  onFileSelected(event: Event): void {
    if (this.saving()) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.clearReplacement();
    this.fileError.set(mediaError(file));
    if (!this.fileError()) {
      this.selectedFile = file;
      this.replacementType = file.type === 'video/mp4' ? 'video' : 'image';
      this.objectUrl = URL.createObjectURL(file);
    }
    if (this.fileError()) input.value = '';
  }

  clearReplacement(input?: HTMLInputElement): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.replacementType = null;
    this.selectedFile = null;
    this.fileError.set('');
    if (input) input.value = '';
  }

  save(): void {
    const post = this.post();
    if (!post || post.authorid !== this.currentUserId || this.saving() || this.fileError()) return;
    if (!this.title.trim() || !this.content.trim()) {
      this.saveError.set('Title and content are required.');
      return;
    }
    if (this.title.trim().length > 255 || this.content.trim().length > 10000) {
      this.saveError.set('Use at most 255 characters for the title and 10000 for the content.'); return;
    }
    this.saveError.set('');
    this.saving.set(true);
    this.saveRequest = this.posts.updatePost(post.id, this.title.trim(), this.content.trim(), this.selectedFile).subscribe({
      next: () => {
        void this.router.navigate(['/profile', post.authorid], { queryParams: { updated: 'true' } });
      },
      error: error => {
        this.saving.set(false);
        this.saveError.set(error.status === 403 ? 'You do not have permission to edit this post.'
          : error.status === 404 ? 'This post no longer exists.'
          : error.status === 413 ? 'The upload is too large. Please choose a smaller file.'
          : error.status === 400 && typeof error.error?.message === 'string' ? error.error.message
          : 'Could not save changes. Your edits are still here; please try again.');
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.loadRequest?.unsubscribe();
    this.saveRequest?.unsubscribe();
    this.clearReplacement();
  }
}
