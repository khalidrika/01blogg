import { Component, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-profile',
  imports: [CommonModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile implements OnInit {

  profile = signal<any>(null);

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    const userId = Number(
      this.route.snapshot.paramMap.get('id')
    );

    this.http
      .get(`http://localhost:8080/api/users/${userId}`)
      .subscribe({
        next: (response) => {
          console.log('PROFILE:', response);
          this.profile.set(response);
        },
        error: (error) => {
          console.log('PROFILE ERROR:', error);
        }
      });
  }
}