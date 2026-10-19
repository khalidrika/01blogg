import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Register } from './register';
import { API_URL } from '../../core/auth/auth.service';

describe('Register', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Register], providers: [
    provideHttpClient(), provideHttpClientTesting(), provideRouter([])
  ] }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function form() {
    const register = TestBed.createComponent(Register).componentInstance;
    register.username = 'student'; register.email = 'student@example.com';
    register.password = 'secret123'; register.confirmPassword = 'secret123';
    return register;
  }
  it('does not submit mismatched passwords', () => {
    const register = form(); register.confirmPassword = 'different'; register.register();
    expect(register.error()).toBe('Passwords do not match.');
    TestBed.inject(HttpTestingController).expectNone(`${API_URL}/register`);
  });
  it('redirects to login after successful registration', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const register = form(); register.register(); register.register();
    TestBed.inject(HttpTestingController).expectOne(`${API_URL}/register`).flush({ id: 1 });
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { registered: true } });
    expect(register.pending()).toBe(false);
    expect(register.password).toBe('');
  });
  it('shows duplicate username errors', () => {
    const register = form(); register.register();
    TestBed.inject(HttpTestingController).expectOne(`${API_URL}/register`).flush(
      { message: 'Username is already in use' }, { status: 400, statusText: 'Bad Request' });
    expect(register.error()).toBe('Username is already in use');
    expect(register.pending()).toBe(false);
  });
});
