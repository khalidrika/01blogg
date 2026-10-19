import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Admin } from './admin';
import { API_URL } from '../../core/auth/auth.service';

const endpoint = `${API_URL}/admin`;
const users = [
  { id: 1, username: 'admin', email: 'admin@example.com', role: 'ADMIN', banned: false },
  { id: 2, username: 'student2', email: 'student2@example.com', role: 'USER', banned: false },
  { id: 3, username: 'student3', email: 'student3@example.com', role: 'USER', banned: false }
];
const posts = [2, 3].map((id, i) => ({ id: 10 + i, title: `Post by ${id}`, content: 'Learning Angular',
  authorid: id, authorusername: `student${id}`, mediaUrl: `/uploads/${id}`,
  mediaType: i ? 'video' : 'image', createdAt: '2026-10-19T10:00:00' }));
const reports = [[3, 2], [2, 3], [3, 3]].map(([from, to], i) => ({ id: 40 + i,
  reporterId: from, reporterUsername: `student${from}`, reportedUserId: to, reportedUsername: `student${to}`,
  reason: 'Offensive content', createdAt: '2026-10-19T10:00:00' }));

describe('Admin moderation dashboard', () => {
  let fixture: ComponentFixture<Admin>;
  let component: Admin;
  let requests: HttpTestingController;
  let dialog: HTMLDialogElement;
  beforeEach(async () => {
    localStorage.setItem('userId', '1'); localStorage.setItem('role', 'ADMIN');
    TestBed.configureTestingModule({ imports: [Admin], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([])
    ] });
    requests = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Admin);
    component = fixture.componentInstance;
    await fixture.whenStable();
    dialog = fixture.nativeElement.querySelector('dialog');
    // JSDOM does not emulate the browser's modal top layer or focus trapping.
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    dialog.close = vi.fn(() => dialog.removeAttribute('open'));
  });
  afterEach(() => {
    fixture.destroy(); requests.verify();
    localStorage.removeItem('userId'); localStorage.removeItem('role');
  });
  function page(): HTMLElement { fixture.detectChanges(); return fixture.nativeElement; }
  function load(banned = false): void {
    requests.expectOne(`${endpoint}/users`).flush(users.map(user => user.id === 2 ? { ...user, banned } : user));
    requests.expectOne(`${endpoint}/posts`).flush(posts);
    requests.expectOne(`${endpoint}/reports`).flush(reports);
  }
  function modalButton(text: string): HTMLButtonElement {
    return Array.from(page().querySelectorAll<HTMLButtonElement>('dialog button'))
      .find(button => button.textContent?.trim() === text)!;
  }
  function writes() { return requests.match(request => request.method !== 'GET'); }

  it('loads each section independently with navigation and no admin account controls', () => {
    expect(page().textContent).toContain('Loading users');
    load();
    expect(page().querySelectorAll('.user-card').length).toBe(3);
    expect(page().querySelector('[data-user-id="1"] button')).toBeNull();
    expect(page().querySelector('.section-nav button[aria-pressed="true"]')?.textContent).toContain('Users');
    component.selectSection('reports');
    expect(page().querySelectorAll('.report-card').length).toBe(3);
    expect(page().querySelector('time')?.getAttribute('datetime')).toBe('2026-10-19T10:00:00');
  });

  it.each(['ban', 'unban', 'delete-user', 'delete-post'] as const)('requires confirmation and supports cancellation for %s', kind => {
    load(kind === 'unban');
    if (kind === 'delete-post') component.requestPostDeletion(10);
    else component.requestUserAction(kind, 2);
    expect(dialog.open).toBe(true);
    expect(page().querySelector('#moderation-title')?.textContent).toContain(kind === 'delete-post' ? 'Post by 2' : 'student2');
    expect(writes()).toHaveLength(0);
    modalButton('Cancel').click();
    expect(dialog.open).toBe(false);
    component.confirmAction();
    expect(writes()).toHaveLength(0);
  });

  it('bans and unbans after confirmation and updates the saved state without reloading', () => {
    load(); component.requestUserAction('ban', 2); modalButton('Confirm').click();
    component.confirmAction(); component.cancelAction();
    expect(modalButton('Cancel').disabled).toBe(true);
    expect(component.findUser(2)?.banned).toBe(false);
    const ban = requests.expectOne(`${endpoint}/users/2/ban`);
    expect(ban.request.method).toBe('PUT'); ban.flush(null);
    expect(component.findUser(2)?.banned).toBe(true);
    expect(page().textContent).toContain('User banned.');
    expect(dialog.open).toBe(false);
    component.requestUserAction('unban', 2); modalButton('Confirm').click();
    requests.expectOne(`${endpoint}/users/2/unban`).flush(null);
    expect(component.findUser(2)?.banned).toBe(false);
    expect(page().textContent).toContain('User unbanned.');
    requests.expectNone(request => request.method === 'GET');
  });

  it('deletes a user and removes their posts and reports from all cached lists', () => {
    load(); component.requestUserAction('delete-user', 2); modalButton('Confirm').click();
    expect(component.users().length).toBe(3);
    const deletion = requests.expectOne(`${endpoint}/users/2`);
    expect(deletion.request.method).toBe('DELETE'); deletion.flush(null);
    expect(component.users().map(user => user.id)).toEqual([1, 3]);
    expect(component.posts().map(post => post.id)).toEqual([11]);
    expect(component.reports().map(report => report.id)).toEqual([42]);
    expect(page().textContent).toContain('User and related content deleted.');
  });

  it('previews media and removes a post only after confirmed deletion', () => {
    load(); component.selectSection('posts');
    expect(page().querySelector('img')?.getAttribute('src')).toBe('http://localhost:8080/uploads/2');
    expect(page().querySelector('video')?.hasAttribute('controls')).toBe(true);
    component.requestPostDeletion(10); modalButton('Confirm').click();
    expect(component.posts().length).toBe(2);
    const deletion = requests.expectOne(`${endpoint}/posts/10`);
    expect(deletion.request.method).toBe('DELETE'); deletion.flush(null);
    expect(page().querySelector('[data-post-id="10"]')).toBeNull();
    expect(component.posts().length).toBe(1);
  });

  it('allows moderation from a report and keeps every view in sync', () => {
    load(); component.selectSection('reports');
    const ban = Array.from(page().querySelectorAll<HTMLButtonElement>('[data-report-id="40"] button'))
      .find(button => button.textContent?.trim() === 'Ban')!;
    ban.click(); modalButton('Confirm').click();
    requests.expectOne(`${endpoint}/users/2/ban`).flush(null);
    expect(page().querySelector('[data-report-id="40"]')?.textContent).toContain('Banned');
    expect(page().querySelector('[data-report-id="40"]')?.textContent).toContain('Unban');
  });

  it('keeps data and confirmation on a failed action and supports retry', () => {
    load(); component.requestUserAction('delete-user', 2); modalButton('Confirm').click();
    requests.expectOne(`${endpoint}/users/2`).flush({}, { status: 500, statusText: 'Error' });
    expect(component.users().length).toBe(3);
    expect(component.posts().length).toBe(2);
    expect(component.reports().length).toBe(3);
    expect(dialog.open).toBe(true);
    expect(page().querySelector('dialog [role="alert"]')?.textContent).toContain('Could not complete this action.');
    expect(modalButton('Confirm').disabled).toBe(false);
    modalButton('Confirm').click();
    requests.expectOne(`${endpoint}/users/2`).flush(null);
    expect(dialog.open).toBe(false);
  });

  it.each([400, 403])('keeps the lists unchanged when an action is rejected with %s', status => {
    load(); component.requestUserAction('ban', 2); modalButton('Confirm').click();
    requests.expectOne(`${endpoint}/users/2/ban`).flush({ message: 'Administrator accounts cannot be moderated' }, { status, statusText: 'Error' });
    expect(component.findUser(2)?.banned).toBe(false);
    expect(page().querySelector('dialog [role="alert"]')?.textContent).toContain(status === 400 ? 'Administrator accounts' : 'permission');
  });

  it('removes stale user entries on a 404 without claiming the ban succeeded', () => {
    load(); component.requestUserAction('ban', 2); modalButton('Confirm').click();
    requests.expectOne(`${endpoint}/users/2/ban`).flush({}, { status: 404, statusText: 'Not found' });
    expect(component.findUser(2)).toBeUndefined();
    expect(component.posts().length).toBe(1);
    expect(component.status()).toContain('no longer exists');
    expect(component.status()).not.toContain('User banned.');
  });

  it('cancels old refreshes before a mutation and reloads the interrupted list afterwards', () => {
    load(); component.loadSection('users');
    const old = requests.expectOne(`${endpoint}/users`);
    component.requestUserAction('delete-user', 2); modalButton('Confirm').click();
    expect(old.cancelled).toBe(true);
    component.loadSection('users');
    requests.expectNone(`${endpoint}/users`);
    requests.expectOne(`${endpoint}/users/2`).flush(null);
    requests.expectOne(`${endpoint}/users`).flush(users.filter(user => user.id !== 2));
    expect(component.findUser(2)).toBeUndefined();
  });

  it('shows a section error with retry while other sections remain usable', () => {
    requests.expectOne(`${endpoint}/users`).flush({}, { status: 500, statusText: 'Error' });
    requests.expectOne(`${endpoint}/posts`).flush(posts);
    requests.expectOne(`${endpoint}/reports`).flush([]);
    expect(page().textContent).toContain('Could not load users.');
    expect(page().textContent).not.toContain('No users found.');
    component.selectSection('posts');
    expect(page().querySelectorAll('.post-card').length).toBe(2);
    component.selectSection('reports');
    expect(page().textContent).toContain('No reports found.');
    component.selectSection('users'); component.loadSection('users');
    requests.expectOne(`${endpoint}/users`).flush(users);
    expect(page().querySelectorAll('.user-card').length).toBe(3);
  });

  it('rejects admin account and unknown target actions in the component too', () => {
    load(); component.requestUserAction('ban', 1); component.requestUserAction('delete-user', 1);
    component.requestUserAction('delete-user', 999); component.requestPostDeletion(999); component.confirmAction();
    expect(dialog.open).toBe(false);
    expect(writes()).toHaveLength(0);
  });

  it('allows Escape to cancel, but keeps the modal open during submission', () => {
    load(); component.requestPostDeletion(10);
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(dialog.open).toBe(false);
    component.requestPostDeletion(10); modalButton('Confirm').click();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(dialog.open).toBe(true);
    requests.expectOne(`${endpoint}/posts/10`).flush(null);
  });

  it('cancels requests when leaving the dashboard', () => {
    const pendingUsers = requests.expectOne(`${endpoint}/users`);
    const pendingPosts = requests.expectOne(`${endpoint}/posts`);
    const pendingReports = requests.expectOne(`${endpoint}/reports`);
    fixture.destroy();
    expect([pendingUsers, pendingPosts, pendingReports].every(request => request.cancelled)).toBe(true);
  });
});
