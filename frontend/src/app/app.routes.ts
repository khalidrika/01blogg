import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Feed } from './pages/feed/feed';
import { Notifications } from './pages/notifications/notifications';
import { Profile } from './pages/profile/profile';
import { Admin } from './pages/admin/admin';
import { MyPosts } from './pages/my-posts/my-posts';
import { CreatePost } from './pages/create-post/create-post';
import { EditPost } from './pages/edit-post/edit-post';
import { DiscoverUsers } from './discover-users/discover-users';

import { Register } from './pages/register/register';
import { RouteError } from './pages/route-error/route-error';
import { authGuard, adminGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: '', pathMatch: 'full', redirectTo: 'feed' },
  { path: 'feed', component: Feed, canActivate: [authGuard] },
  { path: 'notifications', component: Notifications, canActivate: [authGuard] },
  { path: 'profile/:id', component: Profile, canActivate: [authGuard] },
  { path: 'admin', component: Admin, canActivate: [adminGuard] },
  { path: 'my-posts', component: MyPosts, canActivate: [authGuard] },
  { path: 'create-post', component: CreatePost, canActivate: [authGuard] },
  { path: 'posts/:id/edit', component: EditPost, canActivate: [authGuard] },
  { path: 'discover', component: DiscoverUsers, canActivate: [authGuard] },
  { path: 'forbidden', component: RouteError, data: { title: 'Access denied', message: 'You do not have permission to view this page.' } },
  { path: '**', component: RouteError, data: { title: 'Page not found', message: 'The page you requested does not exist.' } },
];
