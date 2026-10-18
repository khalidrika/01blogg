import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {

  email = '';
  password = '';
  constructor(
    private http: HttpClient,
    private router: Router
  ) { }
  login() {

    const body = {
      email: this.email,
      password: this.password
    };

    this.http.post(
      'http://localhost:8080/api/login',
      body
    ).subscribe({
      next: (response: any) => {
        console.log('LOGIN SUCCESS:', response);

        localStorage.setItem('token', response.token);
        localStorage.setItem('userId', response.id.toString());
        this.router.navigate(['/feed']);

      },
      error: (error) => {
        console.log('LOGIN ERROR:', error);
      }
    });
  }
}