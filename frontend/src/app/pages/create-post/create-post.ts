import { Component, DestroyRef, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Navbar } from '../../shared/navbar/navbar';
import { PostService } from '../../core/services/post.service';
import { mediaError } from '../../core/services/media-validation';

@Component({
  selector: 'app-create-post',
  imports: [FormsModule, RouterLink, Navbar],
  templateUrl: './create-post.html',
  styleUrl: '../edit-post/edit-post.css'
})
export class CreatePost implements OnDestroy {
  private readonly posts = inject(PostService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  title = '';
  content = '';
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  previewType: 'image' | 'video' | null = null;
  readonly saving = signal(false);
  readonly error = signal('');
  readonly fileError = signal('');

  onFileSelected(event: Event): void {
    if (this.saving()) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.clearFile();
    this.fileError.set(mediaError(file));
    if (this.fileError()) { input.value = ''; return; }
    this.selectedFile = file;
    this.previewType = file.type === 'video/mp4' ? 'video' : 'image';
    this.previewUrl = URL.createObjectURL(file);
  }

  clearFile(input?: HTMLInputElement): void {
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = null; this.previewType = null; this.selectedFile = null;
    this.fileError.set('');
    if (input) input.value = '';
  }

  createPost(): void {
    if (this.saving() || this.fileError()) return;
    if (!this.title.trim() || !this.content.trim()) {
      this.error.set('Title and content are required.'); return;
    }
    if (this.title.trim().length > 255 || this.content.trim().length > 10000) {
      this.error.set('Use at most 255 characters for the title and 10000 for the content.'); return;
    }
    this.saving.set(true); this.error.set('');
    this.posts.createPost(this.title.trim(), this.content.trim(), this.selectedFile)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: post => { void this.router.navigate(['/profile', post.authorid], { queryParams: { created: 'true' } }); },
        error: error => {
          this.saving.set(false);
          this.error.set(error.status === 413 ? 'The upload is too large. Please choose a smaller file.'
            : error.status === 400 && typeof error.error?.message === 'string' ? error.error.message
            : 'Could not publish your post. Your draft is still here; please try again.');
        }
      });
  }

  ngOnDestroy(): void { this.clearFile(); }
}
