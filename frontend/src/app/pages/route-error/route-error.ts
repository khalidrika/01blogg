import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-route-error',
  imports: [RouterLink],
  template: `<main><h1>{{ title }}</h1><p>{{ message }}</p><a routerLink="/feed">Go to home</a></main>`
})
export class RouteError {
  private route = inject(ActivatedRoute);
  title = this.route.snapshot.data['title'];
  message = this.route.snapshot.data['message'];
}
