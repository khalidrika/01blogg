import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Profile } from './profile';
import { API_URL } from '../../core/auth/auth.service';
import { InteractionService } from '../../core/services/interaction.service';
import { of } from 'rxjs';

const user = (id = 2) => ({
  id, username: `student${id}`, email: `student${id}@example.com`, role: 'USER',
  followersCount: 3, followingCount: 4
});
const post = (id: number, mediaType: 'image' | 'video' | null = null) => ({
  id, title: `Post ${id}`, content: `Content ${id}`, authorid: 2, authorusername: 'student2',
  mediaUrl: mediaType ? `/uploads/post-${id}.${mediaType === 'image' ? 'png' : 'mp4'}` : null,
  mediaType, createdAt: `2026-10-${id === 1 ? '18' : '19'}T10:30:00`
});

describe('Profile posts', () => {
  let requests: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    localStorage.setItem('userId', '1');
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      // These tests cover profile management; the shared page integration suite exercises real interaction requests.
      { provide: InteractionService, useValue: { getLikes: () => of({ liked: false, count: 0 }), getComments: () => of([]) } },
      provideRouter([{ path: 'profile/:id', component: Profile }])
    ] });
    requests = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create('/profile/2');
  });

  afterEach(() => {
    requests.verify();
    localStorage.removeItem('userId');
  });

  function completeProfile(id = 2) {
    requests.expectOne(`${API_URL}/users/${id}`).flush(user(id));
    if (id !== Number(localStorage.getItem('userId'))) {
      requests.expectOne(`${API_URL}/users/${id}/follow`).flush({ following: false, followersCount: 3 });
    }
  }

  function page(): HTMLElement {
    harness.detectChanges();
    return harness.routeNativeElement!;
  }

  it('shows loading states while the profile and posts arrive independently', () => {
    expect(page().textContent).toContain('Loading profile...');
    completeProfile();
    expect(page().textContent).toContain('Loading posts...');
    requests.expectOne(`${API_URL}/users/2/posts`).flush([]);
    expect(page().textContent).not.toContain('Loading posts...');
  });

  it('renders text, images, videos and dates with the newest posts first', () => {
    completeProfile();
    requests.expectOne(`${API_URL}/users/2/posts`).flush([post(1, 'image'), post(2, 'video')]);
    const articles = page().querySelectorAll('article');
    expect(articles.length).toBe(2);
    expect(articles[0].querySelector('h3')?.textContent).toBe('Post 2');
    expect(articles[1].textContent).toContain('Content 1');
    expect(articles[0].querySelector('video')?.getAttribute('src')).toBe('http://localhost:8080/uploads/post-2.mp4');
    expect(articles[0].querySelector('video')?.hasAttribute('controls')).toBe(true);
    expect(articles[1].querySelector('img')?.getAttribute('alt')).toBe('Post 1');
    expect(articles[1].querySelector('time')?.getAttribute('datetime')).toBe('2026-10-18T10:30:00');
    expect(articles[1].querySelector('time')?.textContent?.trim()).toBeTruthy();
  });

  it('shows Edit only for posts owned by the signed-in user', () => {
    completeProfile();
    requests.expectOne(`${API_URL}/users/2/posts`).flush([post(1), { ...post(2), authorid: 1 }]);
    expect(page().querySelector('a[href="/posts/1/edit"]')).toBeNull();
    expect(page().querySelectorAll('app-delete-post').length).toBe(1);
    expect(page().querySelector('a[href="/posts/2/edit"]')).not.toBeNull();
  });

  it('shows an empty state for a user without posts', () => {
    completeProfile();
    requests.expectOne(`${API_URL}/users/2/posts`).flush([]);
    expect(page().textContent).toContain('This user has not published any posts yet.');
  });

  it('keeps profile details visible when posts fail and allows retry', () => {
    completeProfile();
    requests.expectOne(`${API_URL}/users/2/posts`).flush({}, { status: 500, statusText: 'Server error' });
    expect(page().textContent).toContain('student2');
    expect(page().textContent).toContain('Could not load posts.');
    expect(page().textContent).not.toContain('has not published');
    const retry = Array.from(page().querySelectorAll('button')).find(button => button.textContent?.includes('Retry posts'))!;
    retry.click();
    requests.expectOne(`${API_URL}/users/2/posts`).flush([post(1)]);
    expect(page().querySelectorAll('article').length).toBe(1);
    expect(page().textContent).not.toContain('Could not load posts.');
  });

  it('shows a missing profile without presenting an empty post list as a valid profile', () => {
    requests.expectOne(`${API_URL}/users/2`).flush({}, { status: 404, statusText: 'Not Found' });
    requests.expectOne(`${API_URL}/users/2/posts`).flush([]);
    expect(page().textContent).toContain('User not found.');
    expect(page().querySelector('#posts-title')).toBeNull();
  });

  it('cancels old requests when navigating to another profile in the same component', async () => {
    const oldProfile = requests.expectOne(`${API_URL}/users/2`);
    const oldPosts = requests.expectOne(`${API_URL}/users/2/posts`);
    await harness.navigateByUrl('/profile/1', Profile);
    expect(oldProfile.cancelled).toBe(true);
    expect(oldPosts.cancelled).toBe(true);
    completeProfile(1);
    requests.expectOne(`${API_URL}/users/1/posts`).flush([]);
    expect(page().textContent).toContain('My posts');
    expect(page().textContent).toContain('You have not published any posts yet.');
    expect(page().querySelector('#report-reason')).toBeNull();
    expect(page().querySelector('a[href="/create-post"]')).not.toBeNull();
  });

  it('clears old posts and report input when changing profiles', async () => {
    completeProfile();
    requests.expectOne(`${API_URL}/users/2/posts`).flush([post(1)]);
    const component = harness.routeDebugElement!.componentInstance as Profile;
    component.reportReason.set('Reason for user 2');
    await harness.navigateByUrl('/profile/3', Profile);
    expect(component.posts()).toEqual([]);
    expect(component.reportReason()).toBe('');
    completeProfile(3);
    requests.expectOne(`${API_URL}/users/3/posts`).flush([]);
    expect(page().textContent).not.toContain('Post 1');
    expect(page().textContent).toContain('student3');
  });

  it('rejects invalid profile addresses without sending API requests', async () => {
    completeProfile();
    requests.expectOne(`${API_URL}/users/2/posts`).flush([]);
    await harness.navigateByUrl('/profile/not-a-number', Profile);
    expect(page().textContent).toContain('Invalid profile address.');
    requests.expectNone(request => request.url.startsWith(`${API_URL}/users/`));
  });

  it('refreshes follower counts without reloading or losing the post list', () => {
    completeProfile();
    requests.expectOne(`${API_URL}/users/2/posts`).flush([post(1)]);
    const component = harness.routeDebugElement!.componentInstance as Profile;
    component.followUser();
    const request = requests.expectOne(`${API_URL}/users/2/follow`);
    expect(request.request.method).toBe('PUT');
    request.flush({ following: true, followersCount: 4 });
    expect(page().textContent).toContain('4 followers');
    expect(page().querySelectorAll('article').length).toBe(1);
  });
  it('removes the last owned post only after confirmed deletion succeeds', async () => {
    completeProfile();
    requests.expectOne(`${API_URL}/users/2/posts`).flush([]);
    await harness.navigateByUrl('/profile/1', Profile);
    completeProfile(1);
    requests.expectOne(`${API_URL}/users/1/posts`).flush([{ ...post(1), authorid: 1 }]);
    (page().querySelector('app-delete-post button') as HTMLButtonElement).click();
    requests.expectNone(`${API_URL}/posts/1`);
    const confirm = Array.from(page().querySelectorAll('app-delete-post button'))
      .find(button => button.textContent?.trim() === 'Delete post') as HTMLButtonElement;
    confirm.click();
    const deletion = requests.expectOne(`${API_URL}/posts/1`);
    expect(page().querySelectorAll('article').length).toBe(1);
    deletion.flush(null, { status: 204, statusText: 'No Content' });
    expect(page().querySelectorAll('article').length).toBe(0);
    expect(page().textContent).toContain('Post deleted successfully.');
    expect(page().textContent).toContain('You have not published any posts yet.');
  });

  it('keeps the list unchanged if deletion fails', () => {
    completeProfile();
    requests.expectOne(`${API_URL}/users/2/posts`).flush([{ ...post(1), authorid: 1 }]);
    (page().querySelector('app-delete-post button') as HTMLButtonElement).click();
    const confirm = Array.from(page().querySelectorAll('app-delete-post button'))
      .find(button => button.textContent?.trim() === 'Delete post') as HTMLButtonElement;
    confirm.click();
    requests.expectOne(`${API_URL}/posts/1`).flush({}, { status: 500, statusText: 'Error' });
    expect(page().querySelectorAll('article').length).toBe(1);
    expect(page().textContent).toContain('Could not delete the post.');
    expect(page().textContent).not.toContain('Post deleted successfully.');
  });

  it('shows an existing follow and updates it to Unfollow without losing posts', () => {
    requests.expectOne(`${API_URL}/users/2`).flush(user());
    requests.expectOne(`${API_URL}/users/2/posts`).flush([post(1)]);
    requests.expectOne(`${API_URL}/users/2/follow`).flush({ following: true, followersCount: 3 });
    const unfollow = Array.from(page().querySelectorAll('button')).find(button => button.textContent?.trim() === 'Unfollow')!;
    unfollow.click();
    const request = requests.expectOne(`${API_URL}/users/2/follow`);
    expect(request.request.method).toBe('DELETE');
    request.flush({ following: false, followersCount: 2 });
    expect(page().textContent).toContain('2 followers');
    expect(page().querySelectorAll('article').length).toBe(1);
    expect(Array.from(page().querySelectorAll('button')).some(button => button.textContent?.trim() === 'Follow')).toBe(true);
  });

  it('disables follow until its status is available and supports retry', () => {
    requests.expectOne(`${API_URL}/users/2`).flush(user());
    requests.expectOne(`${API_URL}/users/2/posts`).flush([]);
    const component = harness.routeDebugElement!.componentInstance as Profile;
    component.followUser();
    requests.expectNone(request => request.method === 'PUT');
    requests.expectOne(`${API_URL}/users/2/follow`).flush({}, { status: 500, statusText: 'Error' });
    expect(page().textContent).toContain('Could not load follow status.');
    component.loadFollowStatus();
    requests.expectOne(`${API_URL}/users/2/follow`).flush({ following: false, followersCount: 3 });
    expect(component.followStatusLoaded()).toBe(true);
    expect(component.followError()).toBe('');
  });

  it('preserves the previous follow state and count when the mutation fails', () => {
    completeProfile();
    requests.expectOne(`${API_URL}/users/2/posts`).flush([]);
    const component = harness.routeDebugElement!.componentInstance as Profile;
    component.followUser(); component.followUser();
    requests.expectOne(`${API_URL}/users/2/follow`).flush({}, { status: 500, statusText: 'Error' });
    expect(component.followPending()).toBe(false);
    expect(component.isFollowing()).toBe(false);
    expect(page().textContent).toContain('3 followers');
    expect(page().textContent).toContain('Could not update follow status.');
  });

  it('cancels old follow status requests when switching profiles', async () => {
    requests.expectOne(`${API_URL}/users/2`).flush(user());
    requests.expectOne(`${API_URL}/users/2/posts`).flush([]);
    const oldStatus = requests.expectOne(`${API_URL}/users/2/follow`);
    await harness.navigateByUrl('/profile/3', Profile);
    expect(oldStatus.cancelled).toBe(true);
    completeProfile(3);
    requests.expectOne(`${API_URL}/users/3/posts`).flush([]);
    const component = harness.routeDebugElement!.componentInstance as Profile;
    expect(component.isFollowing()).toBe(false);
  });

});
