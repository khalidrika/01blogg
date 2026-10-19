import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Login } from './login';
import { API_URL } from '../../core/auth/auth.service';

describe('Login', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [Login], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([])
    ] });
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); localStorage.clear(); });
  it('stores the session after successful login and navigates to the feed', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const login = TestBed.createComponent(Login).componentInstance;
    login.email = 'user@example.com'; login.password = 'secret123';
    login.login();
    login.login();
    const request = TestBed.inject(HttpTestingController).expectOne(`${API_URL}/login`);
    request.flush({ token: 'token', id: 5, role: 'USER' });
    expect(localStorage.getItem('userId')).toBe('5');
    expect(login.password).toBe('');
    expect(login.pending()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/feed');
  });
  it('shows the server error and re-enables submission', () => {
    const login = TestBed.createComponent(Login).componentInstance;
    login.email = 'user@example.com'; login.password = 'wrong';
    login.login();
    TestBed.inject(HttpTestingController).expectOne(`${API_URL}/login`).flush(
      { message: 'Invalid email or password' }, { status: 401, statusText: 'Unauthorized' });
    expect(login.error()).toBe('Invalid email or password');
    expect(login.pending()).toBe(false);
    expect(localStorage.getItem('token')).toBeNull();
  });
  it('never renders the password as plain text', async () => {
    const fixture = TestBed.createComponent(Login);
    fixture.componentInstance.password = 'very-private-password';
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain('very-private-password');
    expect(fixture.nativeElement.querySelector('#password').type).toBe('password');
  });
});
