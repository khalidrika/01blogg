import { Component, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-notifications',
  imports: [CommonModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.css'
})
export class Notifications implements OnInit {

  notifications = signal<any[]>([]);

  constructor(private http: HttpClient) { }

  ngOnInit() {
    this.loadNotifications();
  }

  loadNotifications() {
    this.http
      .get<any[]>('http://localhost:8080/api/notifications')
      .subscribe({
        next: (response) => {
          this.notifications.set(response);
        },
        error: (error) => {
          console.log('NOTIFICATIONS ERROR:', error);
        }
      });
  }

  markAsRead(notificationId: number) {
    this.http
      .put(
        `http://localhost:8080/api/notifications/${notificationId}/read`,
        {}
      )
      .subscribe({
        next: () => {
          this.loadNotifications();
        },
        error: (error) => {
          console.log('MARK AS READ ERROR:', error);
        }
      });
  }
}