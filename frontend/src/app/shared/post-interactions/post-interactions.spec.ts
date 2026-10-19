import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PostInteractions } from './post-interactions';
import { API_URL } from '../../core/auth/auth.service';

const endpoint = `${API_URL}/posts/10`;
const comment = (id = 5, authorId = 1) => ({ id, authorId, authorUsername: 'student', postId: 10,
  content: 'Helpful post', createdAt: '2026-10-19T10:00:00' });

describe('Post likes and comments', () => {
  let fixture: ComponentFixture<PostInteractions>;
  let component: PostInteractions;
  let requests: HttpTestingController;
  beforeEach(async () => {
    localStorage.setItem('userId', '1');
    TestBed.configureTestingModule({ imports: [PostInteractions], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    requests = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PostInteractions);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('postId', 10);
    await fixture.whenStable();
  });
  afterEach(() => { fixture.destroy(); requests.verify(); localStorage.removeItem('userId'); });
  function page(): HTMLElement { fixture.detectChanges(); return fixture.nativeElement; }
  function load(liked = false): void {
    requests.expectOne(`${endpoint}/likes`).flush({ liked, count: 4 });
    requests.expectOne(`${endpoint}/comments`).flush([comment(), comment(6, 2)]);
  }
  function button(label: string): HTMLButtonElement {
    return Array.from(page().querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.trim() === label)!;
  }
  function draft(text: string): void {
    const field = page().querySelector('textarea')!;
    field.value = text; field.dispatchEvent(new Event('input'));
  }

  it('waits for status, then displays the saved like state, comments and timestamps', () => {
    expect(button('Like').disabled).toBe(true);
    load(true);
    expect(button('Unlike').getAttribute('aria-pressed')).toBe('true');
    expect(page().textContent).toContain('4 likes');
    expect(page().querySelectorAll('.comment').length).toBe(2);
    expect(page().querySelector('time')?.getAttribute('datetime')).toBe(comment().createdAt);
    expect(page().querySelector('[data-comment-id="6"] button')).toBeNull();
  });

  it('uses idempotent like/unlike requests and updates counts only on success', () => {
    load(); button('Like').click(); component.toggleLike();
    expect(component.likes()?.count).toBe(4);
    const like = requests.expectOne(`${endpoint}/likes`);
    expect(like.request.method).toBe('PUT'); like.flush({ liked: true, count: 8 });
    expect(page().textContent).toContain('8 likes');
    button('Unlike').click();
    const unlike = requests.expectOne(`${endpoint}/likes`);
    expect(unlike.request.method).toBe('DELETE'); unlike.flush({ liked: false, count: 7 });
    expect(page().textContent).toContain('7 likes');
    expect(button('Like').disabled).toBe(false);
  });

  it('keeps like state after failure and retries the same requested state', () => {
    load(); component.toggleLike();
    requests.expectOne(`${endpoint}/likes`).flush({}, { status: 500, statusText: 'Error' });
    expect(component.likes()).toEqual({ liked: false, count: 4 });
    expect(page().textContent).toContain('Could not update your like.');
    component.toggleLike();
    const retry = requests.expectOne(`${endpoint}/likes`);
    expect(retry.request.method).toBe('PUT'); retry.flush({ liked: true, count: 5 });
  });

  it('offers retry when initial likes and comments fail without inventing zero counts', () => {
    requests.expectOne(`${endpoint}/likes`).flush({}, { status: 500, statusText: 'Error' });
    requests.expectOne(`${endpoint}/comments`).flush({}, { status: 500, statusText: 'Error' });
    expect(page().textContent).not.toContain('0 likes');
    expect(page().textContent).not.toContain('No comments yet.');
    expect(button('Add comment').disabled).toBe(true);
    button('Refresh likes').click(); button('Refresh comments').click(); load();
    expect(button('Add comment').disabled).toBe(false);
  });

  it('appends the returned comment and clears its draft only after success', () => {
    load(); draft('  Thanks!  '); button('Add comment').click(); component.addComment();
    expect(page().querySelector('textarea')?.readOnly).toBe(true);
    expect(component.draft()).toBe('  Thanks!  ');
    const add = requests.expectOne(`${endpoint}/comments`);
    expect(add.request.method).toBe('POST'); expect(add.request.body).toEqual({ content: 'Thanks!' });
    add.flush({ ...comment(7), content: 'Thanks!' });
    expect(component.comments().length).toBe(3);
    expect(component.draft()).toBe('');
    expect(page().textContent).toContain('Comment added.');
    requests.expectNone(request => request.method === 'GET');
  });

  it.each(['', '   ', 'x'.repeat(256)])('rejects invalid comment text: %s', content => {
    load(); draft(content); button('Add comment').click();
    requests.expectNone(request => request.method === 'POST');
    expect(component.actionError()).toBeTruthy();
  });

  it('preserves the draft and list if adding fails', () => {
    load(); draft('Keep my text'); component.addComment();
    requests.expectOne(`${endpoint}/comments`).flush({}, { status: 500, statusText: 'Error' });
    expect(component.draft()).toBe('Keep my text');
    expect(component.comments().length).toBe(2);
    expect(component.writing()).toBe(false);
    expect(page().textContent).toContain('Your draft has been kept.');
  });

  it('requires confirmation for an owned comment and supports cancellation', () => {
    load(); component.confirmDelete(5);
    requests.expectNone(request => request.method === 'DELETE');
    button('Delete').click(); button('Cancel').click();
    requests.expectNone(request => request.method === 'DELETE');
    component.requestDelete(5); button('Delete comment').click(); component.confirmDelete(5);
    expect(component.comments().length).toBe(2);
    requests.expectOne(`${API_URL}/posts/comments/5`).flush(null);
    expect(component.comments().map(comment => comment.id)).toEqual([6]);
    expect(page().textContent).toContain('Comment deleted.');
  });

  it('rejects direct attempts to delete other users comments', () => {
    load(); component.requestDelete(6); component.confirmDelete(6);
    expect(component.deleteConfirmation()).toBeNull();
    requests.expectNone(request => request.method === 'DELETE');
  });

  it('retains comments after a forbidden deletion and explains the error', () => {
    load(); component.requestDelete(5); component.confirmDelete(5);
    requests.expectOne(`${API_URL}/posts/comments/5`).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(component.comments().length).toBe(2);
    expect(component.writing()).toBe(false);
    expect(page().textContent).toContain('You can only delete your own comments.');
  });

  it('removes a stale comment on 404 without treating the whole post as missing', () => {
    load(); const removed = vi.fn(); component.unavailable.subscribe(removed);
    component.requestDelete(5); component.confirmDelete(5);
    requests.expectOne(`${API_URL}/posts/comments/5`).flush({}, { status: 404, statusText: 'Not found' });
    expect(component.comments().length).toBe(1); expect(removed).not.toHaveBeenCalled();
  });

  it('notifies the feed when the post was deleted before a comment could be sent', () => {
    load(); const removed = vi.fn(); component.unavailable.subscribe(removed);
    draft('Hello'); component.addComment();
    requests.expectOne(`${endpoint}/comments`).flush({}, { status: 404, statusText: 'Not found' });
    expect(removed).toHaveBeenCalledWith(10);
  });

  it('cancels stale refreshes before writes so they cannot overwrite the saved changes', () => {
    load(); component.loadLikes(); component.loadComments();
    const oldLikes = requests.expectOne(`${endpoint}/likes`);
    const oldComments = requests.expectOne(`${endpoint}/comments`);
    component.toggleLike(); draft('Hello'); component.addComment();
    expect(oldLikes.cancelled).toBe(true); expect(oldComments.cancelled).toBe(true);
    component.loadLikes(); component.loadComments();
    requests.expectNone(request => request.method === 'GET');
    requests.expectOne(`${endpoint}/likes`).flush({ liked: true, count: 5 });
    requests.expectOne(`${endpoint}/comments`).flush(comment(7));
    expect(component.comments().length).toBe(3);
  });

  it('cancels requests and clears drafts when the component receives a different post', () => {
    const oldLikes = requests.expectOne(`${endpoint}/likes`);
    const oldComments = requests.expectOne(`${endpoint}/comments`);
    component.draft.set('Old draft'); fixture.componentRef.setInput('postId', 11); page();
    expect(oldLikes.cancelled).toBe(true); expect(oldComments.cancelled).toBe(true);
    expect(component.draft()).toBe('');
    requests.expectOne(`${API_URL}/posts/11/likes`).flush({ liked: false, count: 0 });
    requests.expectOne(`${API_URL}/posts/11/comments`).flush([]);
  });

  it('renders comment content as text', () => {
    requests.expectOne(`${endpoint}/likes`).flush({ liked: false, count: 0 });
    requests.expectOne(`${endpoint}/comments`).flush([{ ...comment(), content: '<img src=x onerror=alert(1)>' }]);
    expect(page().querySelector('.comment img')).toBeNull();
    expect(page().querySelector('.comment .content')?.textContent).toContain('<img');
  });
});
