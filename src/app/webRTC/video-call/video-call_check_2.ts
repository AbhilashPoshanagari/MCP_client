import { Component, OnInit, OnDestroy, NgZone, ViewChild, ElementRef, Input, Output, EventEmitter, ViewChildren, QueryList, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { WebSocketService } from '../../services/websocket.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LoginModalComponent } from '../../components/login-modal/login-modal.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
// import { API_URLS } from '../../constants/apiUrls';
import { StorageService } from '../../services/storage.service';
// import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

interface CallUser {
  id: string;
  name: string;
  isSharingScreen?: boolean;
  isMuted?: boolean;
}

interface CallState {
  isInCall: boolean;
  remoteUserId: string | null;
  remoteUserName: string | null;
}

@Component({
  selector: 'app-video-call',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule
    ],
  templateUrl: './video-call.component.html',
  styleUrls: ['./video-call.component.css']
})
export class VideoCallComponent implements OnInit, OnDestroy, AfterViewInit {
 @ViewChild('localVideo', { static: false }) localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo', { static: false }) remoteVideo!: ElementRef<HTMLVideoElement>;

  @Input() userId: string = "";
  @Input() roomId: string = 'room';
  @Output() callEnded = new EventEmitter<void>();
  // User info
  currentUser: any; 
  targetUserName: string = '';
  targetUserId: string = '';

  // Call state
  isInCall: boolean = false;
  incomingCallInfo: { senderId: string; senderName: string; } | null = null;
  remoteUserName: string | null = null;
  
  // WebRTC
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private wsSubscription?: Subscription;
  
