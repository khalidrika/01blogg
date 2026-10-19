import { Component, DestroyRef, ElementRef, inject, OnInit, signal, ViewChild, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Observable, Subscription } from 'rxjs';
import { AdminService, AdminUser, UserReport } from '../../core/services/admin.service';
import { ProfilePost } from '../../core/services/profile.service';
import { API_URL } from '../../core/auth/auth.service';
import { Navbar } from '../../shared/navbar/navbar';

type Section = 'users' | 'posts' | 'reports';
type ActionKind = 'ban' | 'unban' | 'delete-user' | 'delete-post';
interface ModerationAction { kind: ActionKind; id: number; label: string; description: string; }

@Component({
  selector: 'app-admin',
  imports: [CommonModule, RouterLink, Navbar],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class Admin implements OnInit {
  private readonly api = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loads: Partial<Record<Section, Subscription>> = {};
  @ViewChild('confirmationDialog', { static: true }) private dialog!: ElementRef<HTMLDialogElement>;

  readonly sections: Section[] = ['users', 'posts', 'reports'];
  readonly selected = signal<Section>('users');
  readonly users = signal<AdminUser[]>([]);
  readonly posts = signal<ProfilePost[]>([]);
  readonly reports = signal<UserReport[]>([]);
  readonly loading = signal<Record<Section, boolean>>({ users: false, posts: false, reports: false });
  readonly loaded = signal<Record<Section, boolean>>({ users: false, posts: false, reports: false });
  readonly errors = signal<Record<Section, string>>({ users: '', posts: '', reports: '' });
  readonly action = signal<ModerationAction | null>(null);
  readonly pending = signal(false);
  readonly actionError = signal('');
  readonly status = signal('');
  readonly mediaOrigin = new URL(API_URL).origin;

  ngOnInit(): void { this.sections.forEach(section => this.loadSection(section)); }

  selectSection(section: Section): void {
    if (!this.pending()) this.selected.set(section);
  }

  loadSection(section: Section): void {
    if (this.pending()) return;
    if (section === 'users') this.loadList(section, this.api.getUsers(), this.users);
    if (section === 'posts') this.loadList(section, this.api.getPosts(), this.posts);
    if (section === 'reports') this.loadList(section, this.api.getReports(), this.reports);
  }

  private loadList<T>(section: Section, request: Observable<T[]>, destination: WritableSignal<T[]>): void {
    this.loads[section]?.unsubscribe();
    this.loading.update(state => ({ ...state, [section]: true }));
    this.errors.update(state => ({ ...state, [section]: '' }));
    this.loads[section] = request.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.update(state => ({ ...state, [section]: false })))
    ).subscribe({
      next: items => {
        destination.set(items);
        this.loaded.update(state => ({ ...state, [section]: true }));
      },
      error: () => this.errors.update(state => ({ ...state, [section]: `Could not load ${section}. Please try again.` }))
    });
  }

  findUser(id: number): AdminUser | undefined { return this.users().find(user => user.id === id); }

  requestUserAction(kind: 'ban' | 'unban' | 'delete-user', id: number): void {
    const user = this.findUser(id);
    if (this.pending() || !user || user.role === 'ADMIN') return;
    if ((kind === 'ban' && user.banned) || (kind === 'unban' && !user.banned)) return;
    const verb = kind === 'delete-user' ? 'Delete' : kind === 'ban' ? 'Ban' : 'Unban';
    this.openConfirmation({
      kind, id, label: `${verb} ${user.username}?`,
      description: kind === 'delete-user'
        ? 'This permanently deletes the account, its posts and media, comments, likes, follows, notifications and related reports. This cannot be undone.'
        : kind === 'ban'
          ? 'This user will no longer be able to sign in or use an existing session. Their posts remain visible.'
          : 'This user will be able to sign in again.'
    });
  }

  requestPostDeletion(id: number): void {
    const post = this.posts().find(post => post.id === id);
    if (this.pending() || !post) return;
    this.openConfirmation({
      kind: 'delete-post', id, label: `Delete “${post.title}”?`,
      description: 'This permanently removes the post, its media, likes and comments. This cannot be undone.'
    });
  }

  private openConfirmation(action: ModerationAction): void {
    this.action.set(action);
    this.actionError.set('');
    this.status.set('');
    this.dialog.nativeElement.showModal();
  }

  cancelAction(): void {
    if (this.pending()) return;
    this.closeConfirmation();
  }

  onDialogCancel(event: Event): void {
    event.preventDefault();
    this.cancelAction();
  }

  private closeConfirmation(): void {
    this.dialog.nativeElement.close();
    this.action.set(null);
    this.actionError.set('');
  }

  confirmAction(): void {
    const action = this.action();
    if (!action || this.pending()) return;
    // Cancel snapshots taken before the write so they cannot restore a deleted item.
    const interrupted = this.sections.filter(section => this.loading()[section]);
    this.sections.forEach(section => this.loads[section]?.unsubscribe());
    this.pending.set(true);
    this.actionError.set('');
    const request = action.kind === 'delete-user' ? this.api.deleteUser(action.id)
      : action.kind === 'delete-post' ? this.api.deletePost(action.id)
      : this.api.setBanned(action.id, action.kind === 'ban');

    request.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.pending.set(false);
        if (!this.destroyRef.destroyed) interrupted.forEach(section => this.loadSection(section));
      })
    ).subscribe({
      next: () => {
        if (action.kind === 'delete-user') this.removeUser(action.id);
        else if (action.kind === 'delete-post') this.posts.update(posts => posts.filter(post => post.id !== action.id));
        else this.users.update(users => users.map(user => user.id === action.id ? { ...user, banned: action.kind === 'ban' } : user));
        this.status.set(action.kind === 'delete-user' ? 'User and related content deleted.'
          : action.kind === 'delete-post' ? 'Post deleted.'
          : action.kind === 'ban' ? 'User banned.' : 'User unbanned.');
        this.closeConfirmation();
      },
      error: error => {
        if (error.status === 404) {
          if (action.kind === 'delete-post') this.posts.update(posts => posts.filter(post => post.id !== action.id));
          else this.removeUser(action.id);
          this.status.set(action.kind === 'delete-post'
            ? 'This post no longer exists. It has been removed from the list.'
            : 'This user no longer exists. Related entries have been removed from the lists.');
          this.closeConfirmation();
          return;
        }
        this.actionError.set(error.status === 403 ? 'You do not have permission to perform this action.'
          : error.status === 400 && typeof error.error?.message === 'string' ? error.error.message
          : 'Could not complete this action. Please try again.');
      }
    });
  }

  private removeUser(id: number): void {
    this.users.update(users => users.filter(user => user.id !== id));
    this.posts.update(posts => posts.filter(post => post.authorid !== id));
    this.reports.update(reports => reports.filter(report => report.reporterId !== id && report.reportedUserId !== id));
  }
}
