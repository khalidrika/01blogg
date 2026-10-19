import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { authInterceptor } from './auth-interceptor';
import { API_URL } from '../auth/auth.service';

describe('Auth interceptor', () => {
  let http: HttpClient;
  let requests: HttpTestingController;
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'session-token');
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(), provideRouter([])
    ] });
    http = TestBed.inject(HttpClient);
    requests = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });
  afterEach(() => { requests.verify(); localStorage.clear(); });

  it('attaches the token to backend API requests', () => {
    http.get(`${API_URL}/posts`).subscribe();
    const request = requests.expectOne(`${API_URL}/posts`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer session-token');
    request.flush([]);
  });
  for (const url of [`${API_URL}/login`, `${API_URL}/register`, 'https://example.com/api/posts', 'http://localhost:8080/api-evil/posts']) {
    it(`does not attach credentials to ${url}`, () => {
      http.get(url).subscribe();
      const request = requests.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({});
    });
  }
  it('clears the session on a protected API 401', () => {
    http.get(`${API_URL}/posts`).subscribe({ error: () => {} });
    requests.expectOne(`${API_URL}/posts`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(localStorage.getItem('token')).toBeNull();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'expired' } });
  });
  it('keeps a valid session on an ordinary forbidden action', () => {
    http.get(`${API_URL}/admin/users`).subscribe({ error: () => {} });
    requests.expectOne(`${API_URL}/admin/users`).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(localStorage.getItem('token')).toBe('session-token');
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });
  it('clears a banned session', () => {
    http.get(`${API_URL}/posts`).subscribe({ error: () => {} });
    requests.expectOne(`${API_URL}/posts`).flush({ code: 'ACCOUNT_BANNED' }, { status: 403, statusText: 'Forbidden' });
    expect(localStorage.getItem('token')).toBeNull();
  });
  it('does not clear a newer login after a stale request fails', () => {
    http.get(`${API_URL}/posts`).subscribe({ error: () => {} });
    localStorage.setItem('token', 'new-token');
    requests.expectOne(`${API_URL}/posts`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(localStorage.getItem('token')).toBe('new-token');
  });
});
