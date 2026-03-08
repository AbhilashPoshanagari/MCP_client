import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ENDPOINTS } from '../constants/apiUrls';
import { RestApiService } from './rest-api.service';
import { StorageService } from './storage.service';

export interface TranscriptionMessage {
  type: 'transcription' | 'ai_response_text' | 'audio_response' | 'mute_state_change';
  text?: string;
  status?: string;
  muted?: boolean;
}

interface OfferResponse {
  sdp: string
  type: RTCSdpType
  pc_id: string
}

@Injectable({
  providedIn: 'root',
})
export class VoiceToTextService {

  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private pcId: string | null = null;
  
  private transcriptionSubject = new Subject<TranscriptionMessage>();
  public transcriptions$ = this.transcriptionSubject.asObservable();
  
  private connectionStateSubject = new Subject<RTCPeerConnectionState>();
  public connectionState$ = this.connectionStateSubject.asObservable();

    // Add mute state tracking
  private isMutedSubject = new BehaviorSubject<boolean>(false);
  public isMuted$ = this.isMutedSubject.asObservable();

  private readonly config: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };
  serverUrl: string = '';
  constructor( private restApiService: RestApiService, 
    private storageService: StorageService ) { 
      this.serverUrl = this.storageService.getValueFromKey('media_server') || "";
  }

  async initializeCall(): Promise<void> {
    try {
      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                noiseSuppression: true, // Enables standard noise suppression
                echoCancellation: true, // Enables acoustic echo cancellation
                // Optional: you can also use goog*** constraints for specific control in Chromium-based browsers, though generally the standard ones are preferred.
                // For example: 'googNoiseSuppression': true
                channelCount: 1
            },
        video: false 
      });

      // Initially unmuted
      this.setMuteState(false);

      // Create peer connection
      this.peerConnection = new RTCPeerConnection(this.config);

      // Add local audio track
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection) {
          this.peerConnection.addTrack(track, this.localStream!);
        }
      });

      // Create data channel
      this.dataChannel = this.peerConnection.createDataChannel('chat', {
                ordered: true
              });
      this.setupDataChannel();

      // Set up event handlers
      this.setupPeerConnectionEvents();

      // Create and send offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Send offer to server
      // const response = await this.http.post<any>('http://localhost:8000/offer', {
      //   sdp: this.peerConnection.localDescription.sdp,
      //   type: this.peerConnection.localDescription.type
      // }).toPromise();
      if(this.peerConnection != null){
          // Send offer to server
          this.restApiService.postRequest(`${this.serverUrl}${ENDPOINTS.AUDIO}/offer`, {
            sdp: this.peerConnection.localDescription?.sdp || '',
            type: this.peerConnection.localDescription?.type || ''
          }).subscribe({
            next: async (response: any) => {
              // Set remote description
              await this.peerConnection?.setRemoteDescription(
                new RTCSessionDescription({ sdp: response.data.sdp, type: response.data.type })
              );

            this.pcId = response.data.pc_id;
            },
            error: (error) => {
              console.error('Error sending offer to server:', error);
            }
          });
      }

    } catch (error) {
      console.error('Error initializing call:', error);
      throw error;
    }
  }

    private setupPeerConnectionEvents(): void {
    if (!this.peerConnection) return;

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.pcId) {
        // Send ICE candidate to server
        this.restApiService.postRequest(`${this.serverUrl}${ENDPOINTS.AUDIO}/ice-candidate`, {
          pc_id: this.pcId,
          candidate: event.candidate
        }).subscribe();
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      // this.ngZone.run(() => {
        if (this.peerConnection) {
          this.connectionStateSubject.next(this.peerConnection.connectionState);
        }
      // });
    };

    this.peerConnection.ontrack = (event) => {
      console.log('Track received:', event.track.kind);
      // Handle incoming audio tracks (for AI responses)
      if (event.track.kind === 'audio') {
        const audioElement = new Audio();
        audioElement.srcObject = new MediaStream([event.track]);
        audioElement.play().catch(e => console.error('Error playing audio:', e));
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };

  }

  private setupDataChannel(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('Data channel opened');
      if(this.dataChannel){
        this.dataChannel.send(JSON.stringify({ type: "start" }));
      }
    };

    this.dataChannel.onclose = () => {
      console.log('Data channel closed');
    };

    this.dataChannel.onmessage = (event) => {
        try {
          const message: TranscriptionMessage = JSON.parse(event.data);
          this.transcriptionSubject.next(message);
        } catch (error) {
          console.error('Error parsing data channel message:', error);
        }
    };
  }

    // New method to toggle mute
  toggleMute(): void {
    const newMuteState = !this.isMutedSubject.value;
    this.setMuteState(newMuteState);
  }

  // New method to set mute state
  private setMuteState(muted: boolean): void {
    if (this.localStream) {
      // Mute/unmute the local audio tracks
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted; // When muted, disable the track
      });
      
      this.isMutedSubject.next(muted);
      
      // Send mute state to server via data channel if connected
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.send(JSON.stringify({
          type: 'mute_state_change',
          muted: muted
        }));
        if (muted) {
        // When user mutes
        this.dataChannel.send(JSON.stringify({ type: "stop" }));
        }else{
        // When user unmutes, you might want to send a message to restart transcription
        this.dataChannel.send(JSON.stringify({ type: "start" }));
        }
      }

      // Add local notification
      // this.transcriptionSubject.next({
      //   type: 'mute_state_change',
      //   muted: muted,
      //   text: muted ? 'Microphone muted' : 'Microphone unmuted'
      // });
    }
  }

  // Get current mute state
  isMuted(): boolean {
    return this.isMutedSubject.value;
  }
    async hangup(): Promise<void> {
    try {
      if (this.pcId) {
        // await this.http.post('http://localhost:8000/hangup', {
        //   pc_id: this.pcId
        // }).toPromise();
        this.restApiService.postRequest(`${this.serverUrl}${ENDPOINTS.AUDIO}/hangup`, {
          pc_id: this.pcId
        }).subscribe();
      }
    } catch (error) {
      console.error('Error during hangup:', error);
    } finally {
      this.cleanup();
    }
  }

  private cleanup(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    this.peerConnection = null;
    this.dataChannel = null;
    this.localStream = null;
    this.pcId = null;
  }
  
}
