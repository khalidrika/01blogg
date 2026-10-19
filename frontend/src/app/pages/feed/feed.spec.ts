import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Feed } from './feed';
import { API_URL } from '../../core/auth/auth.service';

const post = { id: 10, title: 'Learning Angular', content: 'Today I learned about signals', authorid: 2,
  authorusername: 'student2', createdAt: '2026-10-19T10:00:00', mediaUrl: '/uploads/photo.png', mediaType: 'image' };

describe('Feed', () => {
  let fixture: ComponentFixture<Feed>;
  let requests: HttpTestingController;
  beforeEach(async () => {
    localStorage.setItem('userId', '1');
    TestBed.configureTestingModule({ imports: [Feed], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    requests = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Feed);
    await fixture.whenStable();
  });
  afterEach(() => { fixture.destroy(); requests.verify(); localStorage.removeItem('userId'); });
  function page(): HTMLElement { fixture.detectChanges(); return fixture.nativeElement; }
  function load(): void {
    requests.expectOne(`${API_URL}/posts/feed`).flush([post]);
    page();
    requests.expectOne(`${API_URL}/posts/10/likes`).flush({ liked: false, count: 0 });
    requests.expectOne(`${API_URL}/posts/10/comments`).flush([]);
  }

  it('renders author links, media, timestamps and interactions', () => {
    expect(page().textContent).toContain('Loading your feed');
    load();
    expect(page().querySelector('article h2')?.textContent).toBe(post.title);
    expect(page().querySelector('article a')?.getAttribute('href')).toBe('/profile/2');
    expect(page().querySelector('article time')?.getAttribute('datetime')).toBe(post.createdAt);
    expect(page().querySelector('img')?.getAttribute('alt')).toBe(post.title);
    expect(page().textContent).toContain('No comments yet.');
  });

  it('offers discovery for an empty feed', () => {
    requests.expectOne(`${API_URL}/posts/feed`).flush([]);
    expect(page().textContent).toContain('No posts in your feed yet.');
    expect(page().querySelector('main a[href="/discover"]')).not.toBeNull();
  });

  it('shows an error and retries without presenting failed loading as an empty feed', () => {
    requests.expectOne(`${API_URL}/posts/feed`).flush({}, { status: 500, statusText: 'Error' });
    expect(page().textContent).toContain('Could not load your feed.');
    expect(page().textContent).not.toContain('No posts in your feed yet.');
    (page().querySelector('[role="alert"] button') as HTMLButtonElement).click();
    load();
  });

  it('removes a post reported missing by its interactions and ignores older feed snapshots', () => {
    load(); fixture.componentInstance.loadFeed();
    const oldFeed = requests.expectOne(`${API_URL}/posts/feed`);
    (page().querySelector('.likes button') as HTMLButtonElement).click();
    requests.expectOne(`${API_URL}/posts/10/likes`).flush({}, { status: 404, statusText: 'Not found' });
    expect(page().querySelector('article')).toBeNull();
    oldFeed.flush([post]);
    expect(page().querySelector('article')).toBeNull();
    expect(page().textContent).toContain('no longer available');
  });

  it('retains a comment draft when refreshing a feed that still contains that post', () => {
    load();
    const draft = page().querySelector('textarea')!;
    draft.value = 'My draft'; draft.dispatchEvent(new Event('input'));
    fixture.componentInstance.loadFeed();
    requests.expectOne(`${API_URL}/posts/feed`).flush([{ ...post, title: 'Updated title' }]);
    expect(page().querySelector('textarea')?.value).toBe('My draft');
    requests.expectNone(request => request.url.includes('/10/'));
  });
});
