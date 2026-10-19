import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MyPosts } from './my-posts';
import { API_URL } from '../../core/auth/auth.service';
import { InteractionService } from '../../core/services/interaction.service';
import { of } from 'rxjs';

const post = { id: 10, title: 'My post', content: 'Text', authorid: 1, authorusername: 'student',
  createdAt: '2026-10-19T10:00:00', mediaUrl: null, mediaType: null };

describe('MyPosts management', () => {
  let fixture: ComponentFixture<MyPosts>;
  let requests: HttpTestingController;

  beforeEach(async () => {
    localStorage.setItem('userId', '1');
    TestBed.configureTestingModule({ imports: [MyPosts], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      // Keep CRUD tests focused; real interaction requests are covered in the page integration suite.
      { provide: InteractionService, useValue: { getLikes: () => of({ liked: false, count: 0 }), getComments: () => of([]) } }
    ] });
    requests = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyPosts);
    await fixture.whenStable();
  });
  afterEach(() => { fixture.destroy(); requests.verify(); localStorage.removeItem('userId'); });
  function page(): HTMLElement { fixture.detectChanges(); return fixture.nativeElement; }

  it('shows edit and delete actions only on the user’s own posts', () => {
    requests.expectOne(`${API_URL}/users/1/posts`).flush([post, { ...post, id: 20, authorid: 2 }]);
    expect(page().querySelector('a[href="/posts/10/edit"]')).not.toBeNull();
    expect(page().querySelector('a[href="/posts/20/edit"]')).toBeNull();
    expect(page().querySelectorAll('app-delete-post').length).toBe(1);
  });

  it('removes a deleted post and shows the empty state after deleting the last one', () => {
    requests.expectOne(`${API_URL}/users/1/posts`).flush([post]);
    (page().querySelector('app-delete-post button') as HTMLButtonElement).click();
    requests.expectNone(`${API_URL}/posts/10`);
    const confirm = Array.from(page().querySelectorAll('app-delete-post button'))
      .find(button => button.textContent?.trim() === 'Delete post') as HTMLButtonElement;
    confirm.click();
    const deletion = requests.expectOne(`${API_URL}/posts/10`);
    expect(page().querySelectorAll('article').length).toBe(1);
    deletion.flush(null, { status: 204, statusText: 'No Content' });
    expect(page().querySelectorAll('article').length).toBe(0);
    expect(page().textContent).toContain('Post deleted successfully.');
    expect(page().textContent).toContain('You have not published any posts yet.');
  });

  it('can cancel the deletion without changing the list', () => {
    requests.expectOne(`${API_URL}/users/1/posts`).flush([post]);
    (page().querySelector('app-delete-post button') as HTMLButtonElement).click();
    const cancel = Array.from(page().querySelectorAll('app-delete-post button'))
      .find(button => button.textContent?.trim() === 'Cancel') as HTMLButtonElement;
    cancel.click();
    requests.expectNone(`${API_URL}/posts/10`);
    expect(page().querySelectorAll('article').length).toBe(1);
  });

  it('shows a failed load and supports retry', () => {
    requests.expectOne(`${API_URL}/users/1/posts`).flush({}, { status: 500, statusText: 'Error' });
    expect(page().textContent).toContain('Could not load your posts.');
    const retry = Array.from(page().querySelectorAll('button')).find(button => button.textContent?.trim() === 'Retry')!;
    retry.click();
    requests.expectOne(`${API_URL}/users/1/posts`).flush([post]);
    expect(page().querySelectorAll('article').length).toBe(1);
    expect(page().textContent).not.toContain('Could not load your posts.');
  });
});
