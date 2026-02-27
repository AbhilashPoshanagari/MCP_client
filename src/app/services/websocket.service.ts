import { Injectable } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Observable, Subject, timer } from 'rxjs';
import { AuthService } from './auth.service';
import { API_URLS } from '../constants/apiUrls';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket$: WebSocketSubject<any> | null = null;
  private messagesSubject = new Subject<WebSocketMessage>();
  // private readonly WS_URL = 'ws://10.89.47.181:8100/ws';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(private authService: AuthService) {}

  connect(roomId: string): void {
    if (this.socket$ && !this.socket$.closed) {
      return;
    }

    const token = this.authService.getToken();
    if (!token) {
      console.error('No authentication token available');
      return;
    }

    const url = `${API_URLS.WEB_SOCKET_URL}/${roomId}?token=${token}`;
    // const url = `${API_URLS.WEB_SOCKET_URL}/${roomId}`;
    this.socket$ = webSocket(url);

    this.socket$.subscribe({
      next: (message) => this.messagesSubject.next(message),
      error: (error) => {
        console.error('WebSocket error:', error);
        this.handleReconnection(roomId);
      },
      complete: () => {
        console.log('WebSocket connection closed');
        this.handleReconnection(roomId);
      }
    });
  }

  private handleReconnection(roomId: string): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);
      
      timer(delay).subscribe(() => {
        this.connect(roomId);
      });
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  send(message: WebSocketMessage): void {
    if (this.socket$ && !this.socket$.closed) {
      console.log("socket message : ", message);
      this.socket$.next(message);
    } else {
      console.error('WebSocket not connected');
    }
  }

  onMessage(): Observable<WebSocketMessage> {
    return this.messagesSubject.asObservable();
  }

  disconnect(): void {
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = null;
    }
    this.reconnectAttempts = 0;
  }

  isConnected(): boolean {
    return !!this.socket$ && !this.socket$.closed;
  }
}