  // STUN servers
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];
  private serverUrl: string = '';
  constructor(
    private websocketService: WebSocketService,
    private authService: AuthService,
    private dialog: MatDialog,
    private storageService: StorageService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.serverUrl = this.storageService.getValueFromKey('web_socket_server') || "";
    this.currentUser = this.authService.getCurrentUser() || null;
    if (this.currentUser) {
      console.log('Current user:', this.currentUser);
      this.connectWebSocket();
    }
  }

  ngAfterViewInit() {
    // Video elements are now available, but we will set their srcObject when we get the streams  
    // this.startCamera();
  }

  ngOnDestroy() {
    this.endCall();
    this.wsSubscription?.unsubscribe();
    this.stopDetection();
    this.websocketService.disconnect();
  }

  promptLogin(): void {
    console.log('Opening login dialog...'); // Add debug log
    
    const dialogRef = this.dialog.open(LoginModalComponent, {
      width: '400px',
      disableClose: true,
      // Add these options to help with debugging
      panelClass: 'login-dialog-panel',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop'
    });

    dialogRef.afterClosed().subscribe({
      next: (user: any) => {
        console.log('Dialog closed with user:', user); // Add debug log
        if (user) {
          this.ngZone.run(() => {
          this.currentUser = user.username;
          console.log('Logged in user:', this.currentUser);
          this.connectWebSocket();
          this.authService.updateUserOnlineStatus(true, "not available");
          this.cdr.detectChanges(); // Trigger change detection
          });
        } else {
          console.log('No user returned from dialog'); // Add debug log
        }
      },
      error: (error: any) => {
        console.log("Error in login dialog: ", error); 
      }
    });
  }

  private connectWebSocket(): void {
    this.websocketService.connect(this.roomId + "-" + this.currentUser.username);
    this.setupWebSocketListeners();
  }

  private setupWebSocketListeners(): void {
      this.wsSubscription = this.websocketService.messagesSubject.subscribe({
      next: (message: any) => {
        console.log('Received WebSocket message in component:', message);
        switch (message.type) {
        case 'offer':
          console.log('Handling offer from:', message.sender);
          this.handleOffer(message.signal.offer, message.from_user_id, message.signal.sender_username);
          break;
        case 'answer':
          this.handleAnswer(message.answer);
          break;
        case 'ice-candidate':
          this.handleIceCandidate(message.candidate);
          break;
        case 'call-request':
          this.handleCallRequest(message.from_user_id, message.from_username);
          break;
          case 'call-response':
            if(message.accepted){
                this.ngZone.run(async () => {
                      this.isInCall = true;
                      console.log("message", message);
                      const targetUserId = message.from_user_id;
                      await this.createAndSendOffer(targetUserId);
                    });
            }else {
              console.log('Call rejected by target user');
            }
          break;
      }
      },
      error: (error) => {        console.error('WebSocket error in component:', error);
      }
      })

  }

  async startCall(): Promise<void> {
    try {
      // 2. Create local stream
      this.isInCall = true;
      await this.initializeLocalStream();
      // 1 & 3. Create peer connection and prepare offer
      await this.initializePeerConnection();
      
      this.websocketService.send({
        type: 'call-request',
        sender: this.currentUser.id,
        sender_username: this.currentUser.username,
        target: this.targetUserName,
        room_id: this.roomId
      });
    } catch (error) {
      console.error('Error starting call:', error);
    }
  }

  private async initializeLocalStream(): Promise<void> {
    this.ngZone.run(async () => {
      // this.isInCall = true;
      this.localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
        
        // Display local video
          const video = this.localVideo.nativeElement;
            video.srcObject = this.localStream;
            await video.play();
      });
  }

  

  private async initializePeerConnection(): Promise<void> {
    // 1. Create peer connection with STUN servers
    this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers });
    
    // Add local stream tracks to peer connection
    this.localStream?.getTracks().forEach(track => {
      this.peerConnection?.addTrack(track, this.localStream!);
    });

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Send ICE candidate to remote peer
        this.websocketService.send({
          type: 'ice-candidate',
          candidate: event.candidate,
          sender: this.currentUser.id,
          target: this.targetUserId
        });
      }
    };
          // Handle remote stream (processed video)
      this.peerConnection.ontrack = async (event) => {
        console.log("Remote track received");
        const processedVideo = this.remoteVideo.nativeElement;
        processedVideo.srcObject = event.streams[0];
        await processedVideo.play();
      };

    // Log connection state
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection?.connectionState);
    };
  }

  // 3. Create and send offer
  private async createAndSendOffer(targetuserId:string): Promise<void> {
    if (!this.peerConnection) return;
    
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    this.targetUserId = targetuserId;
    this.websocketService.send({
      type: 'offer',
      offer: offer,
      sender: this.currentUser.id,
      sender_username: this.currentUser.username,
      target: targetuserId
    });
  }

  // Handle incoming call request
  handleCallRequest(senderId: string, senderName: string): void {
    this.ngZone.run(() => {
      this.incomingCallInfo = { senderId, senderName };
    });
  }

  // Accept incoming call
  async acceptCall(): Promise<void> {
    if (!this.incomingCallInfo) return;
    
    this.isInCall = true;
    this.targetUserName = this.incomingCallInfo.senderName;
    this.targetUserId = this.incomingCallInfo.senderId;
    
    // 2. Initialize local stream
    await this.initializeLocalStream();
    
    // Initialize peer connection (will receive offer)
    await this.initializePeerConnection();
      this.websocketService.send({
        type: 'call-response',
        accepted: true,
        target: this.incomingCallInfo.senderId,
        from_user_id: this.currentUser.id,
        from_username: this.currentUser.username
      });
    this.incomingCallInfo = null;
  }

  async handleCallResponse(accepted: boolean, targetUserId: string): Promise<void> {
    if (accepted) {
      try {            
        // Create peer connection for the accepting user
        // Create and send offer
        await this.createAndSendOffer(targetUserId);
        
      } catch (error) {
        console.error('Error handling call response:', error);
        this.endCall();
      }
      
    }
  }

  // 4. Handle received offer and send answer
  async handleOffer(offer: RTCSessionDescriptionInit, senderId: string, senderName: string): Promise<void> {
    if (!this.peerConnection) {
      this.isInCall = true;
      this.targetUserName = senderName;
      this.targetUserId = senderId;
      await this.initializeLocalStream();
      await this.initializePeerConnection();
    }
    
    await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(offer));
    
    // Create and send answer
    const answer = await this.peerConnection?.createAnswer();
    await this.peerConnection?.setLocalDescription(answer);
    
    this.websocketService.send({
      type: 'answer',
      answer: answer,
      sender: this.currentUser.id,
      sender_username: this.currentUser.username,
      target: senderId
    });
  }

  // Handle received answer
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(answer));
    this.isInCall = true;
  }

  // Handle ICE candidate
  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    await this.peerConnection?.addIceCandidate(new RTCIceCandidate(candidate));
  }

  rejectCall(): void {
    if (this.incomingCallInfo) {
      this.websocketService.send({
        type: 'call-response',
        accepted: false,
        target: this.incomingCallInfo.senderId
      });
      this.incomingCallInfo = null;
    }
  }

  endCall(): void {
    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    // Reset state
    this.isInCall = false;
    this.incomingCallInfo = null;
    this.remoteUserName = null;
    
    // Clear video elements
    if (this.localVideo) {
      this.localVideo.nativeElement.srcObject = null;
    }
    if (this.remoteVideo) {
      this.remoteVideo.nativeElement.srcObject = null;
    }
    
    // Notify others
    this.websocketService.send({
      type: 'call-ended',
      sender: this.currentUser?.id
    });
  }

  
  stopDetection(): void {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  logout(): void {
    this.stopDetection();
    this.authService.logout();
    this.currentUser = null;
    this.endCall();
    this.websocketService.disconnect();
  }

}