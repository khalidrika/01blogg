import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { Navbar } from '../../shared/navbar/navbar';

@Component({
  selector: 'app-create-post',
  imports: [CommonModule, FormsModule, Navbar],
  templateUrl: './create-post.html',
  styleUrl: './create-post.css'
})
export class CreatePost {

  title = '';
  content = '';

  selectedFile: File | null = null;

  previewUrl: string | null = null;
  previewType: 'image' | 'video' | null = null;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    this.selectedFile = file;

    if (file.type.startsWith('image/')) {
      this.previewType = 'image';
    } else if (file.type.startsWith('video/')) {
      this.previewType = 'video';
    } else {
      this.previewType = null;
    }

    this.previewUrl = URL.createObjectURL(file);
  }

  createPost() {
    const formData = new FormData();

    formData.append('title', this.title);
    formData.append('content', this.content);

    if (this.selectedFile) {
      formData.append('media', this.selectedFile);
    }

    this.http
      .post(
        'http://localhost:8080/api/posts',
        formData
      )
      .subscribe({
        next: () => {
          this.router.navigate(['/feed']);
        },
        error: (error) => {
          console.log('CREATE POST ERROR:', error);
        }
      });
  }
}