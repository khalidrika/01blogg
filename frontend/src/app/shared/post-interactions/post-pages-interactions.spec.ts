import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Profile } from '../../pages/profile/profile';
import { MyPosts } from '../../pages/my-posts/my-posts';
import { API_URL } from '../../core/auth/auth.service';

const post = (authorid: number, id = 10) => ({ id, authorid, title: `Post ${id}`, content: 'Learning Angular',
  authorusername: `student${authorid}`, createdAt: '2026-10-19T10:00:00', mediaUrl: null, mediaType: null });
const comment = (id: number, authorId: number) => ({ id, authorId, authorUsername: `student${authorId}`,
  postId: 10, content: 'Helpful post', createdAt: '2026-10-19T11:00:00' });

describe.each(['/profile/2', '/profile/1', '/my-posts'])('Post interactions on %s', route => {
  let requests: HttpTestingController;
  let harness: RouterTestingHarness;
  const owner = route === '/profile/2' ? 2 : 1;
  beforeEach(async () => {
    localStorage.setItem('userId', '1');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      provideRouter([{ path: 'profile/:id', component: Profile }, { path: 'my-posts', component: MyPosts }])
    ] });
    requests = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create(route);
    if (route.startsWith('/profile/')) loadProfile(owner);
    requests.expectOne(`${API_URL}/users/${owner}/posts`).flush([post(owner)]);
    page();
  });
  afterEach(() => { harness.fixture.destroy(); requests.verify(); localStorage.removeItem('userId'); });

  function page(): HTMLElement { harness.detectChanges(); return harness.routeNativeElement!; }
  function loadProfile(id: number): void {
    requests.expectOne(`${API_URL}/users/${id}`).flush({ id, username: `student${id}`, email: 'student@example.com',
      role: 'USER', followersCount: 0, followingCount: 0 });
    if (id !== 1) requests.expectOne(`${API_URL}/users/${id}/follow`).flush({ following: false, followersCount: 0 });
  }
  function loadInteractions(): void {
    requests.expectOne(`${API_URL}/posts/10/likes`).flush({ liked: false, count: 2 });
    requests.expectOne(`${API_URL}/posts/10/comments`).flush([comment(5, 1), comment(6, 2)]);
  }
  function interactionButton(label: string): HTMLButtonElement {
    return Array.from(page().querySelectorAll<HTMLButtonElement>('app-post-interactions button'))
      .find(button => button.textContent?.trim() === label)!;
  }

  it('loads interactions and changes Like/Unlike for the displayed post', () => {
    loadInteractions();
    expect(page().querySelectorAll('app-post-interactions').length).toBe(1);
    expect(page().querySelector('app-post-interactions')?.textContent).toContain('2 likes');
    interactionButton('Like').click();
    const like = requests.expectOne(`${API_URL}/posts/10/likes`);
    expect(like.request.method).toBe('PUT'); like.flush({ liked: true, count: 3 });
    expect(interactionButton('Unlike').getAttribute('aria-pressed')).toBe('true');
    interactionButton('Unlike').click();
    const unlike = requests.expectOne(`${API_URL}/posts/10/likes`);
    expect(unlike.request.method).toBe('DELETE'); unlike.flush({ liked: false, count: 2 });
    expect(page().querySelector('app-post-interactions')?.textContent).toContain('Like removed.');
  });

  it('adds and deletes an owned comment while keeping post management permissions', () => {
    loadInteractions();
    expect(page().querySelector('[data-comment-id="5"] button')).not.toBeNull();
    expect(page().querySelector('[data-comment-id="6"] button')).toBeNull();
    expect(page().querySelector('a[href="/posts/10/edit"]') !== null).toBe(owner === 1);
    expect(page().querySelector('app-delete-post') !== null).toBe(owner === 1);
    const field = page().querySelector<HTMLTextAreaElement>('app-post-interactions textarea')!;
    field.value = 'Thanks!'; field.dispatchEvent(new Event('input'));
    interactionButton('Add comment').click();
    const create = requests.expectOne(`${API_URL}/posts/10/comments`);
    expect(create.request.body).toEqual({ content: 'Thanks!' });
    create.flush({ ...comment(7, 1), content: 'Thanks!' });
    expect(page().querySelectorAll('.comment').length).toBe(3);
    (page().querySelector('[data-comment-id="7"] button') as HTMLButtonElement).click();
    interactionButton('Delete comment').click();
    requests.expectOne(`${API_URL}/posts/comments/7`).flush(null);
    expect(page().querySelector('[data-comment-id="7"]')).toBeNull();
    expect(page().querySelector('article')).not.toBeNull();
  });

  it('removes a missing post and cancels its remaining interaction request', () => {
    const likes = requests.expectOne(`${API_URL}/posts/10/likes`);
    const comments = requests.expectOne(`${API_URL}/posts/10/comments`);
    likes.flush({}, { status: 404, statusText: 'Not found' });
    expect(page().querySelector('article')).toBeNull();
    expect(comments.cancelled).toBe(true);
    expect(page().textContent).toContain('This post is no longer available');
  });

  it('never restores a removed post from a later list response', () => {
    loadInteractions();
    const component = harness.routeDebugElement!.componentInstance as Profile | MyPosts;
    if (component instanceof Profile) component.loadPosts();
    else component.loadMyPosts();
    const list = requests.expectOne(`${API_URL}/users/${owner}/posts`);
    component.onPostUnavailable(10);
    list.flush([post(owner)]);
    expect(page().querySelector('article')).toBeNull();
    requests.expectNone(request => request.url.includes('/posts/10/'));
  });

  it('cancels a pending comment when navigating and does not carry its draft to the next profile', async () => {
    loadInteractions();
    const field = page().querySelector<HTMLTextAreaElement>('app-post-interactions textarea')!;
    field.value = 'Old post draft'; field.dispatchEvent(new Event('input'));
    interactionButton('Add comment').click();
    const oldComment = requests.expectOne(`${API_URL}/posts/10/comments`);
    await harness.navigateByUrl('/profile/3', Profile);
    expect(oldComment.cancelled).toBe(true);
    loadProfile(3);
    requests.expectOne(`${API_URL}/users/3/posts`).flush([post(3, 20)]);
    page();
    requests.expectOne(`${API_URL}/posts/20/likes`).flush({ liked: false, count: 0 });
    requests.expectOne(`${API_URL}/posts/20/comments`).flush([]);
    expect(page().querySelector<HTMLTextAreaElement>('app-post-interactions textarea')?.value).toBe('');
    expect(page().textContent).not.toContain('Comment added.');
  });
});
