import { Component, inject, Input, OnChanges, OnDestroy, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { InteractionService, LikeStatus, PostComment } from '../../core/services/interaction.service';

@Component({
  selector: 'app-post-interactions',
  imports: [CommonModule, RouterLink],
  templateUrl: './post-interactions.html',
  styleUrl: './post-interactions.css'
})
export class PostInteractions implements OnChanges, OnDestroy {
  @Input({ required: true }) postId!: number;
  readonly unavailable = output<number>();
  private readonly api = inject(InteractionService);
  private requests = new Subscription();
  private likesRequest?: Subscription;
  private commentsRequest?: Subscription;
  readonly likes = signal<LikeStatus | null>(null);
  readonly likeLoading = signal(false);
  readonly likePending = signal(false);
  readonly likeError = signal('');
  readonly comments = signal<PostComment[]>([]);
  readonly commentsLoaded = signal(false);
  readonly commentsLoading = signal(false);
  readonly commentsError = signal('');
  readonly draft = signal('');
  readonly writing = signal(false);
  readonly deleteConfirmation = signal<number | null>(null);
  readonly actionError = signal('');
  readonly feedback = signal('');
  readonly commentLimit = 255;
  get currentUserId(): number { return Number(localStorage.getItem('userId')); }

  ngOnChanges(): void {
    this.requests.unsubscribe();
    this.requests = new Subscription();
    this.likes.set(null); this.likeLoading.set(false); this.likePending.set(false); this.likeError.set('');
    this.comments.set([]); this.commentsLoaded.set(false); this.commentsLoading.set(false); this.commentsError.set('');
    this.draft.set(''); this.writing.set(false); this.deleteConfirmation.set(null); this.actionError.set(''); this.feedback.set('');
    this.loadLikes(); this.loadComments();
  }

  ngOnDestroy(): void { this.requests.unsubscribe(); }

  loadLikes(): void {
    if (this.likePending()) return;
    this.likesRequest?.unsubscribe();
    this.likeLoading.set(true); this.likeError.set('');
    this.likesRequest = this.api.getLikes(this.postId).subscribe({
      next: status => { this.likes.set(status); this.likeLoading.set(false); },
      error: error => {
        this.likeLoading.set(false);
        if (error.status === 404) this.unavailable.emit(this.postId);
        else this.likeError.set('Could not load likes. Please retry.');
      }
    });
    this.requests.add(this.likesRequest);
  }

  toggleLike(): void {
    const status = this.likes();
    if (!status || this.likePending()) return;
    this.likesRequest?.unsubscribe();
    this.likeLoading.set(false); this.likePending.set(true); this.likeError.set(''); this.feedback.set('');
    this.requests.add(this.api.setLiked(this.postId, !status.liked).subscribe({
      next: result => {
        this.likes.set(result); this.likePending.set(false);
        this.feedback.set(result.liked ? 'Post liked.' : 'Like removed.');
      },
      error: error => {
        this.likePending.set(false);
        if (error.status === 404) this.unavailable.emit(this.postId);
        else this.likeError.set(error.status === 403 ? 'You cannot change likes on this post.' : 'Could not update your like. Please try again.');
      }
    }));
  }

  loadComments(): void {
    if (this.writing()) return;
    this.commentsRequest?.unsubscribe();
    this.commentsLoading.set(true); this.commentsError.set('');
    this.commentsRequest = this.api.getComments(this.postId).subscribe({
      next: comments => { this.comments.set(comments); this.commentsLoaded.set(true); this.commentsLoading.set(false); },
      error: error => {
        this.commentsLoading.set(false);
        if (error.status === 404) this.unavailable.emit(this.postId);
        else this.commentsError.set('Could not load comments. Please retry.');
      }
    });
    this.requests.add(this.commentsRequest);
  }

  addComment(): void {
    if (this.writing() || !this.commentsLoaded()) return;
    const content = this.draft().trim();
    this.actionError.set(''); this.feedback.set('');
    if (!content || content.length > this.commentLimit) {
      this.actionError.set(!content ? 'Write a comment before sending.' : 'Comment must be 255 characters or fewer.');
      return;
    }
    this.beginCommentWrite();
    this.deleteConfirmation.set(null);
    this.requests.add(this.api.addComment(this.postId, content).subscribe({
      next: comment => {
        this.comments.update(comments => [...comments, comment]);
        this.draft.set(''); this.writing.set(false); this.feedback.set('Comment added.');
      },
      error: error => {
        this.writing.set(false);
        if (error.status === 404) this.unavailable.emit(this.postId);
        else this.actionError.set(error.status === 400 ? 'Your comment was not accepted. Check the text and try again.'
          : error.status === 403 ? 'You cannot comment on this post.' : 'Could not send your comment. Your draft has been kept.');
      }
    }));
  }

  requestDelete(id: number): void {
    if (this.writing() || !this.ownsComment(id)) return;
    this.actionError.set(''); this.feedback.set(''); this.deleteConfirmation.set(id);
  }

  cancelDelete(): void { if (!this.writing()) this.deleteConfirmation.set(null); }

  confirmDelete(id: number): void {
    if (this.writing() || this.deleteConfirmation() !== id || !this.ownsComment(id)) return;
    this.beginCommentWrite();
    this.actionError.set(''); this.feedback.set('');
    this.requests.add(this.api.deleteComment(id).subscribe({
      next: () => this.removeComment(id, 'Comment deleted.'),
      error: error => {
        if (error.status === 404) this.removeComment(id, 'This comment was already deleted.');
        else {
          this.writing.set(false);
          this.actionError.set(error.status === 403 ? 'You can only delete your own comments.' : 'Could not delete this comment. Please try again.');
        }
      }
    }));
  }

  private ownsComment(id: number): boolean {
    return this.comments().some(comment => comment.id === id && comment.authorId === this.currentUserId);
  }

  private beginCommentWrite(): void {
    this.commentsRequest?.unsubscribe();
    this.commentsLoading.set(false); this.writing.set(true);
  }

  private removeComment(id: number, message: string): void {
    this.comments.update(comments => comments.filter(comment => comment.id !== id));
    this.writing.set(false); this.deleteConfirmation.set(null); this.feedback.set(message);
  }
}
