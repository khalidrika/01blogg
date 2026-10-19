import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { Navbar } from './navbar';
import { API_URL } from '../../core/auth/auth.service';

const endpoint = `${API_URL}/notifications`;
const notification = { id: 1, message: 'New post', read: false, createdAt: '2026-10-19T10:00:00' };

describe('Navbar notifications', () => {
  let fixture: ComponentFixture<Navbar>;
  let requests: HttpTestingController;
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    localStorage.setItem('userId', '1');
    localStorage.setItem('token', `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`);
    TestBed.configureTestingModule({ imports: [Navbar], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([])
    ] });
    requests = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Navbar);
    await fixture.whenStable();
  });
  afterEach(() => {
    fixture.destroy(); requests.verify();
    localStorage.removeItem('token'); localStorage.removeItem('userId');
    vi.restoreAllMocks(); vi.useRealTimers();
  });

  it('finds new notifications every 30 seconds and stops polling after navigation', () => {
    requests.expectOne(endpoint).flush([]);
    vi.advanceTimersByTime(29_999);
    requests.expectNone(endpoint);
    vi.advanceTimersByTime(1);
    requests.expectOne(endpoint).flush([notification]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.notification-count').textContent).toBe('1');
    fixture.destroy();
    vi.advanceTimersByTime(60_000);
    requests.expectNone(endpoint);
  });

  it('clears the notification cache and badge on logout', () => {
    requests.expectOne(endpoint).flush([notification]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.componentInstance.logout();
    expect(localStorage.getItem('token')).toBeNull();
    expect(fixture.componentInstance.notifications.notifications()).toEqual([]);
    expect(navigate).toHaveBeenCalledWith(['/login']);
    vi.advanceTimersByTime(30_000);
    requests.expectNone(endpoint);
  });

  it('clears the previous account immediately after a logout in another tab', () => {
    requests.expectOne(endpoint).flush([notification]);
    localStorage.removeItem('token');
    window.dispatchEvent(new StorageEvent('storage', { key: 'token' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.notification-count')).toBeNull();
    expect(fixture.componentInstance.notifications.loaded()).toBe(false);
    requests.expectNone(endpoint);
  });
});
