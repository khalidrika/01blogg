import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NotificationService } from './notification.service';
import { API_URL } from '../auth/auth.service';

const endpoint = `${API_URL}/notifications`;
const item = (id: number, read = false) => ({
  id, read, message: 'student published a new post', createdAt: '2026-10-19T10:00:00'
});

describe('Shared notifications', () => {
  let store: NotificationService;
  let requests: HttpTestingController;

  function login(id = 1): void {
    localStorage.setItem('userId', String(id));
    localStorage.setItem('token', `header.${btoa(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`);
  }
  beforeEach(() => {
    login();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(NotificationService);
    requests = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    requests.verify();
    store.reset();
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
  });
  function load(): void {
    store.load();
    requests.expectOne(endpoint).flush([item(1), item(2), item(3, true)]);
  }

  it('shares one loading request between navbar and page', () => {
    store.load(); store.load();
    requests.expectOne(endpoint).flush([item(1), item(2, true)]);
    expect(store.unreadCount()).toBe(1);
    expect(store.loaded()).toBe(true);
    expect(store.loading()).toBe(false);
  });

  it('cancels an older refresh before changing read status and skips polling during the write', () => {
    load(); store.load();
    const oldRefresh = requests.expectOne(endpoint);
    store.setRead(1, true);
    expect(oldRefresh.cancelled).toBe(true);
    store.load(); store.setRead(1, true);
    requests.expectNone(endpoint);
    expect(store.unreadCount()).toBe(2);
    requests.expectOne(`${endpoint}/1/read`).flush(null);
    expect(store.unreadCount()).toBe(1);
    expect(store.pendingIds().size).toBe(0);
  });

  it('handles changes to different notifications finishing in reverse order', () => {
    load();
    store.setRead(1, true); store.setRead(2, true);
    requests.expectOne(`${endpoint}/2/read`).flush(null);
    expect(store.unreadCount()).toBe(1);
    expect(store.pendingIds().has(1)).toBe(true);
    requests.expectOne(`${endpoint}/1/read`).flush(null);
    expect(store.unreadCount()).toBe(0);
  });

  it('clears cached data and cancels the previous request when the account changes', () => {
    load(); store.load();
    const old = requests.expectOne(endpoint);
    login(2); store.load();
    expect(old.cancelled).toBe(true);
    expect(store.loaded()).toBe(false);
    expect(store.notifications()).toEqual([]);
    requests.expectOne(endpoint).flush([item(8)]);
    expect(store.notifications()[0].id).toBe(8);
  });

  it('discards a response if the session changed before polling noticed it', () => {
    store.load();
    const old = requests.expectOne(endpoint);
    login(2);
    old.flush([item(1)]);
    expect(store.notifications()).toEqual([]);
    expect(store.loaded()).toBe(false);
    store.load();
    requests.expectOne(endpoint).flush([item(8)]);
    expect(store.notifications()[0].id).toBe(8);
  });

  it('clears data on logout and does not request notifications anonymously', () => {
    load();
    localStorage.removeItem('token');
    store.load();
    requests.expectNone(endpoint);
    expect(store.notifications()).toEqual([]);
    expect(store.unreadCount()).toBe(0);
    expect(store.loaded()).toBe(false);
  });

  it('cancels pending mutations on reset so they cannot affect a later login', () => {
    load(); store.setRead(1, true);
    const update = requests.expectOne(`${endpoint}/1/read`);
    store.reset(); login(2);
    expect(update.cancelled).toBe(true);
    expect(store.pendingIds().size).toBe(0);
    store.load();
    requests.expectOne(endpoint).flush([item(1)]);
    expect(store.unreadCount()).toBe(1);
  });

  it('ignores nonexistent notifications and actions that already match the saved state', () => {
    load();
    store.setRead(99, true); store.setRead(3, true);
    requests.expectNone(request => request.method === 'PUT');
  });

  it('keeps the last list on refresh failure and replaces it on a successful retry', () => {
    load(); store.load();
    requests.expectOne(endpoint).flush({}, { status: 500, statusText: 'Error' });
    expect(store.error()).toContain('Could not load');
    expect(store.unreadCount()).toBe(2);
    store.load();
    requests.expectOne(endpoint).flush([item(3, true)]);
    expect(store.error()).toBe('');
    expect(store.unreadCount()).toBe(0);
  });
});
