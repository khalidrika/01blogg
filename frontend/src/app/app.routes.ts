import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Feed } from './pages/feed/feed';
import { Notifications } from './pages/notifications/notifications';
import { Profile } from './pages/profile/profile';



export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'feed', component: Feed },
  { path: 'notifications', component: Notifications },
  { path: 'profile/:id', component: Profile }


];