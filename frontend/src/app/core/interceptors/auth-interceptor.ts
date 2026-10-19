import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_URL, AuthService } from '../auth/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const url = new URL(req.url, window.location.origin);
  const api = new URL(API_URL);
  const isApi = url.origin === api.origin && url.pathname.startsWith(`${api.pathname}/`);
  const isPublic = [`${api.pathname}/login`, `${api.pathname}/register`].includes(url.pathname);
  if (!isApi || isPublic) return next(req);

  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token;
  const request = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(request).pipe(catchError((error: HttpErrorResponse) => {
    const banned = error.status === 403 && error.error?.code === 'ACCOUNT_BANNED';
    // An old in-flight request must not clear a newer login session.
    if ((error.status === 401 || banned) && auth.token === token) {
      auth.logout();
      void router.navigate(['/login'], { queryParams: { reason: banned ? 'banned' : 'expired' } });
    }
    return throwError(() => error);
  }));
};
