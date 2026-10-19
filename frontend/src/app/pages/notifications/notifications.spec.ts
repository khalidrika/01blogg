import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Notifications } from './notifications';
import { API_URL } from '../../core/auth/auth.service';

const endpoint = `${API_URL}/notifications`;
const notification = { id: 1, message: 'student2 published a new post', read: false, createdAt: '2026-10-19T10:00:00' };

describe('Notifications page', () => {
  let fixture: ComponentFixture<Notifications>;
  let requests: HttpTestingController;
  beforeEach(async () => {
    localStorage.setItem('userId', '1');
    localStorage.setItem('token', `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`);
    TestBed.configureTestingModule({ imports: [Notifications], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([])
    ] });
    requests = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Notifications);
    await fixture.whenStable();
  });
  afterEach(() => {
    fixture.destroy();
    requests.verify();
    localStorage.removeItem('token'); localStorage.removeItem('userId');
  });
  function page(): HTMLElement { fixture.detectChanges(); return fixture.nativeElement; }
  function action(): HTMLButtonElement { return page().querySelector('article button')!; }

  it('shows loading, then message, timestamp, unread styling and a shared navbar badge', () => {
    expect(page().textContent).toContain('Loading notifications');
    expect(page().querySelector('article')).toBeNull();
    requests.expectOne(endpoint).flush([notification]);
    expect(page().querySelector('article.unread')?.textContent).toContain(notification.message);
    expect(page().querySelector('time')?.getAttribute('datetime')).toBe(notification.createdAt);
    expect(page().querySelector('.notification-count')?.textContent).toBe('1');
    expect(page().querySelector('nav a[href="/notifications"]')?.getAttribute('aria-label')).toBe('Notifications, 1 unread');
  });

  it('updates read/unread status and the badge only after successful saves', () => {
    requests.expectOne(endpoint).flush([notification]);
    action().click();
    expect(action().disabled).toBe(true);
    expect(page().querySelector('.notification-count')?.textContent).toBe('1');
    const read = requests.expectOne(`${endpoint}/1/read`);
    expect(read.request.method).toBe('PUT');
    read.flush(null);
    expect(action().textContent?.trim()).toBe('Mark as unread');
    expect(page().querySelector('.notification-count')).toBeNull();
    expect(page().querySelector('article.unread')).toBeNull();
    expect(page().textContent).toContain('Notification marked as read.');
    action().click();
    requests.expectOne(`${endpoint}/1/unread`).flush(null);
    expect(page().querySelector('.notification-count')?.textContent).toBe('1');
    expect(action().textContent?.trim()).toBe('Mark as read');
    requests.expectNone(endpoint);
  });

  it('keeps read status and count after a failed save and allows retrying', () => {
    requests.expectOne(endpoint).flush([notification]);
    action().click();
    requests.expectOne(`${endpoint}/1/read`).flush({}, { status: 500, statusText: 'Error' });
    expect(page().textContent).toContain('Could not update this notification.');
    expect(action().disabled).toBe(false);
    expect(action().textContent?.trim()).toBe('Mark as read');
    expect(page().querySelector('.notification-count')?.textContent).toBe('1');
    action().click();
    requests.expectOne(`${endpoint}/1/read`).flush(null);
    expect(page().querySelector('article [role="alert"]')).toBeNull();
  });

  it.each([
    [403, 'You cannot modify this notification.'],
    [404, 'This notification no longer exists. Refresh the list.']
  ])('explains a rejected action with status %s', (status, message) => {
    requests.expectOne(endpoint).flush([notification]);
    action().click();
    requests.expectOne(`${endpoint}/1/read`).flush({}, { status, statusText: 'Error' });
    expect(page().querySelector('article [role="alert"]')?.textContent).toBe(message);
    expect(page().querySelector('.notification-count')?.textContent).toBe('1');
  });

  it('shows an empty state after a successful empty response', () => {
    requests.expectOne(endpoint).flush([]);
    expect(page().textContent).toContain('No notifications yet.');
    expect(page().querySelector('.notification-count')).toBeNull();
  });

  it('shows a retry instead of a misleading empty state when loading fails', () => {
    requests.expectOne(endpoint).flush({}, { status: 500, statusText: 'Error' });
    expect(page().textContent).toContain('Could not load notifications.');
    expect(page().textContent).not.toContain('No notifications yet.');
    expect(page().querySelector('nav .notification-warning')).not.toBeNull();
    (page().querySelector('main [role="alert"] button') as HTMLButtonElement).click();
    requests.expectOne(endpoint).flush([notification]);
    expect(page().querySelector('article')).not.toBeNull();
    expect(page().querySelector('nav .notification-warning')).toBeNull();
  });

  it('renders notification messages as text', () => {
    requests.expectOne(endpoint).flush([{ ...notification, message: '<img src=x onerror=alert(1)> published a new post' }]);
    expect(page().querySelector('article img')).toBeNull();
    expect(page().querySelector('article .message')?.textContent).toContain('<img src=x');
  });
});
