import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Profile } from './profile';
import { API_URL } from '../../core/auth/auth.service';

describe('Profile reporting', () => {
  let requests: HttpTestingController;
  let harness: RouterTestingHarness;
  let component: Profile;
  beforeEach(async () => {
    localStorage.setItem('userId', '1');
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      provideRouter([{ path: 'profile/:id', component: Profile }])
    ] });
    requests = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create('/profile/2');
    component = harness.routeDebugElement!.componentInstance as Profile;
    loadProfile(2);
  });
  afterEach(() => { requests.verify(); localStorage.removeItem('userId'); });

  function loadProfile(id: number): void {
    requests.expectOne(`${API_URL}/users/${id}`).flush({ id, username: `student${id}`, email: 'student@example.com',
      role: 'USER', followersCount: 0, followingCount: 0 });
    requests.expectOne(`${API_URL}/users/${id}/posts`).flush([]);
    if (id !== 1) requests.expectOne(`${API_URL}/users/${id}/follow`).flush({ following: false, followersCount: 0 });
  }
  function page(): HTMLElement { harness.detectChanges(); return harness.routeNativeElement!; }
  function button(label: string): HTMLButtonElement {
    return Array.from(page().querySelectorAll<HTMLButtonElement>('.report-form button')).find(item => item.textContent?.trim() === label)!;
  }
  function writeReason(reason: string): void {
    const field = page().querySelector<HTMLTextAreaElement>('#report-reason')!;
    field.value = reason; field.dispatchEvent(new Event('input'));
  }

  it('reviews the user and exact trimmed reason before sending any request', () => {
    writeReason('  Offensive comments on my posts  ');
    button('Report').click();
    requests.expectNone(request => request.method === 'POST');
    expect(page().querySelector('#report-confirm-title')?.textContent).toBe('Report student2?');
    expect(page().querySelector('blockquote')?.textContent).toBe('Offensive comments on my posts');
    expect(page().querySelector<HTMLTextAreaElement>('#report-reason')?.readOnly).toBe(true);
    button('Confirm report').click();
    const report = requests.expectOne(`${API_URL}/users/2/report`);
    expect(report.request.method).toBe('POST');
    expect(report.request.body).toEqual({ reason: 'Offensive comments on my posts' });
    report.flush(null, { status: 204, statusText: 'No Content' });
    expect(page().textContent).toContain('Report sent. An administrator will review it.');
    expect(component.reportReason()).toBe('');
    expect(page().querySelector('.report-confirmation')).toBeNull();
  });

  it('cancels without sending and keeps the draft editable', () => {
    writeReason('Inappropriate content'); button('Report').click(); button('Cancel').click();
    requests.expectNone(request => request.method === 'POST');
    expect(page().querySelector<HTMLTextAreaElement>('#report-reason')?.readOnly).toBe(false);
    expect(component.reportReason()).toBe('Inappropriate content');
    component.confirmReport();
    requests.expectNone(request => request.method === 'POST');
  });

  it.each(['', '   ', 'a'.repeat(256)])('rejects an invalid reason without opening confirmation: %s', reason => {
    writeReason(reason); button('Report').click();
    expect(page().querySelector('.report-form [role="alert"]')).not.toBeNull();
    expect(page().querySelector('.report-confirmation')).toBeNull();
    requests.expectNone(request => request.method === 'POST');
  });

  it('requires confirmation and sends once even with repeated clicks', () => {
    writeReason('Spam'); component.confirmReport();
    requests.expectNone(request => request.method === 'POST');
    button('Report').click(); button('Confirm report').click();
    component.confirmReport(); component.cancelReport();
    expect(button('Sending...').disabled).toBe(true);
    expect(button('Cancel').disabled).toBe(true);
    requests.expectOne(`${API_URL}/users/2/report`).flush(null);
  });

  it('preserves the confirmed reason on failure and allows a deliberate retry', () => {
    writeReason('Spam'); button('Report').click(); button('Confirm report').click();
    requests.expectOne(`${API_URL}/users/2/report`).flush({}, { status: 500, statusText: 'Error' });
    expect(page().textContent).toContain('Could not send your report.');
    expect(component.reportReason()).toBe('Spam');
    expect(button('Confirm report').disabled).toBe(false);
    button('Confirm report').click();
    const retry = requests.expectOne(`${API_URL}/users/2/report`);
    expect(retry.request.body).toEqual({ reason: 'Spam' });
    retry.flush(null);
    expect(page().querySelector('.report-form [role="alert"]')).toBeNull();
  });

  it.each([
    [400, 'Your report was not accepted. Please check the reason.'],
    [403, 'You do not have permission to report this user.'],
    [404, 'This user no longer exists.']
  ])('explains a rejected report with status %s', (status, message) => {
    writeReason('Spam'); button('Report').click(); button('Confirm report').click();
    requests.expectOne(`${API_URL}/users/2/report`).flush({}, { status, statusText: 'Error' });
    expect(page().querySelector('.report-form [role="alert"]')?.textContent).toBe(message);
  });

  it('hides reporting on the signed-in profile and rejects direct self-report calls', async () => {
    await harness.navigateByUrl('/profile/1', Profile); loadProfile(1);
    expect(page().querySelector('.report-form')).toBeNull();
    component.reportReason.set('Reason'); component.reportUser(); component.confirmReport();
    expect(component.reportConfirmation()).toBeNull();
    requests.expectNone(request => request.method === 'POST');
  });

  it('clears confirmation when the route changes so a draft cannot report the wrong user', async () => {
    writeReason('About student2'); button('Report').click();
    await harness.navigateByUrl('/profile/3', Profile); loadProfile(3);
    expect(component.reportConfirmation()).toBeNull();
    expect(component.reportReason()).toBe('');
    component.confirmReport();
    requests.expectNone(request => request.method === 'POST');
  });

  it('cancels a pending report subscription when changing profiles', async () => {
    writeReason('Spam'); button('Report').click(); button('Confirm report').click();
    const pending = requests.expectOne(`${API_URL}/users/2/report`);
    await harness.navigateByUrl('/profile/3', Profile); loadProfile(3);
    expect(pending.cancelled).toBe(true);
    expect(component.reporting()).toBe(false);
    expect(component.reportStatus()).toBe('');
  });

  it('renders a reason as text, including markup, in the confirmation', () => {
    writeReason('<img src=x onerror=alert(1)>'); button('Report').click();
    expect(page().querySelector('blockquote img')).toBeNull();
    expect(page().querySelector('blockquote')?.textContent).toContain('<img src=x');
  });
});
