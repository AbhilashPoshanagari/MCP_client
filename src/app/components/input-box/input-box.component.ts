import { Component, EventEmitter, Output, OnInit, afterNextRender,
  OnDestroy, inject, Injector, ViewChild, NgZone, ChangeDetectorRef } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
 
// import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatInput, MatInputModule } from '@angular/material/input';
// import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatMenuTrigger } from '@angular/material/menu';
import { McpService } from '../../services/mcp.service';
import { NamedItem } from '../../common'; // Assuming you have a common.ts file for interfaces
import { Subscription } from 'rxjs';
import { filter } from 'rxjs';
import { MatChipsModule } from '@angular/material/chips';
import {CdkTextareaAutosize, TextFieldModule} from '@angular/cdk/text-field';
// import { VoiceToTextComponent } from '../../webRTC/voice-to-text/voice-to-text.component';
import { TranscriptionMessage, VoiceToTextService } from '../../services/voice-to-text.service';

@Component({
  selector: 'app-input-box',
  imports: [FormsModule, ReactiveFormsModule,
    MatMenuModule, MatIconModule, MatInputModule, MatFormFieldModule, MatMenuTrigger, MatChipsModule, TextFieldModule],
  templateUrl: './input-box.component.html',
  styleUrl: './input-box.component.css',
  standalone: true
})
export class InputBoxComponent implements OnInit, OnDestroy {
  private _injector = inject(Injector);
  @ViewChild('autosize') autosize!: CdkTextareaAutosize;
  // @ViewChild('voiceCall') voiceCallComponent!: VoiceToTextComponent;

  @Output() sendMessage = new EventEmitter<string>();
  @Output() sendTool = new EventEmitter<NamedItem | null>();
  @Output() sendResource = new EventEmitter<string>();
  @Output() sendPrompt = new EventEmitter<string>();
  message = '';
  showToolsMenu = false;
  showResourcesMenu = false;
  showPromptsMenu = false;

  tools:Array<NamedItem> = [];
  resources:Array<NamedItem> = [];
  prompts: Array<NamedItem> = [];

  selectedTool: NamedItem | null = null;
  selectedResource: NamedItem | null = null;
  selectedPrompt: NamedItem | null = null;
  isConnected: boolean = false;
  showVoiceCall: boolean = false;
  private subs = new Subscription();

  // Voice component 
  isCallActive = false;
  connectionState: string = 'disconnected';
  messages: { text: string; type: 'user' | 'ai' | 'system' }[] = [];
  
  private transcriptionSubscription!: Subscription;
  private connectionStateSubscription!: Subscription;
  private muteStateSubscription!: Subscription;

  isMuted = false;

  constructor(private mcpService: McpService, private webRTCService: VoiceToTextService,
    private ngZone: NgZone, private cdr: ChangeDetectorRef) {

  }

  ngOnInit(): void {
    this.subs.add(
          this.mcpService.connectionStatus$
            .pipe(filter(status => status === true))  // <--- FIXED HERE
            .subscribe((state) => {
              console.log("mcp input-box : ", state)
              this.subs.add(this.mcpService.tools$.subscribe(tools => this.tools = tools));
              this.subs.add(this.mcpService.promtps$.subscribe(prompts => this.prompts = prompts));
              this.subs.add(this.mcpService.resources$.subscribe(resources => this.resources = resources));
            })
        );
    this.triggerResize();
    this.transcriptionSubscription = this.webRTCService.transcriptions$.subscribe(
        message => this.handleTranscriptionMessage(message)
      );

      this.connectionStateSubscription = this.webRTCService.connectionState$.subscribe(
        state => {
          this.ngZone.run(() => {
            this.connectionState = state;
            // this.addSystemMessage(`Connection state: ${state}`);
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


   triggerResize() {
    // Wait for content to render, then trigger textarea resize.
    afterNextRender(
      () => {
        this.autosize.resizeToFitContent(true);
      },
      {
        injector: this._injector,
      },
    );
  }

  //  submitMessage() {
  //   if (this.message.trim()) {
  //     // Your message submission logic
  //     console.log('Message sent:', this.message.trim());
  //     this.sendMessage.emit(this.message.trim());
  //     this.message = '';
  //   }
  // }

  submitMessage(event?: Event) {
    if (event) {
      event.preventDefault();
    }
    
    if (this.message.trim()) {
      // Your existing submit logic
      this.sendMessage.emit(this.message.trim());
      this.message = '';
    }
  }

  selectTool(selected_tool: NamedItem) {
    if(this.selectedTool){
      this.tools.push(this.selectedTool)
    }
    this.tools = this.tools.filter(tool => tool.name !== selected_tool.name);
    this.selectedTool = selected_tool;
    this.showToolsMenu = false;
    this.sendTool.emit(this.selectedTool)
  }

  selectResource(selected_resource: NamedItem) {
    if(this.selectedResource){
      this.resources.push(this.selectedResource);
    }
    this.resources = this.resources.filter(resource => resource.name !== selected_resource.name);
    this.selectedResource = selected_resource;
    this.showResourcesMenu = false;
    // this.mcpService.readResource()
  }

  selectPrompt(selected_prompt: NamedItem) {
     if(this.selectedPrompt){
      this.prompts.push(this.selectedPrompt);
    }
    this.prompts = this.prompts.filter(prompt => prompt.name !== selected_prompt.name);
    this.selectedPrompt = selected_prompt;
    this.showPromptsMenu = false;
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  clearSelection(selectedItem: string, item: NamedItem){
    switch (selectedItem) {
      case 'prompt':
        this.selectedPrompt = null;
        this.prompts.push(item)
        break;
      case 'resource':
        this.selectedResource = null;
        this.resources.push(item)
      break;
      case 'tool':
        this.selectedTool = null;
        this.tools.push(item)
        this.sendTool.emit(this.selectedTool)
      break;
    
      default:
        break;
    }
  }

  // enableVoiceInput() {
  //   // Implement voice input logic here
  //   console.log('Voice input enabled');
  //   this.showVoiceCall = !this.showVoiceCall;
  // }

  onCallEnded(){
    this.showVoiceCall = false;
  }

async startCall(): Promise<void> {
    this.ngZone.run(async () => {
    try {
      this.ngZone.run(() => {
      this.showVoiceCall = true;
      // this.addSystemMessage('Starting call...');
      });
      await this.webRTCService.initializeCall();
      this.ngZone.run(() => {
      this.isCallActive = true;
      // this.addSystemMessage('Call started successfully');
      this.cdr.detectChanges();
      });
    } catch (error) {
      console.error('Failed to start call:', error);
      this.ngZone.run(() => {
      // this.addSystemMessage('Failed to start call: ' + (error as Error).message);
      this.cdr.detectChanges();
      });
    }
  });
}

  // New method to toggle mute
toggleMute(): void {
    this.webRTCService.toggleMute();
  }

async stopCall(): Promise<void> {
    this.ngZone.run(async () => {
    try {
      await this.webRTCService.hangup();
      this.ngZone.run(() => {
      this.isCallActive = false;
      // this.addSystemMessage('Call ended');
      this.showVoiceCall = false;
      });
    } catch (error) {
      console.error('Error stopping call:', error);
    }
  });
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
            this.sendMessage.emit(message.text.trim());
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
          // this.addSystemMessage('AI is responding with audio...');
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

  // private addSystemMessage(text: string): void {
  //   // this.messages.push({
  //   //   text: text,
  //   //   type: 'system'
  //   // });
  //   // this.sendMessage.emit(text.trim());
  // }

  // clearMessages(): void {
  //   this.messages = [];
  // }
  
}
