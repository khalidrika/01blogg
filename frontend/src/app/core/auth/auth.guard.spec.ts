import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { authGuard, adminGuard } from './auth.guard';
import { AuthService } from './auth.service';

function session(role = 'USER', expires = Date.now() / 1000 + 300) {
  localStorage.setItem('token', `header.${btoa(JSON.stringify({ exp: expires }))}.signature`);
  localStorage.setItem('userId', '1');
  localStorage.setItem('role', role);
}

describe('Authentication guards', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideRouter([])] });
  });
  afterEach(() => localStorage.clear());
  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/admin' } as RouterStateSnapshot;

  it('redirects an anonymous visitor to login and preserves the destination', () => {
    const result = TestBed.runInInjectionContext(() => authGuard(route, state)) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login?returnUrl=%2Fadmin');
  });
  it('clears an expired session', () => {
    session('ADMIN', Date.now() / 1000 - 1);
    TestBed.runInInjectionContext(() => authGuard(route, state));
    expect(localStorage.getItem('token')).toBeNull();
  });
  it('rejects a malformed token', () => {
    session();
    localStorage.setItem('token', 'broken');
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
  });
  it('allows a signed-in user to access user pages', () => {
    session();
    expect(TestBed.runInInjectionContext(() => authGuard(route, state))).toBe(true);
  });
  it('blocks a regular user from the admin page', () => {
    session();
    const result = TestBed.runInInjectionContext(() => adminGuard(route, state)) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/forbidden');
  });
  it('allows the admin page for an admin session', () => {
    session('ADMIN');
    expect(TestBed.runInInjectionContext(() => adminGuard(route, state))).toBe(true);
  });
  it('logs out without deleting unrelated app preferences', () => {
    session();
    localStorage.setItem('theme', 'dark');
    TestBed.inject(AuthService).logout();
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(localStorage.getItem('userId')).toBeNull();
    expect(localStorage.getItem('role')).toBeNull();
  });
});
