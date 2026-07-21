import { Component, OnInit, EventEmitter, OnDestroy, Output, signal, model, inject, Input, ChangeDetectionStrategy } from '@angular/core';
import { McpService } from '../services/mcp.service';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { McpElicitationService } from '../services/mcp/mcp-elicitation.service';
import { OpenAITool } from '../constants/toolschema';
import { StorageService } from '../services/storage.service';
import { MatDialog } from '@angular/material/dialog';
import { DomainDialogComponent } from '../components/domain-dialog/domain-dialog.component';
import { ToolformatterService } from '../services/toolformatter.service';
import { DynamicStructuredTool } from 'langchain';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../services/auth.service';
import { WebSocketService } from '../services/websocket.service';

interface ElicitResponse {
  action: 'accept' | 'decline' | 'cancel';
  data?: any;
}

@Component({
  selector: 'app-mcp-client',
  imports: [CommonModule, FormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatBadgeModule,
    MatProgressSpinnerModule],
  templateUrl: './mcp-client.component.html',
  // templateUrl: './mcp-client-sidemenu.component.html',
  styleUrls: ['./mcp-client.component.css'],
  // styleUrls: ['./mcp-client-sidemenu.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true
})
export class McpClientComponent implements OnInit, OnDestroy {
  @Input() displayMode: 'sidebar' | 'header' = 'sidebar';
  @Output() newChatRequested = new EventEmitter<void>();

  // UI State
  showOpenAiConfig = false;
  showNotificationsPanel = false;
  showMCPConfigDialog = false;
  showOpenAiKey = false;

  // Data
  isConnected: boolean = false;
  notifications: any[] = [];
  currentElicitRequest: any = null;
  loader: boolean = false;
  selectedTool: any = null;
  availableTools: any[] = [];
  mcpServerUrl = '';
  openAiKeyValue = '';

  private subscriptions: Subscription[] = [];
  readonly mcpServer = model('');
  readonly openAiKey = model('');
  readonly mediaServer = model('');
  readonly webSocketServer = model('');
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

  media_props = {
    title: 'Connect to Media Server',
    message: 'Please enter the Media Server URL to connect.',
    placeholder: 'Enter Media Server URL here',
    confirmText: 'Connect',
    cancelText: 'Cancel',
    domain: this.mediaServer() || '',
    page: 'media_server'
  };

  web_socket_props = {
    title: 'Connect to Web Socket Server',
    message: 'Please enter the Web Socket Server URL to connect.',
    placeholder: 'Enter Web Socket Server URL here',
    confirmText: 'Connect',
    cancelText: 'Cancel',
    domain: this.webSocketServer() || '',
    page: 'web_socket_server'
  };
  // Add notification handling in MCP client
  @Output() notificationsChange = new EventEmitter<any[]>();
  @Output() unreadCountChange = new EventEmitter<number>();

  // When notifications are updated
  private unreadCount = 0;

  @Output() tools = new EventEmitter<{open_ai_tools: OpenAITool[], langchain_tools: DynamicStructuredTool[]}>();
  @Output() sendOpenAiKey = new EventEmitter<string>();

  constructor(
    private mcpService: McpService, 
    private storageService: StorageService,
    private toolFormatter: ToolformatterService,
    private elicitationService: McpElicitationService,
    private authService: AuthService,
    private webSocketService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.mcpService.connectionStatus$.subscribe((status: boolean) => {
        console.log("MCP client component connection status: ", status);
        this.isConnected = status;
        if (status) {
          this.addNotification('success', 'Connected', 'Successfully connected to MCP server');
        } else {
          this.addNotification('warning', 'Disconnected', 'Disconnected from MCP server');
        }
      }),
      
      this.mcpService.notifications$.subscribe((notification: any) => {
        this.addNotification(
          notification.type || 'info',
          notification.title || 'Notification',
          notification.message || 'New notification'
        );
      }),
      
      this.mcpService.elicitRequests$.subscribe((request: any) => {
        console.log("Elicitation Request: ", request);
        this.currentElicitRequest = request;
        if (request) {
          this.addNotification('info', 'Tool Configuration Required', 
            `${request.tool?.name || 'A tool'} requires configuration`);
        }
      })
    );
    
    // Load saved configurations
    this.loadSavedConfig();
    
