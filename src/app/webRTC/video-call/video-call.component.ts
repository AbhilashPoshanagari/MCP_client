import { Component, OnInit, OnDestroy, NgZone, ViewChild, ElementRef, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { WebSocketService } from '../../services/websocket.service';
import { AuthService } from '../../services/auth.service';
import { LoginModalComponent } from '../../components/login-modal/login-modal.component';
import { StorageService } from '../../services/storage.service';

interface CallState {
  isInCall: boolean;
  isRinging: boolean;
  isCallActive: boolean;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  users: Array<{ id: string; name: string; isMuted?: boolean; isSharingScreen?: boolean; }>;
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
export class VideoCallComponent implements OnInit, OnDestroy {
  @ViewChild('localVideo', { static: false }) set localVideoRef(element: ElementRef<HTMLVideoElement>) {
    if (element) {
      this.localVideo = element;
      this.attachLocalStreamToVideo();
    }
  }
  @ViewChild('remoteVideo', { static: false }) set remoteVideoRef(element: ElementRef<HTMLVideoElement>) {
    if (element) {
      this.remoteVideo = element;
      this.attachRemoteStreamToVideo();
    }
  }

  private localVideo?: ElementRef<HTMLVideoElement>;
  private remoteVideo?: ElementRef<HTMLVideoElement>;

  @Input() userId: string = "";
  @Input() roomId: string = 'room';
  @Output() callEnded = new EventEmitter<void>();

  // User info
  currentUser: any;
  targetUserName: string = '';
  targetUserId: string = '';

  // Call state
  callState: CallState = {
    isInCall: false,
    isRinging: false,
    isCallActive: false,
    isMuted: false,
    isVideoOn: true,
    isScreenSharing: false,
    users: []
  };

  incomingCallInfo: { senderId: string; senderName: string; } | null = null;
  showParticipantList: boolean = false;
  hasNotifications: boolean = false;
  
  // WebRTC
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  remoteStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private wsSubscription?: Subscription;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  
  // STUN servers
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];
  
  private callStartTime: Date | null = null;
  private callTimerInterval: any;

  constructor(
    private websocketService: WebSocketService,
    private authService: AuthService,
    private dialog: MatDialog,
    private storageService: StorageService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser() || null;
    if (this.currentUser) {
      console.log('Current user:', this.currentUser);
      this.roomId = `${this.roomId}-${this.currentUser.username}`;
      this.connectWebSocket();
    }
  }

  ngOnDestroy() {
    this.endCall();
    this.wsSubscription?.unsubscribe();
    this.cleanupMedia();
    this.websocketService.disconnect();
    if (this.callTimerInterval) {
      clearInterval(this.callTimerInterval);
    }
  }

  private connectWebSocket(): void {
    this.websocketService.connect(this.roomId);
    this.setupWebSocketListeners();
  }

  private setupWebSocketListeners(): void {
    this.wsSubscription = this.websocketService.messagesSubject.subscribe({
      next: (message: any) => {
        console.log('Received WebSocket message:', message);
        
        switch (message.type) {
          case 'call-request':
            this.handleIncomingCall(message);
            break;
            
          case 'call-response':
            this.handleCallResponse(message);
            break;
            
          case 'offer':
            this.handleOffer(message);
            break;
            
          case 'answer':
            this.handleAnswer(message);
            break;
            
          case 'ice-candidate':
            this.handleIceCandidate(message);
            break;
            
          case 'call-ended':
            this.handleRemoteCallEnd();
            break;
            
          case 'user-left':
            if (this.callState.isInCall && message.user === this.targetUserId) {
              this.handleRemoteCallEnd();
            }
            break;
          case 'screen-sharing':
          this.handleScreenSharing(message.sender, message.isSharing);
          break;
        }
      },
      error: (error) => {
        console.error('WebSocket error:', error);
      }
    });
  }

  // ==================== CALL INITIATION ====================

  async startCall(): Promise<void> {
    try {
      if (!this.targetUserName) {
        this.snackBar.open('Please enter a username', 'Close', { duration: 3000 });
        return;
      }

      // Show ringing state immediately
      this.callState.isInCall = true;
      this.callState.isRinging = true;
      this.cdr.detectChanges();

      // First get user ID from username (you need to implement this)
      const userId = await this.findUserIdByUsername(this.targetUserName);
      if (!userId) {
        this.snackBar.open('User not found', 'Close', { duration: 3000 });
        this.resetCallState();
        return;
      }

      this.targetUserId = userId;

      // Initialize local stream (but don't start peer connection yet)
      await this.initializeLocalStream();

      // Send call request
      this.websocketService.send({
        type: 'call-request',
        sender: this.currentUser.id,
        sender_username: this.currentUser.username,
        target: this.targetUserName,
        room_id: this.roomId
      });

      this.snackBar.open(`Calling ${this.targetUserName}...`, 'Close', { duration: 3000 });

    } catch (error) {
      console.error('Error starting call:', error);
      this.snackBar.open('Failed to start call', 'Close', { duration: 3000 });
      this.resetCallState();
    }
  }

    // Temporary method - replace with actual user lookup service
  private async findUserIdByUsername(username: string): Promise<string | null> {
    // You need to implement this based on your user management system
    // This could be an API call or looking at the list of online users
    console.warn('Implement user ID lookup for username:', username);
    return new Promise((resolve, reject) => {
      this.authService.getUserDetailsByUsername(username).subscribe({
        next: (user: any) => {
          if (user) {
            this.targetUserId = user.data.id;
            console.log('Found user ID:', this.targetUserId, 'for username:', username);
            resolve(this.targetUserId);
          } else {
            console.warn('User not found for username:', username);
            this.snackBar.open('User not found', 'Close', { duration: 3000 });
            resolve(null);
          }
        },
        error: (error) => {
          console.error('Error fetching user details:', error);
          this.snackBar.open('Error fetching user details', 'Close', { duration: 3000 });
          resolve(null);
        }
      });
    });
  }

  // ==================== INCOMING CALL HANDLING ====================

  private handleIncomingCall(message: any): void {
    this.ngZone.run(() => {
      this.incomingCallInfo = {
        senderId: message.from_user_id,
        senderName: message.from_username
      };
      this.hasNotifications = true;
      this.cdr.detectChanges();

      // Show notification
      this.snackBar.open(`Incoming call from ${message.from_username}`, 'Answer', {
        duration: 15000,
      }).onAction().subscribe(() => {
        this.acceptIncomingCall(message.from_user_id);
      });
    });
  }

  async acceptIncomingCall(senderId: string): Promise<void> {
    try {
      const sender = this.incomingCallInfo;
      if (!sender) return;

      // Update UI
      this.callState.isInCall = true;
      this.targetUserId = senderId;
      this.targetUserName = sender.senderName;
      this.incomingCallInfo = null;

      // Initialize local stream
      await this.initializeLocalStream();

      // Send acceptance
      this.websocketService.send({
        type: 'call-response',
        accepted: true,
        target: senderId,
        from_user_id: this.currentUser.id,
        from_username: this.currentUser.username
      });

      // Initialize peer connection (will receive offer)
      await this.initializePeerConnection();

      this.cdr.detectChanges();

    } catch (error) {
      console.error('Error accepting call:', error);
      this.rejectIncomingCall(senderId);
    }
  }

  rejectIncomingCall(senderId: string): void {
    this.websocketService.send({
      type: 'call-response',
      accepted: false,
      target: senderId,
      from_user_id: this.currentUser.id,
      from_username: this.currentUser.username
    });

    this.incomingCallInfo = null;
    this.hasNotifications = false;
    this.resetCallState();
  }

  // ==================== CALL RESPONSE HANDLING ====================

  private handleCallResponse(message: any): void {
    this.ngZone.run(() => {
      if (message.accepted) {
        // Call was accepted
        this.callState.isRinging = false;
        this.snackBar.open(`Call accepted by ${message.from_username}`, 'Close', { duration: 3000 });

        // Initialize peer connection and send offer
        this.initializePeerConnection().then(() => {
          this.createAndSendOffer();
        });

      } else {
        // Call was rejected
        this.snackBar.open('Call rejected', 'Close', { duration: 3000 });
        this.resetCallState();
      }
    });
  }

  // ==================== WEBRTC METHODS ====================

  private async initializeLocalStream(): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      // Attach to video element if available
      this.attachLocalStreamToVideo();

    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw new Error('Could not access camera/microphone');
    }
  }

  private attachLocalStreamToVideo(): void {
    if (this.localVideo && this.localStream) {
      this.ngZone.run(() => {
        const videoEl = this.localVideo!.nativeElement;
        videoEl.srcObject = this.localStream;
        videoEl.play().catch(e => console.error('Error playing local video:', e));
      });
    }
  }

  private attachRemoteStreamToVideo(): void {
  if (!this.remoteVideo || !this.remoteStream) {
    console.log('Remote video or stream not ready');
    return;
  }

  try {
    const videoEl = this.remoteVideo.nativeElement;
    
    // Only update if the stream has changed
    if (videoEl.srcObject !== this.remoteStream) {
      console.log('Attaching remote stream to video');
      
      // Set the new stream
      videoEl.srcObject = this.remoteStream;
      
      // Play with proper error handling
      this.playRemoteVideo(videoEl);
    }
  } catch (error) {
    console.error('Error attaching remote stream:', error);
  }
}

