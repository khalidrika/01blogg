import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../core/services/notification.service';
import { Navbar } from '../../shared/navbar/navbar';

@Component({
  selector: 'app-notifications',
  imports: [CommonModule, Navbar],
  templateUrl: './notifications.html',
  styleUrl: './notifications.css'
})
export class Notifications implements OnInit {
  readonly store = inject(NotificationService);

  ngOnInit(): void {
    this.store.load();
  }
}
