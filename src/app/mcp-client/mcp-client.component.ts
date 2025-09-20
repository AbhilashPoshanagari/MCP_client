import { Component, OnInit, OnDestroy } from '@angular/core';
import { McpService } from '../services/mcp.service';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { McpElicitationService } from '../services/mcp/mcp-elicitation.service';
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

  constructor(private mcpService: McpService, private elicitationService: McpElicitationService) {}

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
    setTimeout(() => {
          this.connect();
    }, 500);
  }

  async connect() {
    try {
      this.loader = true;
      await this.mcpService.connect();
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

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.disconnect();
  }
}