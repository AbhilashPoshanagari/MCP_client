import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
// import { API_URLS } from '../constants/apiUrls';
import { StorageService } from './storage.service';

interface User {
  id: number;
  username: string;
  email: string;
  is_online: boolean;
  call_status: string;
  last_login: string;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // private readonly API_URL = 'http://10.89.47.181:8100/api';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private tokenSubject = new BehaviorSubject<string | null>(null);

  currentUser$ = this.currentUserSubject.asObservable();
  token$ = this.tokenSubject.asObservable();
  serverUrl: string = '';
  constructor(private http: HttpClient, private storageService: StorageService,
    private router: Router) {
    this.loadStoredAuth();
    this.serverUrl = this.storageService.getValueFromKey('media_server') || "";
    this.setApiUrl();
  }

  setApiUrl(apiUrl?: string): void {
    this.serverUrl = apiUrl || this.storageService.getValueFromKey('media_server') || "";
  }

  private loadStoredAuth(): void {
    const token = localStorage.getItem('access_token');
    const userStr = localStorage.getItem('current_user');
    
    if (token && userStr) {
      this.tokenSubject.next(token);
      this.currentUserSubject.next(JSON.parse(userStr));
    }
  }

  register(username: string, email: string, password: string): Observable<User> {
    return this.http.post<User>(`${this.serverUrl}/api/auth/register`, {
      username,
      email,
      password
    });
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.serverUrl}/api/auth/login`, {
      username,
      password
    }).pipe(
      tap(response => {
        localStorage.setItem('access_token', response.access_token);
        localStorage.setItem('current_user', JSON.stringify(response.user));
        this.tokenSubject.next(response.access_token);
        this.currentUserSubject.next(response.user);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('current_user');
    this.tokenSubject.next(null);
    this.currentUserSubject.next(null);
    
    // Call logout API
    this.http.post(`${this.serverUrl}/api/auth/logout`, {}).subscribe();
    
    this.router.navigate(['/']);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getToken(): string | null {
    return this.tokenSubject.value;
  }

  isAuthenticated(): boolean {
    return !!this.tokenSubject.value;
  }

  updateUserStatus(status: { call_status?: string; is_online?: boolean }): Observable<any> {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    };
    return this.http.post(`${this.serverUrl}/api/users/status`, status, { headers });
  }

  searchUsers(query: string): Observable<User[]> {
    return this.http.get<User[]>(`${this.serverUrl}/api/users/search?query=${query}`);
  }

  getUserDetailsByUsername(username: string): Observable<User> {
    return this.http.get<User>(`${this.serverUrl}/api/auth/${username}`);
  }

  getOnlineUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.serverUrl}/api/users/online`);
  }

  updateUserOnlineStatus(isOnline: boolean, callStatus: string): void {
    const currentUser = this.currentUserSubject.value;
    if (currentUser) {
      this.updateUserStatus({ is_online: isOnline, call_status: callStatus }).subscribe();
    }
  }
}