import { AfterViewInit, Component, ElementRef, EventEmitter, NgZone, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { RestApiService } from '../../services/rest-api.service';
import { StorageService } from '../../services/storage.service';
import { ENDPOINTS } from '../../constants/apiUrls';

@Component({
  selector: 'app-object-detection',
  imports: [],
  templateUrl: './object-detection.component.html',
  styleUrl: './object-detection.component.css',
})
export class ObjectDetectionComponent implements OnInit, OnDestroy, AfterViewInit{
  @ViewChild('localVideo', { static: false }) localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo', { static: false }) remoteVideo!: ElementRef<HTMLVideoElement>;
  @Output() endVideoProcessing = new EventEmitter<void>();
  // processedVideo: boolean = false;

  objectDetectionState: {processing: boolean, isMuted: boolean, isVideoOn: boolean} = {
    processing: false,
    isMuted: false,
    isVideoOn: true,
  };

    private peerConnection: RTCPeerConnection | null = null;
    localStream: MediaStream | null = null;
    private configuration: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      };
  
    isDetecting: boolean = false;
    serverUrl: string = '';
    debug: boolean = false;
  constructor(private restApiService: RestApiService, 
    private ngZone: NgZone,
    private storageService: StorageService) {}

  ngOnInit(): void {
    // Initialize any necessary services or state here
    this.serverUrl = this.storageService.getValueFromKey('media_server') || "";
  }

  ngAfterViewInit(): void {
    // Set up video streams and object detection logic here
    // await this.startCamera();
  }

startCamera(): void {
    // Implement logic to start object detection and video processing
  this.ngZone.run(async () => {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: false 
      });
      const video = this.localVideo.nativeElement;
        video.srcObject = this.localStream;
        await video.play();
      
      } catch (error) {
        console.error('Error accessing camera:', error);
      }
    });

  }

  async startDetection(): Promise<void> {
    if (!this.localStream) {
      await this.startCamera();
    }

    this.isDetecting = true;
    
    try {
      // Create peer connection
      this.peerConnection = new RTCPeerConnection(this.configuration);
      
      // Add local stream to connection
      this.localStream!.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      // Handle remote stream (processed video)
      this.peerConnection.ontrack = async (event) => {
        const processedVideo = this.remoteVideo.nativeElement;
        processedVideo.srcObject = event.streams[0];
        await processedVideo.play();
      };

      // Create and send offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      console.log('Local SDP:', this.peerConnection.localDescription);
      if(this.peerConnection != null && !this.debug) {
        // Send offer to server
        this.restApiService.postRequest(`${this.serverUrl}${ENDPOINTS.MEDIA}/offer`, {
          sdp: this.peerConnection.localDescription?.sdp || '',
          type: this.peerConnection.localDescription?.type || ''
        }).subscribe({
          next: async (response: any) => {
            // Set remote description from server answer
            await this.peerConnection?.setRemoteDescription(
              new RTCSessionDescription(response.data)
            );
          },
          error: (error) => {
            console.error('Error sending offer to server:', error);
            this.isDetecting = false;
          }
        });
      }
    } catch (error) {
      console.error('Error starting detection:', error);
      this.isDetecting = false;
    }
  }

  ngOnDestroy(): void {
    // Clean up any resources, stop video streams, etc.
    this.stopDetection();
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
    
    this.isDetecting = false;
  }

}
