import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, Input, Output, EventEmitter, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { WebSocketService } from '../../services/websocket.service';
import { ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LoginModalComponent } from '../../components/login-modal/login-modal.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
// import { API_URLS } from '../../constants/apiUrls';
import { StorageService } from '../../services/storage.service';

interface CallUser {
  id: string;
  name: string;
  isSharingScreen?: boolean;
  isMuted?: boolean;
}

interface CallState {
  isInCall: boolean;
  isCallActive: boolean;
  isRinging: boolean;
  isScreenSharing: boolean;
  isMuted: boolean;
  isVideoOn: boolean;
  roomId?: string;
  users: CallUser[];
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
  @ViewChildren('remoteVideo') remoteVideos!: QueryList<ElementRef<HTMLVideoElement>>;

  @Input() userId: string = "";
  @Input() roomId: string = 'default-room';
  @Output() callEnded = new EventEmitter<void>();
  
  callState: CallState = {
    isInCall: false,
    isCallActive: false,
    isRinging: false,
    isScreenSharing: false,
    isMuted: false,
    isVideoOn: true,
    users: []
  };

  peerConnections: Map<string, RTCPeerConnection> = new Map();
  private pendingIce: Map<string, RTCIceCandidateInit[]> = new Map();
  private pendingRemoteStreams = new Map<string, MediaStream>();

  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private iceServers: RTCIceServer[] = [];
  private wsSubscription?: Subscription;

  currentUser: any = null;
  
  public hasNotifications: boolean = false;
  public showParticipantList: boolean = false;
  private callStartTime: Date | null = null;

  incomingCallInfo: { senderId: string; senderName: string; } | null = null;
  serverUrl: string = '';
  constructor(
    private websocketService: WebSocketService, 
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private storageService: StorageService
  ) {}

  async ngOnInit() {
    this.serverUrl = this.storageService.getValueFromKey('media_server') || "";
    this.currentUser = this.authService.getCurrentUser();    
    if (!this.currentUser) {
      this.promptLogin();
    } else {
      if(!this.userId && this.currentUser.id){
        this.userId = this.currentUser.id;
      }
      this.websocketService.connect(this.roomId);
      this.setupWebSocketListeners();
      this.authService.updateUserOnlineStatus(true, "not available");
    }
  }

  ngAfterViewInit() {
  this.remoteVideos.changes.subscribe(() => {
    this.remoteVideos.forEach(video => {
      const userId = video.nativeElement.dataset['userId'];
      const stream = this.pendingRemoteStreams.get(userId!);

      if (stream) {
        video.nativeElement.srcObject = stream;
        // video.nativeElement.play().catch(() => {});
        this.pendingRemoteStreams.delete(userId!);
      }
    });
  });
}


  ngOnDestroy() {
    this.endCall();
    this.websocketService.disconnect();
    this.authService.updateUserOnlineStatus(false, "available");
    this.wsSubscription?.unsubscribe();
  }

  promptLogin(): void {
    const dialogRef = this.dialog.open(LoginModalComponent, {
      width: '400px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(user => {
      if (user) {
        this.currentUser = user;
        // console.log('Logged in user:', this.currentUser);
        this.websocketService.connect(this.roomId);
        this.setupWebSocketListeners();
        this.authService.updateUserOnlineStatus(true, "not available");
        this.cdr.detectChanges();
      } else {
        this.callEnded.emit();
      }
    });
  }

  logout(): void {
    this.endCall();
    this.authService.logout();
    this.currentUser = null;
    this.callEnded.emit();
  }

  openContacts(): void {
    this.snackBar.open('Contacts feature coming soon!', 'OK', {
      duration: 3000
    });
  }

  joinRoom(): void {
    if (this.roomId && this.roomId.trim()) {
      // this.websocketService.disconnect();
      // this.websocketService.connect(this.roomId);
      this.startCall();
    } else {
      this.snackBar.open('Please enter a room ID', 'OK', {
        duration: 3000
      });
    }
  }

