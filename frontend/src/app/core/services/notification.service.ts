import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { finalize, Subscription } from 'rxjs';
import { API_URL, AuthService } from '../auth/auth.service';

export interface BlogNotification {
  id: number;
  message: string;
  read: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private session: string | null = null;
  private loadRequest?: Subscription;
  private actions = new Subscription();

  readonly notifications = signal<BlogNotification[]>([]);
  readonly loaded = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly feedback = signal('');
  readonly pendingIds = signal<ReadonlySet<number>>(new Set());
  readonly actionErrors = signal<Record<number, string>>({});
  readonly unreadCount = computed(() => this.notifications().filter(item => !item.read).length);

  load(): void {
    const session = this.syncSession();
    // Navbar, page entry and polling share one request. Do not reload over a pending change.
    if (!session || this.loading() || this.pendingIds().size) return;
    this.loading.set(true);
    this.error.set('');
    this.loadRequest = this.http.get<BlogNotification[]>(`${API_URL}/notifications`).pipe(
      finalize(() => { if (this.session === session) this.loading.set(false); })
    ).subscribe({
      next: items => {
        if (!this.acceptSession(session)) return;
        this.notifications.set(items);
        this.loaded.set(true);
      },
      error: () => {
        if (!this.acceptSession(session)) return;
        this.error.set('Could not load notifications. Please try again.');
      }
    });
  }

  setRead(id: number, read: boolean): void {
    const session = this.syncSession();
    const notification = this.notifications().find(item => item.id === id);
    if (!session || !notification || notification.read === read || this.pendingIds().has(id)) return;

    // A GET started before this write could otherwise restore the old read status.
    this.loadRequest?.unsubscribe();
    this.pendingIds.update(ids => new Set([...ids, id]));
    this.actionErrors.update(errors => ({ ...errors, [id]: '' }));
    this.feedback.set('');
    const request = this.http.put<void>(`${API_URL}/notifications/${id}/${read ? 'read' : 'unread'}`, {}).pipe(
      finalize(() => {
        if (this.session === session) this.pendingIds.update(ids => {
          const remaining = new Set(ids);
          remaining.delete(id);
          return remaining;
        });
      })
    ).subscribe({
      next: () => {
        if (!this.acceptSession(session)) return;
        this.notifications.update(items => items.map(item => item.id === id ? { ...item, read } : item));
        this.feedback.set(`Notification marked as ${read ? 'read' : 'unread'}.`);
      },
      error: (error: HttpErrorResponse) => {
        if (!this.acceptSession(session)) return;
        const message = error.status === 404 ? 'This notification no longer exists. Refresh the list.'
          : error.status === 403 ? 'You cannot modify this notification.'
          : 'Could not update this notification. Please try again.';
        this.actionErrors.update(errors => ({ ...errors, [id]: message }));
      }
    });
    this.actions.add(request);
  }

  reset(): void {
    this.session = null;
    this.loadRequest?.unsubscribe();
    this.actions.unsubscribe();
    this.actions = new Subscription();
    this.notifications.set([]);
    this.loaded.set(false);
    this.loading.set(false);
    this.error.set('');
    this.feedback.set('');
    this.pendingIds.set(new Set());
    this.actionErrors.set({});
  }

  private syncSession(): string | null {
    const session = this.auth.isAuthenticated() ? this.auth.token : null;
    if (this.session !== session) {
      this.reset();
      this.session = session;
    }
    return session;
  }

  private acceptSession(session: string): boolean {
    return this.syncSession() === session;
  }
}
