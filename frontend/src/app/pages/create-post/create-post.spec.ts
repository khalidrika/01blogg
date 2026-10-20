import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { CreatePost } from './create-post';
import { API_URL } from '../../core/auth/auth.service';

describe('Create post', () => {
  let fixture: ComponentFixture<CreatePost>;
  let component: CreatePost;
  let requests: HttpTestingController;
  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [CreatePost], providers: [
      provideRouter([]), provideHttpClient(), provideHttpClientTesting()
    ] });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    fixture = TestBed.createComponent(CreatePost);
    component = fixture.componentInstance;
    requests = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });
  afterEach(() => { fixture.destroy(); requests.verify(); vi.restoreAllMocks(); });
  function select(file: File) {
    const input = fixture.nativeElement.querySelector('#post-media') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change')); fixture.detectChanges();
  }
  it('previews media, sends trimmed multipart data once and opens the new profile', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    select(new File(['image'], 'photo.png', { type: 'image/png' }));
    expect(fixture.nativeElement.querySelector('img').src).toBe('blob:preview');
    component.title = ' Discovery '; component.content = ' My learning ';
    component.createPost(); component.createPost();
    const request = requests.expectOne(`${API_URL}/posts`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.get('title')).toBe('Discovery');
    expect(request.request.body.get('content')).toBe('My learning');
    expect(request.request.body.get('media').name).toBe('photo.png');
    expect(request.request.headers.has('Content-Type')).toBe(false);
    request.flush({ authorid: 7 });
    expect(navigate).toHaveBeenCalledWith(['/profile', 7], { queryParams: { created: 'true' } });
  });
  it('rejects blank or overlong posts before any request', () => {
    component.title = ' '; component.content = 'Text'; component.createPost();
    expect(component.error()).toContain('required');
    component.title = 'a'.repeat(256); component.createPost();
    expect(component.error()).toContain('255');
    requests.expectNone(`${API_URL}/posts`);
  });
  it('rejects invalid files and releases cancelled previews', () => {
    select(new File(['html'], 'a.html', { type: 'text/html' }));
    expect(component.fileError()).toContain('PNG');
    select(new File([], 'a.png', { type: 'image/png' }));
    expect(component.fileError()).toContain('empty');
    select(new File(['image'], 'a.png', { type: 'image/png' }));
    component.clearFile();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    expect(component.selectedFile).toBeNull();
  });
  it('keeps the draft and permits retry after the server rejects an upload', () => {
    component.title = 'Draft'; component.content = 'Unfinished lesson'; component.createPost();
    requests.expectOne(`${API_URL}/posts`).flush({}, { status: 413, statusText: 'Too Large' });
    expect(component.title).toBe('Draft');
    expect(component.saving()).toBe(false);
    expect(component.error()).toContain('smaller file');
    component.createPost();
    requests.expectOne(`${API_URL}/posts`).flush({ message: 'Invalid media' }, { status: 400, statusText: 'Bad Request' });
    expect(component.error()).toBe('Invalid media');
  });
});
