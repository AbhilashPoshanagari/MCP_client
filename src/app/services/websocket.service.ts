import { Injectable } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Observable, Subject, timer } from 'rxjs';
import { AuthService } from './auth.service';
// import { API_URLS } from '../constants/apiUrls';
import { StorageService } from './storage.service';
export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket$: WebSocketSubject<any> | null = null;
  public messagesSubject = new Subject<WebSocketMessage>();
  // private readonly WS_URL = 'ws://10.89.47.181:8100/ws';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private webSocketServerUrl: string = '';
  private manuallyClosed = false;
  private socketSubscription: any;
  constructor(private authService: AuthService,
    private storageService: StorageService
  ) {
    this.webSocketServerUrl = this.storageService.getValueFromKey('web_socket_server') || "";
  }

  getWebSocketServerUrl(): string {
    this.webSocketServerUrl = this.storageService.getValueFromKey('web_socket_server') || "";
    return this.webSocketServerUrl;
  }

  connect(roomId: string): void {
    // if (this.socket$ && !this.socket$.closed) {
    //   return;
    // }

    const token = this.authService.getToken();
    if (!token) {
      console.error('No authentication token available');
      return;
    }

    const url = `${this.webSocketServerUrl}/${roomId}?token=${token}`;
    this.socket$ = webSocket(url);

    this.socketSubscription = this.socket$.subscribe({
      next: (message) => {
        // console.log('Received WebSocket message:', message);
        this.messagesSubject.next(message);
      },
      error: (error) => {
        console.error('WebSocket error:', error);
        // this.handleReconnection(roomId);
        if (!this.manuallyClosed) {
          this.handleReconnection(roomId);
        }
      },
      complete: () => {
        console.log('WebSocket connection closed');
        // this.handleReconnection(roomId);
        if (!this.manuallyClosed) {
          this.handleReconnection(roomId);
        }
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
      console.log("send socket message : ", message);
      this.socket$.next(message);
    } else {
      console.error('WebSocket not connected');
    }
  }

  onMessage(): Observable<WebSocketMessage> {
    return this.messagesSubject.asObservable();
  }

  disconnect(): void {
      this.manuallyClosed = true; 
    if (this.socketSubscription) {
        this.socketSubscription.unsubscribe();
      }
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