    // Subscribe to tools updates
    this.mcpService.tools$.subscribe(tools => {
      if (tools && tools.length > 0) {
        const openai_tools = this.toolFormatter.formatMultipleTools(tools);
        const langChain_tools = this.toolFormatter.convertMultipleTools(tools);
        this.tools.emit({open_ai_tools: openai_tools, langchain_tools: langChain_tools});
        
        // Update available tools for dropdown
        this.availableTools = tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          originalTool: tool
        }));
      }
    });
  }

  // UI Helper Methods
  get connectionTooltip(): string {
    return this.isConnected 
      ? `Connected to ${this.mcpServerUrl}`
      : 'Click Connect to establish connection';
  }

  // Configuration Methods
  toggleOpenAiConfig(openai_props: any): void {
    this.showOpenAiConfig = !this.showOpenAiConfig;
    this.openDomainDialog(openai_props);
  }

  openMCPConfigDialog(): void {
    this.openDomainDialog(this.mcp_props);
  }

  openMediaServerConfigDialog(): void {
    this.openDomainDialog(this.media_props);
  }

  openWebSocketServerConfigDialog(): void {
    this.openDomainDialog(this.web_socket_props);
  }

  closeMCPConfigDialog(): void {
    this.showMCPConfigDialog = false;
  }

  toggleKeyVisibility(): void {
    this.showOpenAiKey = !this.showOpenAiKey;
  }

  saveOpenAiKey(): void {
    if (this.openAiKeyValue) {
      this.openAiKey.set(this.openAiKeyValue);
      this.storageService.saveValuesInKey('open_ai_token', this.openAiKeyValue);
      this.sendOpenAiKey.emit(this.openAiKeyValue);
      this.addNotification('success', 'OpenAI Key saved', 'API key has been saved securely');
    }
  }

  loadSavedConfig(): void {
    const savedMcpServer = this.storageService.getValueFromKey('mcp_server') || '';
    const savedOpenAiKey = this.storageService.getValueFromKey('open_ai_token') || '';
    const savedMediaServer = this.storageService.getValueFromKey('media_server') || '';
    const savedWebSocketServer = this.storageService.getValueFromKey('web_socket_server') || '';

    this.mcpServerUrl = savedMcpServer;
    this.openAiKeyValue = savedOpenAiKey;
    // this.webSocketServerUrl = savedWebSocketServer;
    // this.mediaServerUrl = savedMediaServer;
    
    this.mcpServer.set(savedMcpServer);
    this.openAiKey.set(savedOpenAiKey);
    this.webSocketServer.set(savedWebSocketServer);
    this.mediaServer.set(savedMediaServer);
    if (savedOpenAiKey) {
      this.sendOpenAiKey.emit(savedOpenAiKey);
    }
    
    // Auto-connect if MCP server URL exists
    if (savedMcpServer) {
      setTimeout(() => {
        this.connect(savedMcpServer);
      }, 200);
    } else {
      // Show MCP config dialog if no server URL
      setTimeout(() => {
        this.openDomainDialog(this.mcp_props);
      }, 500);
    }
  }

  // Connection Methods
  toggleConnection(): void {
    if (this.isConnected) {
      this.disconnect();
    } else {
      if (this.mcpServerUrl) {
        this.connect(this.mcpServerUrl);
      } else {
        this.openMCPConfigDialog();
      }
    }
  }

  async connect(url: string) {
    console.log("Connecting to MCP server: ", url);
    try {
      this.loader = true;
      this.addNotification('info', 'Connecting', `Attempting to connect to ${url}...`);
      
      await this.mcpService.connect(url);
      this.loader = false;
      
      // Update MCP server URL
      this.mcpServerUrl = url;
      this.mcpServer.set(url);
      
    } catch (error: any) {
      console.error('Connection error:', error);
      this.loader = false;
      this.addNotification('error', 'Connection Failed', 
        error.message || 'Failed to connect to MCP server');
    }
  }

  async disconnect() {
    this.addNotification('info', 'Disconnecting', 'Disconnecting from MCP server...');
    await this.mcpService.disconnect();
  }

  // Tool Selection
  onToolSelected(tool: any): void {
    this.selectedTool = tool.originalTool;
    this.addNotification('info', 'Tool Selected', `Selected tool: ${tool.name}`);
    
    // If tool requires elicitation, trigger it
    if (tool.originalTool.requiresConfiguration) {
      // This will be handled by the elicitation service subscription
    }
  }

  // Elicitation Methods
  submitElicitForm(formData: any) {
    if (this.currentElicitRequest) {
      const requestId: number | string | null = this.elicitationService.getCurrentRequestId();
      console.log("Elicitation id: ", requestId);
      this.mcpService.submitElicitResponse({
        action: 'accept',
        content: formData
      });
      console.log("Server response: ", {
        action: 'accept',
        content: formData
      });
      this.currentElicitRequest = null;
      this.addNotification('success', 'Configuration Submitted', 'Tool configuration has been submitted');
    }
  }

  cancelElicit() {
    this.mcpService.submitElicitResponse({
      action: 'cancel',
    });
    this.currentElicitRequest = null;
    this.addNotification('warning', 'Configuration Cancelled', 'Tool configuration was cancelled');
  }

  // Notifications Methods
  toggleNotifications(): void {
    this.showNotificationsPanel = !this.showNotificationsPanel;
  }

  addNotification(type: string, title: string, message: string, actions?: any[]): void {
    const notification = {
      id: Date.now(),
      type,
      title,
      message,
      timestamp: new Date(),
      actions,
      read: false
    };
    
    this.notifications.unshift(notification);
    
    // Keep only last 50 notifications
   this.notificationsChange.emit(this.notifications);
    this.unreadCount++;
  
    // Keep only last 50 notifications
    if (this.notifications.length > 50) {
      this.notifications.pop();
      // Adjust unread count if needed
      const unreadPopped = this.notifications.length > 49 ? 
        this.notifications[49]?.read === false : false;
      if (unreadPopped) {
        this.unreadCount = Math.max(0, this.unreadCount - 1);
      }
    }
  }

  clearNotifications(): void {
    this.notifications = [];
  }

  handleNotificationAction(notification: any, action: any): void {
    console.log('Notification action:', notification, action);
    // Handle specific actions here
    if (action.id === 'configure_tool' && this.selectedTool) {
      // Trigger tool configuration
    }
  }

  // New Chat
  startNewChat(): void {
    this.newChatRequested.emit();
    this.addNotification('info', 'New Chat', 'Starting a new chat session');
  }

  // Original Domain Dialog Method (Legacy support)
  openDomainDialog(props_options: any) {
    const dialogRef = this.dialog.open(DomainDialogComponent, {
      width: '500px',
      disableClose: false,
      data: props_options
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && result.server) {
        if (result.page === 'mcp_server') {
          this.mcpServer.set(result.server);
          this.mcpServerUrl = result.server;
          this.storageService.saveValuesInKey('mcp_server', result.server);
          this.connect(result.server);
        } else if (result.page === 'open_ai_token') {
          this.openAiKey.set(result.server);
          this.openAiKeyValue = result.server;
          this.storageService.saveValuesInKey('open_ai_token', result.server);
          this.sendOpenAiKey.emit(result.server);
          this.addNotification('success', 'OpenAI Key Updated', 'API key has been updated');
        } else if (result.page === 'media_server') {
          this.mediaServer.set(result.server);
          this.storageService.saveValuesInKey('media_server', result.server);
          this.authService.setApiUrl();
          this.addNotification('success', 'Media Server Updated', 'Media server URL has been updated');
      } else if (result.page === 'web_socket_server') {
          this.webSocketServer.set(result.server);
          this.storageService.saveValuesInKey('web_socket_server', result.server);
          this.webSocketService.getWebSocketServerUrl();
          this.addNotification('success', 'Web Socket Server Updated', 'Web Socket server URL has been updated');
      }
    }
    });
  }

  // Helper methods for template
  getMCPServer(): string {
    return this.mcpServerUrl;
  }

  openAiKeyString(): string {
    return this.openAiKeyValue;
  }

  // Save OpenAI key from input field
  onOpenAiKeyChange(): void {
    if (this.openAiKeyValue) {
      this.saveOpenAiKey();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    // Don't auto-disconnect on destroy to maintain session
    // this.disconnect();
  }

  updateNotifications(notification: any): void {
    this.notifications.unshift(notification); // Add to beginning
    this.unreadCount++;
    
    // Emit to parent
    this.notificationsChange.emit(this.notifications);
    this.unreadCountChange.emit(this.unreadCount);
  }

  // Add method to mark notifications as read
markNotificationAsRead(notificationId: number): void {
  const notification = this.notifications.find(n => n.id === notificationId);
  if (notification && !notification.read) {
    notification.read = true;
    this.unreadCount = Math.max(0, this.unreadCount - 1);
    this.notificationsChange.emit(this.notifications);
    this.unreadCountChange.emit(this.unreadCount);
  }
}

markAllNotificationsAsRead(): void {
  this.notifications.forEach(notification => {
    if (!notification.read) {
      notification.read = true;
    }
  });
  this.unreadCount = 0;
  this.notificationsChange.emit(this.notifications);
  this.unreadCountChange.emit(this.unreadCount);
}
}