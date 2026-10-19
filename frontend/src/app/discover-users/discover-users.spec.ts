import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DiscoverUsers } from './discover-users';
import { API_URL } from '../core/auth/auth.service';

const user = (id: number) => ({ id, username: `student${id}`, email: `student${id}@example.com`,
  role: 'USER', followersCount: 3, followingCount: 2 });

describe('Discover users and follow actions', () => {
  let fixture: ComponentFixture<DiscoverUsers>;
  let requests: HttpTestingController;
  beforeEach(async () => {
    localStorage.setItem('userId', '1');
    TestBed.configureTestingModule({ imports: [DiscoverUsers], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([])
    ] });
    requests = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DiscoverUsers);
    await fixture.whenStable();
  });
  afterEach(() => { fixture.destroy(); requests.verify(); localStorage.removeItem('userId'); });
  function page(): HTMLElement { fixture.detectChanges(); return fixture.nativeElement; }
  function load(following: { id: number }[] = []) {
    requests.expectOne(`${API_URL}/users`).flush([user(1), user(2)]);
    requests.expectOne(`${API_URL}/users/1/following`).flush(following);
    fixture.detectChanges();
  }

  it('hides the signed-in user and waits for follow status before enabling buttons', () => {
    requests.expectOne(`${API_URL}/users`).flush([user(1), user(2)]);
    expect(page().querySelectorAll('article').length).toBe(1);
    expect((page().querySelector('article button') as HTMLButtonElement).disabled).toBe(true);
    requests.expectOne(`${API_URL}/users/1/following`).flush([{ id: 2 }]);
    expect(page().querySelector('article button')?.textContent?.trim()).toBe('Unfollow');
  });

  it('uses the server count after follow and unfollow without refreshing', () => {
    load();
    (page().querySelector('article button') as HTMLButtonElement).click();
    fixture.componentInstance.toggleFollow(2);
    const follow = requests.expectOne(`${API_URL}/users/2/follow`);
    expect(follow.request.method).toBe('PUT');
    follow.flush({ following: true, followersCount: 9 });
    expect(page().textContent).toContain('9 followers');
    expect(page().querySelector('article button')?.textContent?.trim()).toBe('Unfollow');
    (page().querySelector('article button') as HTMLButtonElement).click();
    const unfollow = requests.expectOne(`${API_URL}/users/2/follow`);
    expect(unfollow.request.method).toBe('DELETE');
    unfollow.flush({ following: false, followersCount: 8 });
    expect(page().textContent).toContain('8 followers');
    expect(page().textContent).toContain('You unfollowed student2.');
  });

  it('leaves state unchanged on failure and retries the same intended action', () => {
    load(); fixture.componentInstance.toggleFollow(2);
    requests.expectOne(`${API_URL}/users/2/follow`).flush({}, { status: 500, statusText: 'Error' });
    expect(page().textContent).toContain('Could not update follow status.');
    expect(fixture.componentInstance.isFollowing(2)).toBe(false);
    expect(page().textContent).toContain('3 followers');
    fixture.componentInstance.toggleFollow(2);
    const retry = requests.expectOne(`${API_URL}/users/2/follow`);
    expect(retry.request.method).toBe('PUT');
    retry.flush({ following: true, followersCount: 4 });
  });

  it('allows retrying follow status without reloading the user list', () => {
    requests.expectOne(`${API_URL}/users`).flush([user(2)]);
    requests.expectOne(`${API_URL}/users/1/following`).flush({}, { status: 500, statusText: 'Error' });
    expect(page().querySelectorAll('article').length).toBe(1);
    const retry = Array.from(page().querySelectorAll('button')).find(button => button.textContent?.trim() === 'Retry follow status')!;
    retry.click();
    requests.expectOne(`${API_URL}/users/1/following`).flush([{ id: 2 }]);
    expect(page().querySelector('article button')?.textContent?.trim()).toBe('Unfollow');
  });

  it('shows an empty state when no other users exist', () => {
    requests.expectOne(`${API_URL}/users`).flush([user(1)]);
    requests.expectOne(`${API_URL}/users/1/following`).flush([]);
    expect(page().textContent).toContain('No other users found.');
  });

  it('allows retrying a failed user list request', () => {
    requests.expectOne(`${API_URL}/users`).flush({}, { status: 500, statusText: 'Error' });
    const retry = Array.from(page().querySelectorAll('button')).find(button => button.textContent?.trim() === 'Retry users')!;
    retry.click(); load();
    expect(page().querySelectorAll('article').length).toBe(1);
  });

  it('does not submit self-follow or unknown user actions', () => {
    load();
    fixture.componentInstance.toggleFollow(1); fixture.componentInstance.toggleFollow(99);
    requests.expectNone(request => ['PUT', 'DELETE'].includes(request.method));
  });

  it('includes navigation to Discover and the user profile', () => {
    load();
    expect(page().querySelector('nav a[href="/discover"]')).not.toBeNull();
    expect(page().querySelector('article a[href="/profile/2"]')).not.toBeNull();
  });
});
