
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
import { API_URLS } from '../../constants/apiUrls';

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
  
  constructor(
    private websocketService: WebSocketService, 
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
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
    // Subscribe to remote video changes
    this.remoteVideos.changes.subscribe(() => {
      this.attachPendingRemoteStreams();
    });
    
    // Initial attachment for existing videos
    setTimeout(() => {
      this.attachPendingRemoteStreams();
    }, 100);
  }

  ngOnDestroy() {
    this.endCall();
    this.websocketService.disconnect();
    this.authService.updateUserOnlineStatus(false, "available");
    this.wsSubscription?.unsubscribe();
  }

  private debugLog(message: string, data?: any): void {
    console.log(`[VideoCall ${new Date().toISOString().slice(11, 19)}] ${message}`, data || '');
    
    // Optional: Log current state for debugging
    const state = {
      localStream: !!this.localStream,
      peerConnections: this.peerConnections.size,
      users: this.callState.users.length,
      pendingStreams: this.pendingRemoteStreams.size,
      pendingIce: Array.from(this.pendingIce.keys()).length
    };
    console.log('Current state:', state);
  }

  private safeDetectChanges(): void {
    // try {
    //   if (!this.cdr.markForCheck) {
        this.cdr.detectChanges();
    //   }
    // } catch (error) {
    //   console.warn('Change detection failed:', error);
    // }
  }

  private attachPendingRemoteStreams(): void {
    this.remoteVideos.forEach(video => {
      const userId = video.nativeElement.dataset['userId'];
      if (!userId) return;
      
      const stream = this.pendingRemoteStreams.get(userId);
      if (stream) {
        this.debugLog(`Attaching pending stream for ${userId}`);
        this.attachRemoteStream(userId, video.nativeElement, stream);
        this.pendingRemoteStreams.delete(userId);
      }
    });
  }

  private async playVideoWithRetry(
    videoElement: HTMLVideoElement, 
    stream: MediaStream,
    retries = 3
  ): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        if (videoElement.srcObject !== stream) {
          videoElement.srcObject = stream;
        }
        
        // Set required attributes for reliable playback
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.autoplay = true;
        
        await videoElement.play();
        this.debugLog(`Video playing successfully (attempt ${i + 1})`);
        return;
      } catch (error) {
        this.debugLog(`Video play failed (attempt ${i + 1}):`, error);
        
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    this.debugLog('All video play attempts failed');
  }

  private attachLocalStream(): void {
    if (!this.localVideo?.nativeElement || !this.localStream) {
      this.debugLog('Cannot attach local stream: missing element or stream');
      return;
    }

    const video = this.localVideo.nativeElement;
    
    try {
      video.muted = true;          // Required for local stream (no echo)
      video.playsInline = true;    // Required for mobile browsers
      video.autoplay = true;
      
      if (video.srcObject !== this.localStream) {
        video.srcObject = this.localStream;
      }
      
      video.play().catch(err => {
        this.debugLog('Local video play blocked:', err);
      });
      
      this.debugLog('Local stream attached successfully');
    } catch (error) {
      this.debugLog('Failed to attach local stream:', error);
    }
  }

  private attachRemoteStream(userId: string, videoElement: HTMLVideoElement, stream: MediaStream): void {
    try {
      videoElement.muted = false;   // Remote streams should not be muted by default
      videoElement.playsInline = true;
      videoElement.autoplay = true;
      
      if (videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
      }
      
      videoElement.play().catch(err => {
        this.debugLog(`Remote video play failed for ${userId}:`, err);
        // Schedule retry
        setTimeout(() => {
          if (videoElement.srcObject === stream) {
            videoElement.play().catch(() => {});
          }
        }, 1000);
      });
      
      this.debugLog(`Remote stream attached for ${userId}`);
    } catch (error) {
      this.debugLog(`Failed to attach remote stream for ${userId}:`, error);
    }
  }

  promptLogin(): void {
    const dialogRef = this.dialog.open(LoginModalComponent, {
      width: '400px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(user => {
      if (user) {
        this.currentUser = user;
        this.websocketService.connect(this.roomId);
        this.setupWebSocketListeners();
        this.authService.updateUserOnlineStatus(true, "not available");
        this.safeDetectChanges();
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
      this.startCall();
    } else {
      this.snackBar.open('Please enter a room ID', 'OK', {
        duration: 3000
      });
    }
  }

  private async getWebRTCConfig() {
    try {
      const response = await fetch(`${API_URLS.BASE_URL}/api/config`);
      const config = await response.json();
      this.iceServers = config.iceServers;
      this.debugLog('Got WebRTC config:', this.iceServers);
    } catch (error) {
      this.debugLog('Failed to get WebRTC config:', error);
      this.iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ];
    }
  }

  private setupWebSocketListeners() {
    this.wsSubscription = this.websocketService.onMessage().subscribe(async(message: any) => {
      this.debugLog('WebSocket message received:', message);
      
      switch (message.type) {
        case 'offer':
          await this.handleOffer(message.offer, message.sender);
          break;
        case 'answer':
          await this.handleAnswer(message.answer, message.sender);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(message.candidate, message.sender);
          break;
        case 'call-request':
          this.handleCallRequest(message.from_user_id, message.from_username);
          break;
        case 'call-response':
          await this.handleCallResponse(message.accepted, message.from_user_id);
          break;
        case 'user-joined':
          await this.handleUserJoined(message.user);
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
    
    this.debugLog(`Creating peer connection for ${userId}`);

    // Add ICE connection state monitoring
    pc.oniceconnectionstatechange = () => {
      this.debugLog(`ICE state for ${userId}: ${pc.iceConnectionState}`);
      this.logPeerConnectionStates();
      
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        this.debugLog(`ICE connection failed for user: ${userId}`);
        this.snackBar.open(`Connection lost with ${userId}`, 'OK', {
          duration: 3000
        });
      } else if (pc.iceConnectionState === 'connected') {
        this.debugLog(`ICE connected with ${userId}`);
        this.callState.isCallActive = true;
        this.callState.isRinging = false;
        this.safeDetectChanges();
      }
    };

    pc.onsignalingstatechange = () => {
      this.debugLog(`Signaling state for ${userId}: ${pc.signalingState}`);
    };

    // Handle incoming tracks
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) {
        this.debugLog(`No stream in track event for ${userId}`);
        return;
      }
      
      this.debugLog(`Received track for ${userId}`, {
        trackKind: event.track.kind,
        streamId: stream.id,
        trackId: event.track.id
      });

      // Try to attach immediately
      setTimeout(() => {
        const videoEl = this.remoteVideos?.find(
          v => v.nativeElement.dataset['userId'] === userId.toString()
        );

        if (videoEl) {
          this.debugLog(`Found video element for ${userId}, attaching stream`);
          this.attachRemoteStream(userId, videoEl.nativeElement, stream);
        } else {
          this.debugLog(`No video element found for ${userId}, storing stream`);
          this.pendingRemoteStreams.set(userId, stream);
          this.safeDetectChanges();
        }
      }, 0);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.debugLog(`Generated ICE candidate for ${userId}:`, event.candidate);
        this.websocketService.send({
          type: 'ice-candidate',
          candidate: event.candidate,
          target: userId
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      this.debugLog(`Connection state for ${userId}: ${pc.connectionState}`);
    };

    // Handle negotiation needed
    pc.onnegotiationneeded = async () => {
      try {
        if (pc.signalingState !== 'stable') {
          this.debugLog(`Skipping negotiation for ${userId}, signaling state: ${pc.signalingState}`);
          return;
        }

        this.debugLog(`Negotiation needed for ${userId}`);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        this.websocketService.send({
          type: 'offer',
          offer,
          target: userId
        });
        
        this.debugLog(`Sent offer to ${userId}`);
      } catch (e) {
        this.debugLog(`Negotiation failed for ${userId}:`, e);
      }
    };

    // Add local tracks if available
    this.addLocalTracks(pc);

    return pc;
  }

  private getOrCreatePeerConnection(userId: string): RTCPeerConnection {
    // Clean up any closed connections
    this.peerConnections.forEach((pc, id) => {
      if (pc.connectionState === 'closed' || 
          pc.iceConnectionState === 'closed' ||
          pc.signalingState === 'closed') {
        this.debugLog(`Cleaning up closed connection for ${id}`);
        pc.close();
        this.peerConnections.delete(id);
      }
    });
    
    let pc = this.peerConnections.get(userId);
    
    if (!pc) {
      this.debugLog(`Creating new peer connection for ${userId}`);
      pc = this.createPeerConnection(userId);
      this.peerConnections.set(userId, pc);
    } else {
      this.debugLog(`Using existing peer connection for ${userId}`, {
        signaling: pc.signalingState,
        ice: pc.iceConnectionState,
        connection: pc.connectionState
      });
    }
    
    return pc;
  }

  private addLocalTracks(pc: RTCPeerConnection): void {
    if (!this.localStream) {
      this.debugLog('No local stream to add');
      return;
    }

    try {
      const existingTracks = new Set(
        pc.getSenders()
          .map(s => s.track)
          .filter(Boolean)
      );

      // Add audio track
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack && !existingTracks.has(audioTrack)) {
        pc.addTrack(audioTrack, this.localStream);
        this.debugLog('Added audio track to peer connection');
      }

      // Add video track (or screen share track)
      const videoSource = this.callState.isScreenSharing && this.screenStream 
        ? this.screenStream 
        : this.localStream;
      
      const videoTrack = videoSource.getVideoTracks()[0];
      if (videoTrack && !existingTracks.has(videoTrack)) {
        pc.addTrack(videoTrack, videoSource);
        this.debugLog(`Added ${this.callState.isScreenSharing ? 'screen share' : 'camera'} video track to peer connection`);
      }
    } catch (error) {
      this.debugLog('Error adding local tracks:', error);
    }
  }

  async handleOffer(offer: RTCSessionDescriptionInit, senderId: string): Promise<void> {
    this.debugLog(`Received offer from ${senderId}`, offer);
    
    try {
      // Check for duplicate offer
      const existingPc = this.peerConnections.get(senderId);
      if (existingPc && existingPc.signalingState !== 'stable') {
        this.debugLog(`Already processing offer from ${senderId}. Ignoring duplicate.`);
        return;
      }

      // Get WebRTC config if not already loaded
      if (this.iceServers.length === 0) {
        await this.getWebRTCConfig();
      }

      // Update call state for incoming call
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
          
          this.attachLocalStream();
        } catch (error) {
          this.debugLog('Error getting user media:', error);
          this.snackBar.open('Failed to access camera/microphone', 'OK', {
            duration: 3000
          });
          return;
        }
      }

      // Get or create peer connection
      const pc = this.getOrCreatePeerConnection(senderId);
      
      // Clean up any existing tracks
      pc.getSenders().forEach(sender => {
        if (!sender.track) {
          pc.removeTrack(sender);
        }
      });

      // Add local tracks
      this.addLocalTracks(pc);

      // Set remote description
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      // Process any queued ICE candidates
      const queued = this.pendingIce.get(senderId);
      if (queued) {
        this.debugLog(`Processing ${queued.length} queued ICE candidates for ${senderId}`);
        for (const candidate of queued) {
          try {
            await pc.addIceCandidate(candidate);
          } catch (e) {
            this.debugLog(`Failed to add queued ICE candidate:`, e);
          }
        }
        this.pendingIce.delete(senderId);
      }

      // Create and send answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.websocketService.send({
        type: 'answer',
        answer: answer,
        target: senderId,
        sender: this.userId
      });
      
      this.debugLog(`Sent answer to ${senderId}`);

      this.callState.isCallActive = true;
      this.callState.isRinging = false;
      this.safeDetectChanges();
      
    } catch (error: any) {
      this.debugLog('Error handling offer:', error);
      
      if (error.name === 'InvalidStateError') {
        this.debugLog(`InvalidStateError in handleOffer for ${senderId}. Cleaning up.`);
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
      this.debugLog(`Received answer from ${senderId}`, answer);
      
      const pc = this.peerConnections.get(senderId);
      if (!pc) {
        this.debugLog(`No peer connection found for: ${senderId}`);
        return;
      }
      
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      
      // Process any queued ICE candidates
      const queued = this.pendingIce.get(senderId);
      if (queued) {
        this.debugLog(`Processing ${queued.length} queued ICE candidates after answer for ${senderId}`);
        for (const candidate of queued) {
          try {
            await pc.addIceCandidate(candidate);
          } catch (e) {
            this.debugLog(`Failed to add queued ICE candidate:`, e);
          }
        }
        this.pendingIce.delete(senderId);
      }
      
      this.callState.isRinging = false;
      this.callState.isCallActive = true;
      this.safeDetectChanges();
      
      this.debugLog(`Successfully processed answer from ${senderId}`);
    } catch (error) {
      this.debugLog('Error handling answer:', error);
    }
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit, senderId: string) {
    this.debugLog(`Received ICE candidate from ${senderId}`, candidate);
    
    const pc = this.peerConnections.get(senderId);
    
    if (!pc) {
      this.debugLog(`No peer connection for ${senderId}, queuing candidate`);
      if (!this.pendingIce.has(senderId)) {
        this.pendingIce.set(senderId, []);
      }
      this.pendingIce.get(senderId)!.push(candidate);
      return;
    }

    try {
      // Try to add candidate
      await pc.addIceCandidate(candidate);
      this.debugLog(`Successfully added ICE candidate for ${senderId}`);
    } catch (error) {
      this.debugLog(`Failed to add ICE candidate for ${senderId}:`, error);
      
      // Queue candidate if remote description isn't set yet
      if (!pc.remoteDescription) {
        if (!this.pendingIce.has(senderId)) {
          this.pendingIce.set(senderId, []);
        }
        this.pendingIce.get(senderId)!.push(candidate);
        this.debugLog(`Queued ICE candidate for ${senderId} (no remote description)`);
      }
    }
  }

  async handleUserJoined(userId: string) {
    try {
      // Don't create connection to self
      if (userId === this.userId) return;

      this.debugLog(`User joined: ${userId}`);

      // Add user to list
      if (!this.callState.users.some(u => u.id === userId)) {
        this.callState.users.push({
          id: userId,
          name: userId
        });
      }

      // If we're already in a call, create peer connection for new user
      if (this.callState.isCallActive && this.localStream) {
        const pc = this.getOrCreatePeerConnection(userId);
        
        // Clean up any existing tracks
        pc.getSenders().forEach(sender => {
          if (!sender.track) {
            pc.removeTrack(sender);
          }
        });

        // Add local tracks
        this.addLocalTracks(pc);
        
        // Create and send offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        this.websocketService.send({
          type: 'offer',
          offer,
          target: userId
        });
        
        this.debugLog(`Sent offer to newly joined user ${userId}`);
      }
      
      this.safeDetectChanges();
    } catch (error) {
      this.debugLog('Error handling user joined:', error);
    }
  }

  handleUserLeft(userId: string) {
    this.debugLog(`User left: ${userId}`);
    
    // Remove user from list
    this.callState.users = this.callState.users.filter(u => u.id !== userId);
    
    // Close and remove peer connection
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
      this.debugLog(`Closed peer connection for ${userId}`);
    }
    
    // If all users left, end call
    if (this.callState.users.length === 0) {
      this.debugLog('All users left, ending call');
      this.endCall();
    }
    
    this.safeDetectChanges();
  }

  handleScreenSharing(senderId: string, isSharing: boolean) {
    this.debugLog(`Screen sharing update from ${senderId}: ${isSharing}`);
    
    const user = this.callState.users.find(u => u.id === senderId);
    if (user) {
      user.isSharingScreen = isSharing;
    }
    this.safeDetectChanges();
  }

  handleCallRequest(senderId: string, senderName: string): void {
    this.debugLog(`Incoming call request from ${senderId} (${senderName})`);
    
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
    
    this.safeDetectChanges();
  }

  acceptIncomingCall(senderId: string): void {
    if (!senderId) {
      this.snackBar.open('Invalid call request', 'OK', {
        duration: 3000
      });
      return;
    }

    this.debugLog(`Accepting incoming call from ${senderId}`);

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
    
    this.safeDetectChanges();
  }

  rejectIncomingCall(senderId: string): void {
    if (!senderId) {
      this.snackBar.open('Invalid call request', 'OK', {
        duration: 3000
      });
      return;
    }

    this.debugLog(`Rejecting incoming call from ${senderId}`);

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
    
    this.safeDetectChanges();
  }

  async handleCallResponse(accepted: boolean, senderId: string): Promise<void> {
    this.debugLog(`Call response from ${senderId}: ${accepted ? 'accepted' : 'rejected'}`);
    
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
            
            this.attachLocalStream();
          } catch (error) {
            this.debugLog('Error getting user media:', error);
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
        
        this.debugLog(`Sent offer to ${senderId} after call acceptance`);
        
        this.snackBar.open('Call accepted! Connecting...', 'OK', {
          duration: 3000
        });
        
      } catch (error) {
        this.debugLog('Error handling call response:', error);
        this.snackBar.open('Failed to establish connection', 'OK', {
          duration: 3000
        });
        this.endCall();
      }
      
    } else {
      // Rejection handling
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
    
    this.safeDetectChanges();
  }

  async startCall() {
    try {
      this.debugLog('Starting call...');
      
      this.callState.isInCall = true;
      this.callState.isRinging = true;
      this.safeDetectChanges();
      
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
      this.attachLocalStream();

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

      this.debugLog('Call started successfully');

    } catch (error) {
      this.debugLog('Error starting call:', error);
      this.snackBar.open('Failed to start call. Please check camera/microphone permissions.', 'OK', {
        duration: 5000
      });
      this.endCall();
    }
  }

  async initiateCall(targetUser: any): Promise<void> {
    try {
      this.debugLog(`Initiating call to ${targetUser.id}`);
      
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
      this.attachLocalStream();
      
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
      
      this.safeDetectChanges();
      
      // Set timeout for call request
      setTimeout(() => {
        if (this.callState.isRinging && !this.callState.isCallActive) {
          this.debugLog(`Call timeout to ${targetUser.id}`);
          this.snackBar.open('No response from user. Call timed out.', 'OK', {
            duration: 5000
          });
          this.endCall();
        }
      }, 30000);
      
    } catch (error) {
      this.debugLog('Error initiating call:', error);
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
            this.debugLog(`Replaced video track with screen share for ${userId}`);
          }
        });

        // Handle screen sharing stop
        videoTrack.onended = () => {
          this.debugLog('Screen sharing ended by user');
          this.toggleScreenShare();
        };

        this.callState.isScreenSharing = true;
        
        // Notify others
        this.websocketService.send({
          type: 'screen-sharing',
          isSharing: true,
          sender: this.userId
        });

        this.debugLog('Started screen sharing');

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
              this.debugLog(`Replaced screen share with camera for ${userId}`);
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

        this.debugLog('Stopped screen sharing');
      }
      
      this.safeDetectChanges();
    } catch (error) {
      this.debugLog('Screen sharing error:', error);
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
        this.debugLog(`Toggled mute: ${this.callState.isMuted ? 'muted' : 'unmuted'}`);
      }
    }
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.callState.isVideoOn = videoTrack.enabled;
        this.debugLog(`Toggled video: ${this.callState.isVideoOn ? 'on' : 'off'}`);
      }
    }
  }

  copyRoomId(): void {
    navigator.clipboard.writeText(this.roomId).then(() => {
      this.snackBar.open('Room ID copied to clipboard!', 'OK', {
        duration: 3000
      });
    }).catch(err => {
      this.debugLog('Failed to copy room ID:', err);
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
        this.debugLog("User details response:", res);
        if(res.data && res.data.id){
          this.initiateCall({
            id: res.data.id,
            name: username
          });
        }else {
          alert("User not found");
        }
      });
    }
  }

  endCall() {
    this.debugLog('Ending call...');
    
    // Stop all media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
      this.debugLog('Stopped local stream');
    }
    
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
      this.debugLog('Stopped screen stream');
    }
    
    // Close all peer connections
    this.peerConnections.forEach((pc, userId) => {
      pc.close();
      this.debugLog(`Closed peer connection for ${userId}`);
    });
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
    this.pendingRemoteStreams.clear();
    this.pendingIce.clear();
    
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
    this.safeDetectChanges();
    
    this.debugLog('Call ended completely');
  }

  playVideo(videoElement: HTMLVideoElement | null) {
    if (videoElement) {
      videoElement.play().catch(err => {
        this.debugLog('Video play failed:', err);
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
}