private playRemoteVideo(videoEl: HTMLVideoElement, retryCount = 0): void {
  const maxRetries = 5;
  
  // Check if video element is ready
  if (!videoEl) {
    console.log('Video element not available');
    return;
  }

  // Check if stream has tracks
  if (!this.remoteStream || this.remoteStream.getTracks().length === 0) {
    if (retryCount < maxRetries) {
      console.log(`No tracks yet, retrying (${retryCount + 1}/${maxRetries})...`);
      setTimeout(() => this.playRemoteVideo(videoEl, retryCount + 1), 200 * (retryCount + 1));
    }
    return;
  }

  // Try to play
  const playPromise = videoEl.play();
  
  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        console.log('✅ Remote video playing successfully');
      })
      .catch(error => {
        console.error(`Error playing remote video (attempt ${retryCount + 1}):`, error.name);
        
        if (error.name === 'AbortError' && retryCount < maxRetries) {
          // Retry with increasing delay
          setTimeout(() => {
            this.playRemoteVideo(videoEl, retryCount + 1);
          }, 300 * (retryCount + 1));
        } 
        else if (error.name === 'NotAllowedError') {
          // Need user interaction
          console.log('Play requires user interaction');
          // You could show a play button here
        }
        else {
          console.error('Failed to play remote video:', error);
        }
      });
  }
}

  private async initializePeerConnection(): Promise<void> {
    this.peerConnection = new RTCPeerConnection({ 
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10
    });

    this.remoteStream = null;

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        if (this.localStream) {
          this.peerConnection?.addTrack(track, this.localStream);
        }
      });
    }

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.targetUserId) {
        this.websocketService.send({
          type: 'ice-candidate',
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
          },
          sender: this.currentUser.id,
          target: this.targetUserId
        });
      }
    };

      this.remoteStream = new MediaStream();

    this.peerConnection.ontrack = async (event) => {
      console.log('Remote track received:', event.track.kind, 'from stream:', event.streams[0].id);
      this.ngZone.run(() => {
        try {
          console.log("Remote track received:", event.track.kind);

          if (!this.remoteStream) return;

          this.remoteStream.addTrack(event.track);

          if (this.remoteVideo?.nativeElement) {
            const videoEl = this.remoteVideo.nativeElement;

            if (videoEl.srcObject !== this.remoteStream) {
              videoEl.srcObject = this.remoteStream;
              videoEl.play().catch(e => console.error("Remote play error:", e));
            }
          }
        } catch (error) {
        console.error('Error in ontrack handler:', error);
      }
      });
    }

    // Handle connection state
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection?.connectionState);
      this.ngZone.run(() => {
        if (this.peerConnection?.connectionState === 'connected') {
          this.callState.isCallActive = true;
          this.callState.isInCall = true;
          this.callStartTime = new Date();
          this.startCallTimer();
          this.cdr.detectChanges();
        }else if (this.peerConnection?.connectionState === 'disconnected' || this.peerConnection?.connectionState === 'failed') {
          this.snackBar.open('Connection lost', 'Close', { duration: 3000 });
          this.endCall();
        }
      });
    };

    // Handle negotiation needed
    this.peerConnection.onnegotiationneeded = () => {
      console.log('Negotiation needed');
    };

    // Add any pending ICE candidates
    if (this.pendingIceCandidates.length > 0) {
      for (const candidate of this.pendingIceCandidates) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
      this.pendingIceCandidates = [];
    }

    try {
      // Set the stream
      const videoEl = this.remoteVideo?.nativeElement;
      if (!videoEl) {
        console.warn('remote video element not found');
      } else if (this.remoteStream && videoEl.srcObject !== this.remoteStream) {
        videoEl.srcObject = this.remoteStream;
        console.log('Set video.srcObject to remote stream');
        this.playRemoteVideo(videoEl);
      }
            
    } catch (error) {
      console.error('Error attaching remote stream:', error);
    }
  }

  private async createAndSendOffer(): Promise<void> {
    if (!this.peerConnection) return;

    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await this.peerConnection.setLocalDescription(offer);

      this.websocketService.send({
        type: 'offer',
        offer: offer,
        sender: this.currentUser.id,
        sender_username: this.currentUser.username,
        target: this.targetUserId
      });

    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  private async handleOffer(message: any): Promise<void> {
    try {
      if (!this.peerConnection) {
        await this.initializePeerConnection();
      }

      if (this.peerConnection) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.signal.offer));
        
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        this.websocketService.send({
          type: 'answer',
          answer: answer,
          sender: this.currentUser.id,
          sender_username: this.currentUser.username,
          target: message.from_user_id
        });
      }
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  private async handleAnswer(message: any): Promise<void> {
    try {
      if (this.peerConnection) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  private async handleIceCandidate(message: any): Promise<void> {
    try {
      if (this.peerConnection && this.peerConnection.remoteDescription) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
      } else {
        this.pendingIceCandidates.push(message.candidate);
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  private handleRemoteCallEnd(): void {
    this.ngZone.run(() => {
      this.snackBar.open('Remote user ended the call', 'Close', { duration: 3000 });
      this.endCall();
    });
  }

  handleScreenSharing(senderId: string, isSharing: boolean) {    
    const user = this.callState.users.find(u => u.id === senderId);
    if (user) {
      user.isSharingScreen = isSharing;
    }
  }

  // ==================== CALL CONTROLS ====================

  toggleMute(): void {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      this.callState.isMuted = !this.callState.isMuted;
    }
  }

  toggleVideo(): void {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      this.callState.isVideoOn = !this.callState.isVideoOn;
    }
  }

  // toggleScreenShare(): void {
  //   // Implement screen sharing
  //   this.callState.isScreenSharing = !this.callState.isScreenSharing;
  // }

    async toggleScreenShare() {
    try {
      if (!this.callState.isScreenSharing) {
        // Start screen sharing
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'monitor'
          } as any,
          audio: false
        });

        const videoTrack = this.screenStream.getVideoTracks()[0];
        this.peerConnection?.getSenders().forEach(sender => {
          if (sender.track?.kind === 'video' && videoTrack) {
            sender.replaceTrack(videoTrack).then(() => {
              console.log(`Replaced video track with screen share for sender: ${sender}`);
            }).catch(error => {
              console.error('Error replacing track for screen share:', error);
            });
          }
        });

        // Handle screen sharing stop
        videoTrack.onended = () => {
          // this.debugLog('Screen sharing ended by user');
          this.toggleScreenShare();
        };

        this.callState.isScreenSharing = true;
        
        // Notify others
        this.websocketService.send({
          type: 'screen-sharing',
          isSharing: true,
          sender: this.userId
        });

        // this.debugLog('Started screen sharing');

      } else {
        // Stop screen sharing
        if (this.screenStream) {
          this.screenStream.getTracks().forEach(track => track.stop());
          this.screenStream = null;
        }

        // Revert to camera
        if (this.localStream) {
          const videoTrack = this.localStream.getVideoTracks()[0];
          this.peerConnection?.getSenders().forEach(sender => {
            if (sender.track?.kind === 'video' && videoTrack) {
              sender.replaceTrack(videoTrack).then(() => {
                console.log(`Replaced screen share with camera for sender: ${sender}`);
              }).catch(error => {
                console.error('Error replacing track to revert screen share:', error);
              });
            }
          });
 
        }

        this.callState.isScreenSharing = false;
        
        // Notify others
        this.websocketService.send({
          type: 'screen-sharing',
          isSharing: false,
          sender: this.userId
        });

        // this.debugLog('Stopped screen sharing');
      }
      
      // this.safeDetectChanges();
      this.cdr.detectChanges();
    } catch (error) {
      // this.debugLog('Screen sharing error:', error);
      this.snackBar.open('Failed to share screen', 'OK', {
        duration: 3000
      });
    }
  }

  toggleParticipantList(): void {
    this.showParticipantList = !this.showParticipantList;
  }

  endCall(): void {
    // Notify remote user
    if (this.targetUserId) {
      this.websocketService.send({
        type: 'call-ended',
        sender: this.currentUser?.id,
        target: this.targetUserId
      });
    }

    this.resetCallState();
    this.callEnded.emit();
  }

  private resetCallState(): void {
    // Clean up WebRTC
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
      this.remoteStream = null;
    }

    // Clear video elements
    if (this.localVideo) {
      this.localVideo.nativeElement.srcObject = null;
    }
    if (this.remoteVideo) {
      this.remoteVideo.nativeElement.srcObject = null;
    }

    // Reset state
    this.callState = {
      isInCall: false,
      isRinging: false,
      isCallActive: false,
      isMuted: false,
      isVideoOn: true,
      isScreenSharing: false,
      users: []
    };

    this.targetUserId = '';
    this.incomingCallInfo = null;
    this.pendingIceCandidates = [];
    this.callStartTime = null;

    if (this.callTimerInterval) {
      clearInterval(this.callTimerInterval);
    }

    this.cdr.detectChanges();
  }

  private cleanupMedia(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
    }
  }

  // ==================== UI HELPERS ====================

  playVideo(videoElement: HTMLVideoElement): void {
    videoElement.play().catch(e => console.error('Error playing video:', e));
  }

  async copyRoomId(): Promise<void> {
    await navigator.clipboard.writeText(this.roomId);
    this.snackBar.open('Room ID copied to clipboard', 'Close', { duration: 2000 });
  }

  getCallDuration(): string {
    if (!this.callStartTime) return '00:00';

    const diff = Math.floor((new Date().getTime() - this.callStartTime.getTime()) / 1000);
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  private startCallTimer(): void {
    if (this.callTimerInterval) {
      clearInterval(this.callTimerInterval);
    }
    this.callTimerInterval = setInterval(() => {
      this.cdr.detectChanges();
    }, 1000);
  }

  promptLogin(): void {
    const dialogRef = this.dialog.open(LoginModalComponent, {
      width: '400px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe({
      next: (user: any) => {
        if (user) {
          this.ngZone.run(() => {
            this.currentUser = user;
            this.connectWebSocket();
            this.authService.updateUserOnlineStatus(true, "not available");
            this.cdr.detectChanges();
          });
        }
      },
      error: (error: any) => {
        console.error("Login error:", error);
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.currentUser = null;
    this.endCall();
    this.websocketService.disconnect();
  }

  // Placeholder methods
  searchUserToCall(): void {
    console.log('Search user to call');
  }

  openContacts(): void {
    console.log('Open contacts');
  }

  joinRoom(): void {
    console.log('Join room');
  }
}