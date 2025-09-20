import { Component, OnInit, EventEmitter, OnDestroy, Output, signal, model, inject } from '@angular/core';
import { McpService } from '../services/mcp.service';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { McpElicitationService } from '../services/mcp/mcp-elicitation.service';
import { OpenAITool } from '../constants/toolschema';
import { StorageService } from '../services/storage.service';
import { MatDialog } from '@angular/material/dialog';
import { DomainDialogComponent } from '../components/domain-dialog/domain-dialog.component';

interface ElicitResponse {
  action: 'accept' | 'decline' | 'cancel';
  data?: any;
}
@Component({
  selector: 'app-mcp-client',
  imports: [CommonModule, FormsModule],
  templateUrl: './mcp-client.component.html',
  styleUrls: ['./mcp-client.component.css'],
  standalone: true
})
export class McpClientComponent implements OnInit, OnDestroy {
  isConnected: boolean = false;
  notifications: any[] = [];
  currentElicitRequest: any = null;
  loader: boolean = false;
  private subscriptions: Subscription[] = [];
  readonly mcpServer = model('');
  readonly openAiKey = model('');
  readonly dialog = inject(MatDialog);
  mcp_props = {
          title: 'Connect to MCP Server',
          message: 'Please enter the MCP server URL to connect.',
          placeholder: 'Enter MCP server URL',
          confirmText: 'Connect',
          cancelText: 'Cancel',
          domain: this.mcpServer() || '',
          page: 'mcp_server'
        };
  openai_props = {
        title: 'Connect to LLM',
        message: 'Please enter the OpenAI API key to connect to the LLM service.',
        placeholder: 'Enter OpenAI API key here',
        confirmText: 'Connect',
        cancelText: 'Cancel',
        domain: this.openAiKey() || '',
        page: 'open_ai_token'
      };
  @Output() tools = new EventEmitter<OpenAITool[]>();
  @Output() sendOpenAiKey = new EventEmitter<string>();

  constructor(private mcpService: McpService, 
    private storageService: StorageService,
    private elicitationService: McpElicitationService) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.mcpService.connectionStatus$.subscribe((status: boolean) => {
        console.log("MCP client component : ", status);
        this.isConnected = status;
      }),
      
      this.mcpService.notifications$.subscribe((notification: any) => {
        this.notifications.push(notification);
      }),
      
      this.mcpService.elicitRequests$.subscribe((request: any) => {
        console.log("Request : ", request);
        this.currentElicitRequest = request;
      })
    );
    this.mcpServer.set(this.storageService.getValueFromKey('mcp_server') || '');
    this.openAiKey.set(this.storageService.getValueFromKey('open_ai_token') || '');
    if(this.mcpServer()){
    setTimeout(() => {
          this.connect(this.mcpServer());
    }, 200);
    }else{
      this.openDomainDialog(this.mcp_props);
    }

  }

  async connect(url: string) {
    console.log("Connecting to MCP server : ", url);
    try {
      this.loader = true;
      await this.mcpService.connect(url);
      this.mcpService.tools$.subscribe(tools => {
        const openai_tools = this.mcpService.createOpenAiToolSchema(tools);
        this.tools.emit(openai_tools);
      });
      this.loader = false;
    } catch (error) {
      console.error('Connection error:', error);
      this.loader = false;
    }
  }

  async disconnect() {
    await this.mcpService.disconnect();
  }

  submitElicitForm(formData: any) {
    if (this.currentElicitRequest) {
      const requestId: number | string | null = this.elicitationService.getCurrentRequestId();
      this.mcpService.submitElicitResponse({
        action: 'accept',
        content: formData
      });
      console.log("Server response : ",{
        action: 'accept',
        content: formData
      })
      this.currentElicitRequest = null;
    }
  }

  cancelElicit() {
    this.mcpService.submitElicitResponse({
      action: 'cancel',
    });
    this.currentElicitRequest = null;
  }

   openDomainDialog(props_options: any) {
        const dialogRef = this.dialog.open(DomainDialogComponent, {
          width: '500px',
          disableClose: false, // Prevent closing without input
          data: props_options
        });
    
        dialogRef.afterClosed().subscribe((result) => {
          if (result.server) {
            this.mcpServer.set(result.server);
            if(result.page === 'mcp_server'){
              this.storageService.saveValuesInKey('mcp_server', result.server );
              this.connect(result.server);
            }else if(result.page === 'open_ai_token'){
              this.openAiKey.set(result.server);
              this.storageService.saveValuesInKey('open_ai_token', result.server );
            }
          }
        });
      }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.disconnect();
  }
}