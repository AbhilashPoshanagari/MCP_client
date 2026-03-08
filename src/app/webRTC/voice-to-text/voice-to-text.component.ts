import { Component, EventEmitter, Output, NgZone, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { VoiceToTextService, TranscriptionMessage } from '../../services/voice-to-text.service';

@Component({
  selector: 'app-voice-to-text',
  imports: [],
  templateUrl: './voice-to-text.component.html',
  styleUrl: './voice-to-text.component.css',
})
export class VoiceToTextComponent {
  @Output() callEnded = new EventEmitter<void>();
  title = 'WebRTC Voice-to-Text Conversation';
  isCallActive = false;
  connectionState: string = 'disconnected';
  messages: { text: string; type: 'user' | 'ai' | 'system' }[] = [];
  
  private transcriptionSubscription!: Subscription;
  private connectionStateSubscription!: Subscription;
  private muteStateSubscription!: Subscription;

  isMuted = false;

  constructor(private webRTCService: VoiceToTextService, 
    private ngZone: NgZone, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
      this.transcriptionSubscription = this.webRTCService.transcriptions$.subscribe(
        message => this.handleTranscriptionMessage(message)
      );

      this.connectionStateSubscription = this.webRTCService.connectionState$.subscribe(
        state => {
          this.ngZone.run(() => {
            this.connectionState = state;
            this.addSystemMessage(`Connection state: ${state}`);
           });
        }
      );

          // Subscribe to mute state changes
      this.muteStateSubscription = this.webRTCService.isMuted$.subscribe(
        muted => {
          this.ngZone.run(() => {
              this.isMuted = muted;
          });
        }
      );
  }

  ngOnDestroy(): void {
    this.transcriptionSubscription?.unsubscribe();
    this.connectionStateSubscription?.unsubscribe();
    this.muteStateSubscription?.unsubscribe();
    this.stopCall();
  }

  async startCall(): Promise<void> {
    this.ngZone.run(async () => {
    try {
      this.ngZone.run(() => {
      this.addSystemMessage('Starting call...');
      });
      await this.webRTCService.initializeCall();
      this.ngZone.run(() => {
      this.isCallActive = true;
      this.addSystemMessage('Call started successfully');
      this.cdr.detectChanges();
      });
    } catch (error) {
      console.error('Failed to start call:', error);
      this.ngZone.run(() => {
      this.addSystemMessage('Failed to start call: ' + (error as Error).message);
      this.cdr.detectChanges();
      });
    }
  });
  }

  async stopCall(): Promise<void> {
    this.ngZone.run(async () => {
    try {
      await this.webRTCService.hangup();
      this.ngZone.run(() => {
      this.isCallActive = false;
      this.addSystemMessage('Call ended');
      this.callEnded.emit();
      });
    } catch (error) {
      console.error('Error stopping call:', error);
    }
  });
  }

    // New method to toggle mute
  toggleMute(): void {
    this.webRTCService.toggleMute();
  }

  private handleTranscriptionMessage(message: TranscriptionMessage): void {
    this.ngZone.run(() =>{
      switch (message.type) {
        case 'transcription':
          if (message.text) {
            this.messages.push({
              text: `You: ${message.text}`,
              type: 'user'
            });
          }
          break;

        case 'ai_response_text':
          if (message.text) {
            this.messages.push({
              text: `AI: ${message.text}`,
              type: 'ai'
            });
          }
          break;

        case 'audio_response':
          this.addSystemMessage('AI is responding with audio...');
          break;

        // case 'mute_state_change':
        //   if (message.text) {
        //     this.addSystemMessage(message.text);
        //   }
        //   break;

        default:
          console.log('Unknown message type:', message);
      }
            this.cdr.detectChanges();
    });
  }

  private addSystemMessage(text: string): void {
    this.messages.push({
      text: text,
      type: 'system'
    });
  }

  clearMessages(): void {
    this.messages = [];
  }

}
