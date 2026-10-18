import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';

@Component({
  selector: 'app-feed',
  imports: [CommonModule],
  templateUrl: './feed.html',
  styleUrl: './feed.css'
})
export class Feed implements OnInit {

  posts = signal<any[]>([]);

  constructor(private http: HttpClient) {
  }
  ngOnInit() {
    this.http
      .get<any[]>('http://localhost:8080/api/posts/feed')
      .subscribe({
        next: (response) => {
          console.log('FEED:', response);
          this.posts.set(response);
          response.forEach(post => {
            this.loadLikeCount(post.id);
            this.loadComments(post.id);
          });
        },
        error: (error) => {
          console.log('FEED ERROR:', error);
        }
      });
  }

  //like and count like
  likeCounts = signal<{ [postId: number]: number }>({});

  loadLikeCount(postId: number) {
    this.http
      .get<number>(`http://localhost:8080/api/posts/${postId}/likes/count`)
      .subscribe({
        next: (count) => {
          this.likeCounts.update(counts => ({
            ...counts,
            [postId]: count
          }));
        },
        error: (error) => {
          console.log('LIKE COUNT ERROR:', error);
        }
      });
  }
  likePost(postId: number) {
    this.http
      .post(`http://localhost:8080/api/posts/${postId}/likes`, {})
      .subscribe({
        next: () => {
          this.loadLikeCount(postId);
        },
        error: (error) => {
          console.log('LIKE ERROR:', error);
        }
      });
  }
  commentsByPost = signal<{ [postId: number]: any[] }>({});
  loadComments(postId: number) {
    this.http
      .get<any[]>(`http://localhost:8080/api/posts/${postId}/comments`)
      .subscribe({
        next: (comments) => {
          console.log('COMMENTS:', comments);

          this.commentsByPost.update(current => ({
            ...current,
            [postId]: comments
          }));
        },
        error: (error) => {
          console.log('COMMENTS ERROR:', error);
        }
      });
  }
  commentTexts = signal<{ [postId: number]: string }>({});
  setCommentText(postId: number, value: string) {
    this.commentTexts.update(current => ({
      ...current,
      [postId]: value
    }));
  }

  addComment(postId: number) {
    const content = this.commentTexts()[postId];

    if (!content || !content.trim()) {
      return;
    }

    this.http
      .post(`http://localhost:8080/api/posts/${postId}/comments`, {
        content: content
      })
      .subscribe({
        next: () => {
          this.setCommentText(postId, '');
          this.loadComments(postId);
        },
        error: (error) => {
          console.log('ADD COMMENT ERROR:', error);
        }
      });
  }

  deleteComment(commentId: number, postId: number) {
    this.http
      .delete(`http://localhost:8080/api/posts/comments/${commentId}`)
      .subscribe({
        next: () => {
          this.loadComments(postId);
        },
        error: (error) => {
          console.log('DELETE COMMENT ERROR:', error);
        }
      });
  }
  get currentUserId(): number {
    return Number(localStorage.getItem('userId'));
  }
}