  private async getWebRTCConfig() {
    try {
      const response = await fetch(`${this.serverUrl}/api/config`);
      const config = await response.json();
      this.iceServers = config.iceServers;
    } catch (error) {
      console.error('Failed to get WebRTC config:', error);
      this.iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ];
    }
  }

  private setupWebSocketListeners() {
    this.wsSubscription = this.websocketService.onMessage().subscribe(async(message: any) => {
      switch (message.type) {
        case 'offer':
          this.handleOffer(message.offer, message.sender);
          break;
        case 'answer':
          this.handleAnswer(message.answer, message.sender);
          break;
        case 'ice-candidate':
          this.handleIceCandidate(message.candidate, message.sender);
          break;
        case 'call-request':
          this.handleCallRequest(message.from_user_id, message.from_username);
          break;
        case 'call-response':
          await this.handleCallResponse(message.accepted, message.from_user_id);
          break;
        case 'user-joined':
          this.handleUserJoined(message.user);
          break;
        case 'user-left':
          this.handleUserLeft(message.user);
          break;
        case 'screen-sharing':
          this.handleScreenSharing(message.sender, message.isSharing);
          break;
      }
    });
  }

  private createPeerConnection(userId: string): RTCPeerConnection {
    const config: RTCConfiguration = {
      iceServers: this.iceServers
    };

    const pc = new RTCPeerConnection(config);

      // Add logging for state changes
  pc.oniceconnectionstatechange = () => {
    console.log(`ICE state for ${userId}: ${pc.iceConnectionState}`);
    this.logPeerConnectionStates();
    
    if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        console.error(`ICE connection failed for user: ${userId}`);
        this.snackBar.open(`Connection lost with ${userId}`, 'OK', {
          duration: 3000
        });
        
        // Try to restart ICE
        if (pc.iceConnectionState === 'failed') {
          // this.restartIce(userId, pc);
          console.log("Peer connection : ", pc.iceConnectionState);
        }
      } else if (pc.iceConnectionState === 'connected') {
        console.log(`ICE connected with ${userId}`);
        this.callState.isCallActive = true;
        this.callState.isRinging = false;
        this.cdr.detectChanges();
      }
    };

    pc.onsignalingstatechange = () => {
      console.log(`Signaling state for ${userId}: ${pc.signalingState}`);
    };

    // Add local stream tracks
    // if (this.localStream) {
    //   this.localStream.getTracks().forEach(track => {
    //     pc.addTrack(track, this.localStream!);
    //   });
    // }

    pc.ontrack = (event) => {
        const stream = event.streams[0];

        const videoEl = this.remoteVideos?.find(
          v => v.nativeElement.dataset['userId'] === userId.toString()
        );

        if (videoEl) {
          videoEl.nativeElement.srcObject = stream;
          videoEl.nativeElement.play().catch(() => {});
        } else {
          this.pendingRemoteStreams.set(userId, stream);
        }
      };


    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("event candidate : ", event.candidate)
        this.websocketService.send({
          type: 'ice-candidate',
          candidate: event.candidate,
          target: userId
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state for', userId, ':', pc.connectionState);
    };

    pc.onnegotiationneeded = async () => {
      try {
        if (pc.signalingState !== 'stable') return;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        this.websocketService.send({
          type: 'offer',
          offer,
          target: userId
        });
      } catch (e) {
        console.error('Negotiation failed', e);
      }
    };


    return pc;
  }

  private getOrCreatePeerConnection(userId: string): RTCPeerConnection {
    let pc = this.peerConnections.get(userId);
    
    // If connection exists but is closed, remove it
    if (pc && (pc.connectionState === 'closed' || pc.iceConnectionState === 'closed')) {
      console.log(`Removing closed connection for ${userId}`);
      pc.close();
      this.peerConnections.delete(userId);
      pc = undefined;
    }
    
    if (!pc) {
      console.log(`Creating new peer connection for ${userId}`);
      pc = this.createPeerConnection(userId);
      this.peerConnections.set(userId, pc);
    } else {
      console.log(`Using existing peer connection for ${userId}, state: ${pc.signalingState}`);
    }
    
    return pc;
  }

  async handleOffer(offer: RTCSessionDescriptionInit, senderId: string): Promise<void> {
    console.log(`Received offer from ${senderId}`);
    
    try {
      // Check if we're already in a call with this user
        await this.getWebRTCConfig();
      const existingPc = this.peerConnections.get(senderId);
      if (existingPc && existingPc.signalingState !== 'stable') {
        console.warn(`Already processing offer from ${senderId}. Ignoring duplicate.`);
        return;
      }

      // If this is an incoming call, update state
      if (!this.callState.isInCall) {
        this.callState.isRinging = true;
        this.callState.isInCall = true;
        
        if (!this.callState.users.some(u => u.id === senderId)) {
          this.callState.users.push({
            id: senderId,
            name: senderId
          });
        }
      }

      // Get local media if not already done
      if (!this.localStream) {
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });
          
          if (this.localVideo?.nativeElement) {
            // this.localVideo.nativeElement.srcObject = this.localStream;
            this.attachLocalStream();
          }
        } catch (error) {
          console.error('Error getting user media:', error);
          this.snackBar.open('Failed to access camera/microphone', 'OK', {
            duration: 3000
          });
          return;
        }
      }

      // Get or create peer connection
      const pc = this.getOrCreatePeerConnection(senderId);
      pc.getSenders().forEach(sender => {
          if (!sender.track) pc.removeTrack(sender);
        });
      this.addLocalTracks(pc);

      // Check current signaling state
      if (pc.signalingState !== 'stable') {
        console.warn(`Peer connection for ${senderId} is not stable (${pc.signalingState}). Restarting negotiation.`);
        
        // Close and create new connection
        pc.close();
        this.peerConnections.delete(senderId);
        const newPc = this.createPeerConnection(senderId);
        this.peerConnections.set(senderId, newPc);
        
        await newPc.setRemoteDescription(new RTCSessionDescription(offer));
        const queued = this.pendingIce.get(senderId);
          queued?.forEach(c => pc.addIceCandidate(c));
          this.pendingIce.delete(senderId);
        const answer = await newPc.createAnswer();
        await newPc.setLocalDescription(answer);
        
        this.websocketService.send({
          type: 'answer',
          answer: answer,
          target: senderId,
          sender: this.userId
        });
      } else {
        // Normal flow
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const queued = this.pendingIce.get(senderId);
          queued?.forEach(c => pc.addIceCandidate(c));
          this.pendingIce.delete(senderId);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.websocketService.send({
          type: 'answer',
          answer: answer,
          target: senderId,
          sender: this.userId
        });
      }
      this.callState.isCallActive = true;
      this.callState.isRinging = false;
      this.cdr.detectChanges();
      
    } catch (error: any) {
      console.error('Error handling offer:', error);
      
      if (error.name === 'InvalidStateError') {
        console.error(`InvalidStateError in handleOffer for ${senderId}. Signaling state may be corrupted.`);
        // Clean up and retry or notify user
        this.peerConnections.get(senderId)?.close();
        this.peerConnections.delete(senderId);
      }
      
      this.snackBar.open('Failed to handle call offer', 'OK', {
        duration: 3000
      });
    }
  }

  async handleAnswer(answer: RTCSessionDescriptionInit, senderId: string) {
    try {
      const pc = this.peerConnections.get(senderId);
      if (!pc) {
        console.error('No peer connection found for:', senderId);
        return;
      }
      
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      const queued = this.pendingIce.get(senderId);
          queued?.forEach(c => pc.addIceCandidate(c));
          this.pendingIce.delete(senderId);
      this.callState.isRinging = false;
      this.callState.isCallActive = true;
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit, senderId: string) {
    const pc = this.peerConnections.get(senderId);

    if (!pc || !pc.remoteDescription) {
      if (!this.pendingIce.has(senderId)) {
        this.pendingIce.set(senderId, []);
      }
      this.pendingIce.get(senderId)!.push(candidate);
      return;
    }

    await pc.addIceCandidate(candidate);
  }


  async handleUserJoined(userId: string) {
    try {
      // Don't create connection to self
      if (userId === this.userId) return;

      // Add user to list
      if (!this.callState.users.some(u => u.id === userId)) {
        this.callState.users.push({
          id: userId,
          name: userId
        });
      }

      // If we're already in a call, create offer for new user
      if (this.callState.isCallActive && this.localStream) {
        const pc = this.getOrCreatePeerConnection(userId);
        
        // const offer = await pc.createOffer();
        // await pc.setLocalDescription(offer);
        pc.getSenders().forEach(sender => {
          if (!sender.track) pc.removeTrack(sender);
        });

        this.addLocalTracks(pc);
      }
      
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error handling user joined:', error);
    }
  }

  handleUserLeft(userId: string) {
    // Remove user from list
    this.callState.users = this.callState.users.filter(u => u.id !== userId);
    
    // Close and remove peer connection
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
    }
    
    // If all users left, end call
    if (this.callState.users.length === 0) {
      this.endCall();
    }
    
    this.cdr.detectChanges();
  }

  handleScreenSharing(senderId: string, isSharing: boolean) {
    const user = this.callState.users.find(u => u.id === senderId);
    if (user) {
      user.isSharingScreen = isSharing;
    }
    this.cdr.detectChanges();
  }

  handleCallRequest(senderId: string, senderName: string): void {
    // Store incoming call info
    this.incomingCallInfo = { senderId, senderName };
    this.hasNotifications = true;
    
    // Check if already in a call
    if (this.callState.isInCall) {
      this.websocketService.send({
        type: 'call-response',
        accepted: false,
        target: senderId,
        reason: 'User is already in a call'
      });
      this.incomingCallInfo = null;
      this.hasNotifications = false;
      return;
    }
    
    this.cdr.detectChanges();
  }

  acceptIncomingCall(senderId: string): void {
    if (!senderId) {
      this.snackBar.open('Invalid call request', 'OK', {
        duration: 3000
      });
      return;
    }

    this.websocketService.send({
      type: 'call-response',
      accepted: true,
      target: senderId,
      from_user_id: this.userId
    });

    this.callState.isInCall = true;
    this.callState.isRinging = true;
    this.hasNotifications = false;
    
    this.incomingCallInfo = null;
    
    this.snackBar.open('Call accepted. Connecting...', 'OK', {
      duration: 3000
    });
    
    this.cdr.detectChanges();
  }

  rejectIncomingCall(senderId: string): void {
    if (!senderId) {
      this.snackBar.open('Invalid call request', 'OK', {
        duration: 3000
      });
      return;
    }

    this.websocketService.send({
      type: 'call-response',
      accepted: false,
      target: senderId,
      reason: 'Call rejected by user'
    });

    this.incomingCallInfo = null;
    this.hasNotifications = false;
    
    this.snackBar.open('Call rejected', 'OK', {
      duration: 3000
    });
    
    this.cdr.detectChanges();
  }

  async handleCallResponse(accepted: boolean, senderId: string): Promise<void> {
  if (accepted) {
    try {
      this.callState.isRinging = false;
      this.callState.isCallActive = true;
      
      // Add user to list if not already there
      if (!this.callState.users.some(u => u.id === senderId)) {
        this.callState.users.push({
          id: senderId,
          name: senderId
        });
      }
      
      // Ensure we have local media stream
      if (!this.localStream) {
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 }
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
          
          if (this.localVideo?.nativeElement) {
            // this.localVideo.nativeElement.srcObject = this.localStream;
            this.attachLocalStream();

          }
        } catch (error) {
          console.error('Error getting user media:', error);
          this.snackBar.open('Failed to access camera/microphone', 'OK', {
            duration: 3000
          });
          return;
        }
      }
      
      // Create peer connection for the accepting user
      const pc = this.getOrCreatePeerConnection(senderId);
      this.addLocalTracks(pc);
      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      this.websocketService.send({
        type: 'offer',
        offer: offer,
        target: senderId
      });
      
      this.snackBar.open('Call accepted! Connecting...', 'OK', {
        duration: 3000
      });
      
    } catch (error) {
      console.error('Error handling call response:', error);
      this.snackBar.open('Failed to establish connection', 'OK', {
        duration: 3000
      });
      this.endCall();
    }
    
  } else {
    // Rejection handling remains the same
    this.callState.isRinging = false;
    this.callState.isInCall = false;
    
    // Clean up connections
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    if (this.localVideo?.nativeElement) {
      this.localVideo.nativeElement.srcObject = null;
    }
    
    this.snackBar.open('Call rejected by user', 'OK', {
      duration: 3000
    });
  }
  
  this.cdr.detectChanges();
}

  async startCall() {
    try {
      this.callState.isInCall = true;
      this.callState.isRinging = true;
      this.cdr.detectChanges();
      
      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      this.callStartTime = new Date();

      // Display local video
      if (this.localVideo?.nativeElement) {
        console.log('Setting local video stream');
        // this.localVideo.nativeElement.srcObject = this.localStream;
                this.attachLocalStream();

      }

      // Get WebRTC config
      await this.getWebRTCConfig();

      this.callState.isCallActive = true;
      this.callState.isRinging = false;

      // Notify others in the room
      this.websocketService.send({
        type: 'user-joined',
        user: this.userId,
        roomId: this.roomId
      });

    } catch (error) {
      console.error('Error starting call:', error);
      this.snackBar.open('Failed to start call. Please check camera/microphone permissions.', 'OK', {
        duration: 5000
      });
      this.endCall();
    }
  }

  async initiateCall(targetUser: any): Promise<void> {
    try {
      console.log(`Initiating call to ${targetUser.id}`);
      
      // Get WebRTC config first
      await this.getWebRTCConfig();
      
      // Get local media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Display local video
      if (this.localVideo?.nativeElement) {
        this.localVideo.nativeElement.srcObject = this.localStream;
        // this.attachLocalStream();
      }
      
      // Update call state
      this.callState.isInCall = true;
      this.callState.isRinging = true;
      this.callStartTime = new Date();
      
      // Add target user to users list
      if (!this.callState.users.some(u => u.id === targetUser.id)) {
        this.callState.users.push({
          id: targetUser.id,
          name: targetUser.name || targetUser.id
        });
      }
      
      // Create peer connection for the target user
      // But DON'T create offer yet - wait for acceptance
      this.getOrCreatePeerConnection(targetUser.id);
      
      // Send call request
      this.websocketService.send({
        type: 'call-request',
        sender: this.userId,
        sender_username: this.currentUser?.username || this.userId,
        target: targetUser.id
      });
      
      this.cdr.detectChanges();
      
      // Set timeout for call request
      setTimeout(() => {
        if (this.callState.isRinging && !this.callState.isCallActive) {
          console.warn(`Call timeout to ${targetUser.id}`);
          this.snackBar.open('No response from user. Call timed out.', 'OK', {
            duration: 5000
          });
          this.endCall();
        }
      }, 30000);
      
    } catch (error) {
      console.error('Error initiating call:', error);
      this.snackBar.open('Failed to start call. Check your camera/microphone permissions.', 'OK', {
        duration: 5000
      });
      this.endCall();
    }
  }

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
        
        // Replace video track in all peer connections
        this.peerConnections.forEach((pc, userId) => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender && videoTrack) {
            sender.replaceTrack(videoTrack);
          }
        });

        // Handle screen sharing stop
        videoTrack.onended = () => {
          this.toggleScreenShare();
        };

        this.callState.isScreenSharing = true;
        
        // Notify others
        this.websocketService.send({
          type: 'screen-sharing',
          isSharing: true,
          sender: this.userId
        });

      } else {
        // Stop screen sharing
        if (this.screenStream) {
          this.screenStream.getTracks().forEach(track => track.stop());
          this.screenStream = null;
        }

        // Revert to camera
        if (this.localStream) {
          const videoTrack = this.localStream.getVideoTracks()[0];
          
          this.peerConnections.forEach((pc, userId) => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender && videoTrack) {
              sender.replaceTrack(videoTrack);
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
      }
      
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Screen sharing error:', error);
      this.snackBar.open('Failed to share screen', 'OK', {
        duration: 3000
      });
    }
  }

  toggleMute() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.callState.isMuted = !audioTrack.enabled;
      }
    }
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.callState.isVideoOn = videoTrack.enabled;
      }
    }
  }

  copyRoomId(): void {
    navigator.clipboard.writeText(this.roomId).then(() => {
      this.snackBar.open('Room ID copied to clipboard!', 'OK', {
        duration: 3000
      });
    }).catch(err => {
      console.error('Failed to copy room ID:', err);
      this.snackBar.open('Failed to copy room ID', 'OK', {
        duration: 3000
      });
    });
  }

  toggleParticipantList(): void {
    this.showParticipantList = !this.showParticipantList;
  }

  getCallDuration(): string {
    if (!this.callStartTime || !this.callState.isCallActive) {
      return '00:00:00';
    }
    
    const now = new Date();
    const diff = Math.floor((now.getTime() - this.callStartTime.getTime()) / 1000);
    
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  searchUserToCall(): void {
    const username = prompt('Enter username to call:');
    if (username) {
      this.authService.getUserDetailsByUsername(username).subscribe((res: any) =>{
        console.log("user details : ", res);
        if(res.data && res.data.id){
          this.initiateCall({
            id: res.data.id,
            name: username
          });
        }else {
          alert("User not found");
        }
      })

    }
  }

  endCall() {
    // Stop all media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
    
    // Close all peer connections
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    
    // Reset state
    this.callState = {
      isInCall: false,
      isCallActive: false,
      isRinging: false,
      isScreenSharing: false,
      isMuted: false,
      isVideoOn: true,
      users: []
    };
    
    // Reset other states
    this.callStartTime = null;
    this.showParticipantList = false;
    this.incomingCallInfo = null;
    this.hasNotifications = false;
    
    // Clear video elements
    if (this.localVideo?.nativeElement) {
      this.localVideo.nativeElement.srcObject = null;
    }
    
    this.remoteVideos?.forEach(video => {
      video.nativeElement.srcObject = null;
    });
    
    // Notify others
    this.websocketService.send({
      type: 'user-left',
      user: this.userId,
      roomId: this.roomId
    });
    
    this.callEnded.emit();
    this.cdr.detectChanges();
  }

  playVideo(videoElement: HTMLVideoElement | null) {
  if (videoElement) {
    videoElement.play().catch(err => {
      console.warn('Video play failed:', err);
    });
  }
}

private logPeerConnectionStates(): void {
  console.log('=== Peer Connection States ===');
  this.peerConnections.forEach((pc, userId) => {
    console.log(`${userId}:`);
    console.log(`  Signaling: ${pc.signalingState}`);
    console.log(`  ICE: ${pc.iceConnectionState}`);
    console.log(`  Connection: ${pc.connectionState}`);
  });
  console.log('=============================');
}

private addLocalTracks(pc: RTCPeerConnection) {
    if (!this.localStream) return;

    const senders = pc.getSenders();
    this.localStream.getTracks().forEach(track => {
      if (!senders.find(s => s.track === track)) {
        pc.addTrack(track, this.localStream!);
      }
    });
  }

  private attachLocalStream() {
    if (!this.localVideo?.nativeElement || !this.localStream) return;

    const video = this.localVideo.nativeElement;
    video.muted = true;          // 🔴 REQUIRED (echo + autoplay)
    video.playsInline = true;    // 🔴 REQUIRED (mobile)
    video.autoplay = true;

    video.srcObject = this.localStream;

    video.play().catch(err => {
      console.warn('Local video play blocked:', err);
    });
  }


}