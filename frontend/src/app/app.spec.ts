import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';

@Component({ template: '<h1>Learning feed</h1>' })
class TestPage {}

describe('Application routing', () => {
  it('renders the selected route inside the app', async () => {
    TestBed.configureTestingModule({ imports: [App], providers: [
      provideRouter([{ path: 'feed', component: TestPage }])
    ] });
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/feed');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toBe('Learning feed');
  });
});
