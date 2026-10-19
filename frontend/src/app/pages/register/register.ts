import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService, authErrorMessage } from '../../core/auth/auth.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: '../auth.css'
})
export class Register {
  private auth = inject(AuthService);
  private router = inject(Router);
  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  pending = signal(false);
  error = signal('');

  register(): void {
    if (this.pending()) return;
    if (!this.username.trim() || !this.email.trim() || !this.password.trim() || this.password.length < 6) {
      this.error.set('Enter a username, email and a password of at least 6 characters.');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error.set('Passwords do not match.');
      return;
    }
    this.error.set('');
    this.pending.set(true);
    this.auth.register(this.username.trim(), this.email.trim(), this.password).pipe(
      finalize(() => this.pending.set(false))
    ).subscribe({
      next: () => {
        this.password = this.confirmPassword = '';
        void this.router.navigate(['/login'], { queryParams: { registered: true } });
      },
      error: error => this.error.set(authErrorMessage(error))
    });
  }
}
