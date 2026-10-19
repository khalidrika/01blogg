import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { EditPost } from './edit-post';
import { API_URL } from '../../core/auth/auth.service';

const original = {
  id: 10, title: 'Original title', content: 'Original content', authorid: 1,
  authorusername: 'student', mediaUrl: '/uploads/original.png', mediaType: 'image',
  createdAt: '2026-10-19T10:00:00'
};

describe('Edit post', () => {
  let requests: HttpTestingController;
  let harness: RouterTestingHarness;
  let editor: EditPost;

  beforeEach(async () => {
    localStorage.setItem('userId', '1');
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      provideRouter([{ path: 'posts/:id/edit', component: EditPost }])
    ] });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:replacement');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    requests = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create('/posts/10/edit');
    editor = harness.routeDebugElement!.componentInstance;
  });
  afterEach(() => {
    harness.fixture.destroy();
    requests.verify();
    localStorage.removeItem('userId');
    vi.restoreAllMocks();
  });
  function load(overrides = {}) {
    requests.expectOne(`${API_URL}/posts/10`).flush({ ...original, ...overrides });
    harness.detectChanges();
  }
  function select(file: File) {
    const input = page().querySelector('#post-media') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change'));
    harness.detectChanges();
  }
  function page(): HTMLElement {
    harness.detectChanges();
    return harness.routeNativeElement!;
  }

  it('loads the original text and media into the form', () => {
    load();
    expect(editor.title).toBe('Original title');
    expect(editor.content).toBe('Original content');
    expect(page().querySelector('img')?.getAttribute('src')).toBe('http://localhost:8080/uploads/original.png');
    expect(page().querySelector('form')).not.toBeNull();
  });

  it('saves text without replacing existing media and prevents duplicate submissions', () => {
    load();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    editor.title = ' Updated title '; editor.content = ' Updated content ';
    editor.save(); editor.save();
    const request = requests.expectOne(`${API_URL}/posts/10`);
    expect(request.request.method).toBe('PUT');
    const body = request.request.body as FormData;
    expect(body.get('title')).toBe('Updated title');
    expect(body.get('content')).toBe('Updated content');
    expect(body.has('media')).toBe(false);
    expect(request.request.headers.has('Content-Type')).toBe(false);
    request.flush({ ...original, title: 'Updated title' });
    expect(navigate).toHaveBeenCalledWith(['/profile', 1], { queryParams: { updated: 'true' } });
  });

  it('previews a replacement video and includes it in the update', () => {
    load();
    select(new File(['video'], 'clip.mp4', { type: 'video/mp4' }));
    expect(page().querySelector('video')?.getAttribute('src')).toBe('blob:replacement');
    expect(page().querySelector('img')).toBeNull();
    editor.save();
    const request = requests.expectOne(`${API_URL}/posts/10`);
    expect((request.request.body.get('media') as File).name).toBe('clip.mp4');
    request.flush({}, { status: 500, statusText: 'Error' });
  });

  it('restores current media and releases the preview when replacement is cancelled', () => {
    load();
    select(new File(['image'], 'photo.jpg', { type: 'image/jpeg' }));
    editor.clearReplacement();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:replacement');
    expect(editor.selectedFile).toBeNull();
    expect(editor.previewUrl).toBe('http://localhost:8080/uploads/original.png');
  });

  it('rejects empty, invalid and oversized files before submitting', () => {
    load();
    select(new File(['script'], 'script.html', { type: 'text/html' }));
    expect(editor.fileError()).toContain('PNG');
    editor.save();
    requests.expectNone(request => request.method === 'PUT');
    select(new File([], 'empty.png', { type: 'image/png' }));
    expect(editor.fileError()).toContain('empty');
    const large = new File(['image'], 'large.png', { type: 'image/png' });
    Object.defineProperty(large, 'size', { value: 50 * 1024 * 1024 + 1 });
    select(large);
    expect(editor.fileError()).toContain('50 MB');
    expect(editor.selectedFile).toBeNull();
  });

  it('does not submit whitespace-only content', () => {
    load(); editor.content = '   '; editor.save();
    expect(editor.saveError()).toBe('Title and content are required.');
    requests.expectNone(request => request.method === 'PUT');
  });

  it('keeps edits and permits retry after a failed save', () => {
    load(); editor.title = 'My draft'; editor.save();
    requests.expectOne(`${API_URL}/posts/10`).flush({}, { status: 500, statusText: 'Error' });
    expect(editor.saving()).toBe(false);
    expect(editor.title).toBe('My draft');
    expect(page().textContent).toContain('Your edits are still here');
    editor.save();
    requests.expectOne(`${API_URL}/posts/10`).flush({}, { status: 413, statusText: 'Too Large' });
    expect(page().textContent).toContain('choose a smaller file');
  });

  it('does not expose an edit form for another user’s post', () => {
    load({ authorid: 2 });
    expect(page().textContent).toContain('You can only edit your own posts.');
    expect(page().querySelector('form')).toBeNull();
    editor.save();
    requests.expectNone(request => request.method === 'PUT');
  });

  it('shows a backend permission error without losing the draft', () => {
    load(); editor.title = 'My draft'; editor.save();
    requests.expectOne(`${API_URL}/posts/10`).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(page().textContent).toContain('permission');
    expect(editor.title).toBe('My draft');
    expect(editor.saving()).toBe(false);
  });

  it('handles missing posts', () => {
    requests.expectOne(`${API_URL}/posts/10`).flush({}, { status: 404, statusText: 'Not Found' });
    expect(page().textContent).toContain('Post not found.');
    expect(page().querySelector('form')).toBeNull();
    expect(editor.retryable()).toBe(false);
  });

  it('retries a failed load', () => {
    requests.expectOne(`${API_URL}/posts/10`).flush({}, { status: 500, statusText: 'Error' });
    expect(editor.retryable()).toBe(true);
    editor.loadPost(); load();
    expect(page().querySelector('form')).not.toBeNull();
  });

  it('cancels stale loads when the post id changes', async () => {
    const previous = requests.expectOne(`${API_URL}/posts/10`);
    await harness.navigateByUrl('/posts/11/edit', EditPost);
    expect(previous.cancelled).toBe(true);
    requests.expectOne(`${API_URL}/posts/11`).flush({ ...original, id: 11, title: 'Next post' });
    expect(editor.title).toBe('Next post');
  });

  it('rejects invalid post addresses without an API call', async () => {
    load();
    await harness.navigateByUrl('/posts/invalid/edit', EditPost);
    expect(page().textContent).toContain('Invalid post address.');
    requests.expectNone(request => request.url.startsWith(`${API_URL}/posts/`));
  });

  it('releases the replacement preview when leaving the page', () => {
    load(); select(new File(['image'], 'photo.png', { type: 'image/png' }));
    harness.fixture.destroy();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:replacement');
  });
});
