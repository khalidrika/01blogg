import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService, authErrorMessage } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: '../auth.css'
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  email = '';
  password = '';
  pending = signal(false);
  error = signal('');

  get notice(): string {
    const params = this.route.snapshot.queryParamMap;
    if (params.get('reason') === 'banned') return 'Your account has been banned. Please contact an administrator.';
    if (params.get('reason') === 'expired') return 'Your session has ended. Please log in again.';
    if (params.get('registered') === 'true') return 'Account created. You can now log in.';
    return '';
  }

  login(): void {
    if (this.pending()) return;
    if (!this.email.trim() || !this.password) {
      this.error.set('Email and password are required.');
      return;
    }
    this.pending.set(true);
    this.error.set('');
    this.auth.login(this.email.trim(), this.password).pipe(
      finalize(() => this.pending.set(false))
    ).subscribe({
      next: () => {
        this.password = '';
        const target = this.route.snapshot.queryParamMap.get('returnUrl');
        const safeTarget = target?.startsWith('/') && !target.startsWith('//')
          && !/^\/(login|register)([/?#;]|$)/.test(target);
        void this.router.navigateByUrl(safeTarget ? target! : '/feed');
      },
      error: error => this.error.set(authErrorMessage(error))
    });
  }
}
