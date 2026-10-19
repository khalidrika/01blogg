import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DeletePost } from './delete-post';
import { API_URL } from '../../core/auth/auth.service';

const post = { id: 10, authorid: 1, title: 'My post', content: 'Text', authorusername: 'student',
  mediaUrl: null, mediaType: null, createdAt: '2026-10-19T10:00:00' };

describe('Delete post confirmation', () => {
  let fixture: ComponentFixture<DeletePost>;
  let requests: HttpTestingController;
  beforeEach(() => {
    localStorage.setItem('userId', '1');
    TestBed.configureTestingModule({ imports: [DeletePost], providers: [
      provideHttpClient(), provideHttpClientTesting()
    ] });
    requests = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DeletePost);
    fixture.componentRef.setInput('post', post);
    fixture.detectChanges();
  });
  afterEach(() => { fixture.destroy(); requests.verify(); localStorage.removeItem('userId'); });

  function click(text: string) {
    fixture.detectChanges();
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    buttons.find(button => button.textContent?.trim() === text)!.click();
    fixture.detectChanges();
  }

  it('requires confirmation and lets the user cancel without an API request', () => {
    click('Delete');
    expect(fixture.nativeElement.textContent).toContain('My post');
    requests.expectNone(`${API_URL}/posts/10`);
    click('Cancel');
    expect(fixture.componentInstance.confirming()).toBe(false);
    requests.expectNone(`${API_URL}/posts/10`);
  });

  it('sends one DELETE and emits success only after the server responds', () => {
    const removed = vi.fn(); fixture.componentInstance.removed.subscribe(removed);
    click('Delete'); click('Delete post');
    fixture.componentInstance.confirmDelete();
    const request = requests.expectOne(`${API_URL}/posts/10`);
    expect(request.request.method).toBe('DELETE');
    expect(removed).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Deleting...');
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(removed).toHaveBeenCalledWith({ id: 10, message: 'Post deleted successfully.' });
  });

  it('keeps the post on failure and permits a retry', () => {
    const removed = vi.fn(); fixture.componentInstance.removed.subscribe(removed);
    click('Delete'); click('Delete post');
    requests.expectOne(`${API_URL}/posts/10`).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(removed).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Could not delete');
    click('Delete post');
    requests.expectOne(`${API_URL}/posts/10`).flush(null, { status: 204, statusText: 'No Content' });
    expect(removed).toHaveBeenCalledOnce();
  });

  it('shows a permission error without removing the post', () => {
    const removed = vi.fn(); fixture.componentInstance.removed.subscribe(removed);
    click('Delete'); click('Delete post');
    requests.expectOne(`${API_URL}/posts/10`).flush({}, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('permission');
    expect(removed).not.toHaveBeenCalled();
  });

  it('removes a stale post that the server says no longer exists', () => {
    const removed = vi.fn(); fixture.componentInstance.removed.subscribe(removed);
    click('Delete'); click('Delete post');
    requests.expectOne(`${API_URL}/posts/10`).flush({}, { status: 404, statusText: 'Not Found' });
    expect(removed).toHaveBeenCalledWith({ id: 10, message: 'This post was already deleted.' });
  });

  it('does not submit without confirmation or for a different owner', () => {
    fixture.componentInstance.confirmDelete();
    requests.expectNone(`${API_URL}/posts/10`);
    fixture.componentRef.setInput('post', { ...post, authorid: 2 });
    click('Delete');
    expect(fixture.componentInstance.confirming()).toBe(false);
    fixture.componentInstance.confirmDelete();
    requests.expectNone(`${API_URL}/posts/10`);
  });

  it('cancels the subscription when the component leaves the page', () => {
    click('Delete'); click('Delete post');
    const request = requests.expectOne(`${API_URL}/posts/10`);
    fixture.destroy();
    expect(request.cancelled).toBe(true);
  });
});
