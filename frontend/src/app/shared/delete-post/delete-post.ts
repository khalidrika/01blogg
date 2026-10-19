import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PostService } from '../../core/services/post.service';
import { ProfilePost } from '../../core/services/profile.service';

export interface PostRemoval { id: number; message: string; }

@Component({
  selector: 'app-delete-post',
  templateUrl: './delete-post.html',
  styleUrl: './delete-post.css'
})
export class DeletePost {
  post = input.required<ProfilePost>();
  removed = output<PostRemoval>();
  confirming = signal(false);
  deleting = signal(false);
  error = signal('');
  private posts = inject(PostService);
  private destroyRef = inject(DestroyRef);

  requestDelete(): void {
    if (!this.isOwner() || this.deleting()) return;
    this.error.set('');
    this.confirming.set(true);
  }

  cancel(): void {
    if (this.deleting()) return;
    this.confirming.set(false);
    this.error.set('');
  }

  confirmDelete(): void {
    if (!this.confirming() || this.deleting() || !this.isOwner()) return;
    const id = this.post().id;
    this.error.set('');
    this.deleting.set(true);
    this.posts.deletePost(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.removed.emit({ id, message: 'Post deleted successfully.' }),
      error: error => {
        this.deleting.set(false);
        if (error.status === 404) {
          this.removed.emit({ id, message: 'This post was already deleted.' });
        } else {
          this.error.set(error.status === 403 ? 'You do not have permission to delete this post.'
            : 'Could not delete the post. Please try again.');
        }
      }
    });
  }

  private isOwner(): boolean {
    return this.post().authorid === Number(localStorage.getItem('userId'));
  }
}
