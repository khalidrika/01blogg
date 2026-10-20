import { Component, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, fromEvent, interval } from 'rxjs';

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar implements OnInit, OnDestroy {
  readonly menuOpen = signal(false);
  readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  constructor(private router: Router, private auth: AuthService) {}

  ngOnInit(): void {
    this.notifications.load();
    interval(30_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.notifications.load());
    fromEvent<StorageEvent>(window, 'storage').pipe(
      filter(event => event.key === null || event.key === 'token' || event.key === 'userId'),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.notifications.load());
  }

  ngOnDestroy(): void {
    if (!this.auth.isAuthenticated()) this.notifications.reset();
  }

  get currentUserId(): number {
    return Number(localStorage.getItem('userId'));
  }

  get role(): string | null {
    return localStorage.getItem('role');
  }

  logout(): void {
    this.auth.logout();
    this.notifications.reset();
    void this.router.navigate(['/login']);
  }
}
