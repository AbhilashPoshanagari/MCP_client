import { Component, ChangeDetectorRef, inject, model, signal, ChangeDetectionStrategy, ViewChild, HostListener, OnDestroy } from '@angular/core';
// import { RouterOutlet } from '@angular/router';
import { McpService } from './services/mcp.service';
import { InputBoxComponent } from './components/input-box/input-box.component';
import { ChatbotComponent } from './components/chatbot/chatbot.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import {MatSidenavModule} from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { OpenAiService } from './services/open-ai.service';
import { McpClientComponent } from './mcp-client/mcp-client.component';
import { NamedItem, OpenAiConfig, OpenAIFunctions } from './common';
import { AIMessageChunk, ToolCall, ToolMessage } from "@langchain/core/messages";
import { RunnableSequence, RunnableWithMessageHistory } from "@langchain/core/runnables";
import { ElicitationComponent } from './components/elicitation/elicitation.component';
import { McpElicitationService } from './services/mcp/mcp-elicitation.service';
import { MatDialog } from '@angular/material/dialog';
import { StorageService } from './services/storage.service';
import { OpenAITool } from './constants/toolschema';
import { TableLayout } from './components/models/message.model';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DynamicStructuredTool, Tool } from 'langchain';
import { ToolformatterService } from './services/toolformatter.service';
import { ChatMessageHistory } from "@langchain/classic/memory";
import { WorkspaceComponent } from './workspace/workspace.component';
import { CdkDrag, CdkDragMove, CdkDropList } from '@angular/cdk/drag-drop';
import { debounceTime, fromEvent } from 'rxjs';
import { CommonModule, DatePipe } from '@angular/common';
// interface CdkDragMoveCall<T = any> {
//   source: CdkDrag<T>;
//   pointerPosition: { x: number; y: number; };
//   event: MouseEvent | TouchEvent;
//   distance: { x: number; y: number; };
//   delta: { x: 0 | 1 | -1; y: 0 | 1 | -1; };
// }
@Component({
  selector: 'app-root',
  imports: [InputBoxComponent, CommonModule, ChatbotComponent, SidebarComponent, MatSidenavModule, McpClientComponent,
    MatButtonModule, MatIconModule, MatToolbarModule, MatListModule, ElicitationComponent, 
    MatProgressBarModule, MatProgressSpinnerModule, WorkspaceComponent, CdkDropList, CdkDrag, DatePipe],
  standalone: true,
  providers: [McpService, McpElicitationService],
  // templateUrl: './app.component.html',
    templateUrl: './app.component-workspace.html',
  styleUrl: './app.component-workspace.css',
  changeDetection: ChangeDetectionStrategy.OnPush,

})
export class AppComponent implements OnDestroy {
  @ViewChild('chatComponent') chatComponent!: ChatbotComponent;
  messages: any[] = [];
  title = 'AI powered chatbot';
  // isSidebarOpen = false;
  isSidebarOpen = true;
  isMobileScreen = false;
  activeLayout: any = null;
   // Add loader and progress bar properties
  isLoading = false;
  currentToolIndex = 0;
  totalTools = 0;
  progressPercentage = 0;

  chatMessages: any[] = [
    { role: 'bot', content: 'Hello! How can I assist you today?', timestamp: new Date() }
  ];
  opentAI_functions: OpenAIFunctions[] | undefined;
  llm_model: any;
  llm_with_tools: any;
  errorMessage: string = '';
  system_prompt: string = '';
  human_prompt: string = '';
  llm_runnable: any;
  selectedTool: NamedItem | null = null;
  streamingContent: string = '';
  readonly page = signal('');
  readonly openAiKey = model('');
  readonly dialog = inject(MatDialog);
  inputMessages: Array<{[key: string]: any}> = [];

  // Add cleanup properties
  private destroyed = false;
  private activeSubscriptions: any[] = [];
  private activeStream: any = null;

  private formSource: 'tool-test' | 'chat' | null = null;
    // New properties for UI improvements
  showElicitationModal = false;
  showChatOnMobile = true;
  chatWidth = 35; // Percentage
  workspaceWidth = 65; // Percentage

  // private toolExecutor: ToolNode;
  private chatHistory: ChatMessageHistory = new ChatMessageHistory();
  private finalRetrievalChain: any;
  notifications: any[] = [];
  unreadNotificationsCount: number = 0;
  showNotificationsModal: boolean = false;
  constructor(private mcpService: McpService, private openAIService: OpenAiService, 
    private storageService: StorageService, private toolFormatter: ToolformatterService,
    private mcpElicitationService: McpElicitationService, private cdr: ChangeDetectorRef) {

    this.checkScreenSize();
    this.initializeSidebarState();

    this.mcpService.mcpServerInstructions$.subscribe((res) => {
    this.system_prompt = res ? res: "You are a helpful assistant. Use tools *only* when needed. \
        If you already have the answer, reply normally instead of calling a tool again.";
    })
     const streamingSubscription = this.mcpService.streaming$.subscribe((stream: any) => {
        if (this.destroyed) return;
        if(stream.status && stream.status === "completed"){
          // Handle completed status if needed
          this.streamingContent += stream.message;
          const lastIndex = this.chatMessages.length - 1;
          this.chatMessages[lastIndex] = this.checkToolCall(this.streamingContent);
          this.cdr.detectChanges();
          this.streamingContent = '';
          // setTimeout(() => {
          //     this.chatComponent.scrollToBottom(); // Force scroll
          //   }, 0);
        }
        else if(stream.status && stream.status === "started"){
          this.streamingContent += stream.message;
          this.chatMessages.push({role: 'bot', content: this.streamingContent, timestamp: new Date()});
          // Use setTimeout to ensure DOM is updated before scrolling
            // setTimeout(() => {
            //   this.chatComponent.scrollToBottom(); // Force scroll
            // }, 0);
        }
        else if(stream.status && stream.status === "in_progress"){
          this.streamingContent += stream.message;
          const lastIndex = this.chatMessages.length - 1;
          this.chatMessages[lastIndex].content = this.streamingContent;
          this.cdr.detectChanges();
            // setTimeout(() => {
            //   this.chatComponent.scrollToBottom(); // Force scroll
            // }, 0);
        }else {

        }
      });

      this.activeSubscriptions.push(streamingSubscription);
    this.human_prompt = "{input}";
    // Initialize with stored token or empty string
    const storedToken = this.storageService.getValueFromKey('open_ai_token') || '';
    this.openAiKey.set(storedToken);
    // Check if we need to show dialog (no token exists)
    if (!storedToken) {
      // Use setTimeout to ensure component is fully initialized
    } else {
      // Only initialize OpenAI if we have a token
      this.InitializeLLM(storedToken);
    }
    // Listen for window resize
  fromEvent(window, 'resize')
    .pipe(debounceTime(100))
    .subscribe(() => {
      this.checkScreenSize();
    });
  }

  ngOnDestroy() {
    this.destroyed = true;
    // Clean up all subscriptions
    this.activeSubscriptions.forEach(sub => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    });
    this.activeSubscriptions = [];
    
    // Clean up active stream
    if (this.activeStream && typeof this.activeStream.return === 'function') {
      this.activeStream.return();
    }
  }

  // Add method to update progress
  private updateProgress(current: number, total: number) {
    if (this.destroyed) return;
    this.currentToolIndex = current;
    this.totalTools = total;
    this.progressPercentage = total > 0 ? Math.round((current / total) * 100) : 0;
    this.cdr.detectChanges();
  }

  // Add method to show/hide loader
  private setLoadingState(loading: boolean) {
     if (this.destroyed) return;
    this.isLoading = loading;
    this.cdr.detectChanges();
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
    this.initializeSidebarState();
  }

  private checkScreenSize() {
    // this.isMobileScreen = window.innerWidth <= 768; // You can adjust this breakpoint
      const mobileBreakpoint = 768;
      const wasMobile = this.isMobileScreen;
      this.isMobileScreen = window.innerWidth < mobileBreakpoint;
      
      // Auto-close sidebar on mobile when switching to mobile mode
      if (this.isMobileScreen && !wasMobile) {
        this.isSidebarOpen = false;
      }
      
      // Auto-open sidebar on desktop when switching from mobile
      if (!this.isMobileScreen && wasMobile) {
        this.isSidebarOpen = false;
      }
  }

private initializeSidebarState() {
    // Set sidebar state based on screen size
    if (this.isMobileScreen) {
      this.isSidebarOpen = false;
    } else {
      this.isSidebarOpen = false;
    }
  }

  checkToolCall(streamingContent: string){
    let final_response: {role: string,
          content: string,
          layouts?: any,
          timestamp: Date} = {
                              role: "bot",
                              content: streamingContent,
                              timestamp: new Date()
                            }
    try {
      const jsonFormat = JSON.parse(streamingContent);
      const server_keys = Object.keys(jsonFormat);
      if(server_keys.includes("function_call")){
        const function_call = jsonFormat.function_call;
        if(function_call.name === "table_layout_tool"){
            const layouts: TableLayout = {
                type: "table",
                data: function_call.parameters
              }
            final_response = {
                role: "bot",
                content: "",
                layouts: [layouts],
                timestamp: new Date()
              }
            }
            else {

            }
          }
      else {
          }
      return final_response;
    } catch (error) {
      return final_response;
    }    
  }

 async InitializeLLM(token: string, tools: OpenAITool[] = [], langchainTools: DynamicStructuredTool[]=[]){
      let options: OpenAiConfig = {
        openAIKey: token
      }
        this.llm_model = this.openAIService.getOpenAiClient(options)  
        if (langchainTools.length > 0){
            try {
                this.llm_with_tools = this.openAIService.openAImodels("langchain", 
                this.llm_model,
                langchainTools,
                this.system_prompt,
                this.human_prompt
                );
                this.llm_runnable = RunnableSequence.from([
                        this.llm_with_tools.overall_prompt,
                        this.llm_with_tools.model_with_tools
                      ]);
              this.finalRetrievalChain = new RunnableWithMessageHistory({
                runnable: this.llm_runnable,
                getMessageHistory: (_sessionId) => this.chatHistory,
                historyMessagesKey: "history",
                inputMessagesKey: "input",
                outputMessagesKey: "output"
              });

              } catch (error) {
                
              }
          } else {
                this.llm_with_tools = this.openAIService.openAImodels("langchain", 
                this.llm_model,
                [],
                this.system_prompt,
                this.human_prompt
                );
                this.llm_runnable = RunnableSequence.from([
                        this.llm_with_tools.overall_prompt,
                        this.llm_with_tools.model_with_out_tools
                      ]);
          }
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

toolsList(tools: {open_ai_tools: Array<OpenAITool>, langchain_tools: Array<DynamicStructuredTool>}){
  this.InitializeLLM(this.openAiKey(), tools.open_ai_tools, tools.langchain_tools)
}
langChainToolList(){

}

testTool(tool: NamedItem | null){
  if(tool){
    this.selectedTool = tool;
    this.formSource = 'tool-test';
    // Only open sidebar on mobile
    if (this.isMobileScreen) {
      this.isSidebarOpen = true;
    }
    this.mcpElicitationService.createFormFromSchema(tool.inputSchema, "Tool test");
  }else {
    this.selectedTool = null;
    this.formSource = null;
  }
  
}

tool_response(form: {response: string, layouts?: Array<any>}){
  if (this.isMobileScreen) {
    this.isSidebarOpen = false;
  }
  if(form.response || form.layouts){
  this.chatMessages.push({
          role: 'bot',
          content: form.response,
          layouts: form.layouts,
          timestamp: new Date()
        });
    }
    this.selectedTool = null;
}

tool_request(form: {request: string}){
  if (this.isMobileScreen) {
    this.isSidebarOpen = false;
  }
  this.chatMessages.push({
        role: 'user',
        content: form.request,
        timestamp: new Date()
      });
}

 async onChatFormSubmitted(event: {toolName: string, params: any}) {
    // Call the tool with form data
    console.log("tool call : ", event.toolName, event.params);
    const formResponse = await this.mcpService.callTool(event.toolName, event.params);
    const toolOutput = Array.isArray(formResponse?.content)
          ? formResponse.content.map((c: { type: string; text: string }) => c.text).join('\n')
          : JSON.stringify(formResponse);
    console.log("form response : ", toolOutput)
    // Reset form source after submission
      this.chatMessages.push({
          role: 'bot',
          content: toolOutput,
          timestamp: new Date()
        });
    this.cdr.detectChanges();
  this.formSource = null;

  }

  // Update the template to show/hide based on precise conditions
  shouldShowMainElicitation(): boolean {
    return this.selectedTool !== null && this.formSource !== 'chat';
  }


async agentWorkflow(userInput: string) {
  if (this.destroyed) return;
  try {
    // UI — add user message
    this.chatMessages.push({
      role: "user",
      content: userInput,
      timestamp: new Date(),
    });

    // Loader
    this.setLoadingState(true);
    this.updateProgress(0, 1); // Start with 0/1

      // ---- 1. RUN AGENT (stream) ----
      const abortController = new AbortController();
      const stream = await this.finalRetrievalChain.stream(
        {
          input: userInput,
          history: await this.chatHistory.getMessages(),
          agent_scratchpad: [],
        },
        { configurable: { sessionId: "test" }, signal: abortController.signal }
      );

      this.activeStream = stream;
      let fullChunk: AIMessageChunk | null = null;

      // UI placeholder for bot message
      this.chatMessages.push({
        role: "bot",
        content: "",
        timestamp: new Date(),
      });
      const lastIndex = this.chatMessages.length - 1;

      for await (const chunk of stream) {
        if (chunk instanceof AIMessageChunk) {
          fullChunk = fullChunk ? fullChunk.concat(chunk) : chunk;

          // UI streaming
          this.chatMessages[lastIndex].content = fullChunk.content;
          this.cdr.detectChanges();
        }
      }

      // ---- 2. Convert fullChunk → Proper AIMessage ----
      // if (!fullChunk) {
      //   continueLoop = false;
      //   break;
      // }

      const toolCalls = fullChunk?.tool_calls ?? [];
      // ---- 3. If no tool calls → exit loop ----
      // if (toolCalls.length === 0) {
      //   // await this.chatHistory.addAIMessage(fullChunk.content as string);
      //   continueLoop = false;
      //   break;
      // }
      this.updateProgress(0, toolCalls.length);
      // ---- 4. Execute Tools ----
      for (const [i, toolCall] of toolCalls.entries()) {
        const toolId = toolCall.id? toolCall.id: `tool-call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        // const toolId = toolCall.id;
        const toolName = toolCall.name;
        const toolArgs = toolCall.args;

        let toolResultText = "";
        this.updateProgress(i+1, toolCalls.length);
        // if (usedTools.has(toolCall.name)) {
        //   console.warn(`Skipping repeated tool: ${toolCall.name}`);
        //   continueLoop = false;
        //   break;
        // }
        try {
          const toolResult = await this.mcpService.callTool(toolName, toolArgs);
          toolResultText = Array.isArray(toolResult?.content)
            ? toolResult.content.map((c:any) => c.text).join("\n")
            : JSON.stringify(toolResult);
          try {
              const extract_results = JSON.parse(toolResult["content"][0]["text"])
              console.log("Extract Results : ", extract_results);
                const server_keys = Object.keys(extract_results);
                // console.log("Extract Results : ", server_keys);
                if(server_keys.includes("layouts")){
                    // Create response with only specific fields (excluding layouts)
                    const { layouts, ...contentWithoutLayouts } = extract_results;
                    this.chatMessages.push({
                        role: 'bot',
                        content: "",
                        layouts: extract_results.layouts,
                        timestamp: new Date(),
                      });
                }else {
                  this.chatMessages.push({
                        role: "bot",
                        content: toolResultText,
                        timestamp: new Date(),
                      });
                }
            } catch (parseError) {    

            }
        } catch (err) {
          toolResultText = `Error: ${err}`;
          this.chatMessages.push({
                        role: "bot",
                        content: toolResultText,
                        timestamp: new Date(),
                      });
        }

        // ---- 5. Add ToolMessage back to memory ----
        const toolMessage = new ToolMessage({
          tool_call_id: toolId,
          status: "success",
          content: toolResultText,
        });

        await this.chatHistory.addMessage(toolMessage);
      }
    // }
  } catch (err) {
    console.error("Agent workflow failed:", err);
    this.chatMessages.push({
      role: "bot",
      content: "Something went wrong while processing your request.",
      timestamp: new Date(),
    });
  } finally {
    this.setLoadingState(false);
    this.activeStream = null;
    this.updateProgress(0, 0);

  }
}


async debugChatHistory() {
  const messages = await this.chatHistory.getMessages();
  // console.log("Chat History Messages:", messages);
  messages.forEach((msg, index) => {
    console.log(`[${index}] ${msg._getType()}:`, {
      content: msg.content,
      tool_calls: (msg as any).tool_calls,
      tool_call_id: (msg as any).tool_call_id,
      name: (msg as any).name
    });
  });
}

// Add this method to your class
cancelOperation() {
  console.log('Cancelling ongoing operation...');
  
  // Set destroyed flag to true to stop all operations
  this.destroyed = true;
  
  // Reset loading state
  this.isLoading = false;
  this.progressPercentage = 0;
  this.currentToolIndex = 0;
  this.totalTools = 0;
  
  // Force change detection
  this.cdr.detectChanges();
  
  // Add cancellation message
  this.chatMessages.push({
    role: 'bot',
    content: 'Operation cancelled by user.',
    timestamp: new Date(),
  });
  
  // Reset destroyed flag after cancellation
  setTimeout(() => {
    this.destroyed = false;
  }, 100);
}

hasLayoutMessages(): boolean {
  // Check if any messages contain layouts (maps, tables, buttons)
  return this.chatMessages.some(message => 
    message.layouts && 
    (this.isTableLayout(message.layouts) || 
     this.isButtonLayout(message.layouts) || 
     this.isMapLayout(message.layouts))
  );
}

// Add these type guard methods if you don't have them
isTableLayout(layouts: any): boolean {
  return layouts.some((layout: any) => layout.type === 'table');
}

isButtonLayout(layouts: any): boolean {
  return layouts.some((layout: any) => layout.type === 'button');
}

isMapLayout(layouts: any): boolean {
  return layouts.some((layout: any) => layout.type === 'map');
}

// Method to handle layout selection from chat
  onLayoutSelected(layout: any): void {
    this.activeLayout = layout;
    if (this.isMobileScreen) {
      this.showChatOnMobile = false;
    }
  }
  
  // Method to clear workspace
  onLayoutClosed(): void {
    this.activeLayout = null;
    if (this.isMobileScreen) {
      this.showChatOnMobile = true;
    }
  }
  
  // Modify the chat message handling to extract layouts
  getChatMessagesWithLayouts(): any[] {
    // Filter messages that have layouts
    return this.chatMessages.filter(message => 
      message.layouts && message.layouts.length > 0
    );
  }

    // Method to open elicitation as modal
  // openElicitationModal(): void {
    // if (tool) {
    //   this.selectedTool = tool;
    // }
  // }
  
  closeElicitationModal(): void {
    this.selectedTool = null;
  }
  
  // Method to toggle chat visibility on mobile
  toggleChatVisibility(): void {
    this.showChatOnMobile = !this.showChatOnMobile;
  }

    // Handle resize drag
  // onResizeDrag(event: CdkDragMove): void {
  //   if (!this.isMobileScreen) {
  //     const containerWidth = document.querySelector('.main-content-wrapper')?.clientWidth || 1000;
  //     const deltaX = event.distance.x;
  //     const deltaPercentage = (deltaX / containerWidth) * 100;
      
  //     // Update widths with constraints
  //     this.chatWidth = Math.max(20, Math.min(80, this.chatWidth + deltaPercentage));
  //     this.workspaceWidth = 100 - this.chatWidth;
  //   }
  // }

  // selectTool(tool: any): void {
  //   this.selectedTool = tool;
  //   this.openElicitationModal(tool);
  // }
// Update the onResizeDrag method with better implementation
onResizeDrag(event: CdkDragMove): void {
  if (!this.isMobileScreen) {
    const container = document.querySelector('.main-content-wrapper') as HTMLElement;
    if (!container) return;
    
    const containerWidth = container.clientWidth;
    const dragPosition = event.pointerPosition.x;
    const containerRect = container.getBoundingClientRect();
    const relativePosition = dragPosition - containerRect.left;
    
    // Calculate percentage
    const newChatWidthPercentage = (relativePosition / containerWidth) * 100;
    
    // Apply constraints (20% to 80%)
    this.chatWidth = Math.max(20, Math.min(80, newChatWidthPercentage));
    this.workspaceWidth = 100 - this.chatWidth;
    
    // Force update the DOM
    this.cdr.detectChanges();
  }
}

  // Add AfterViewInit for drag initialization
  ngAfterViewInit(): void {
    this.setupDragAndDrop();
  }

  private setupDragAndDrop(): void {
    // Ensure drag handles are properly initialized
    setTimeout(() => {
      const dragHandle = document.querySelector('.resize-handle');
      if (dragHandle) {
        // Force reinitialization if needed
        this.cdr.detectChanges();
      }
    }, 100);
  }


    // Handle notifications from MCP client
    onNotificationsUpdate(notifications: any[]): void {
      this.notifications = notifications;
    }

    onUnreadCountUpdate(count: number): void {
      this.unreadNotificationsCount = count;
    }

    // Open/close notifications modal
    openNotificationsModal(): void {
      this.showNotificationsModal = true;
    }

    closeNotificationsModal(): void {
      this.showNotificationsModal = false;
    }

    // Mark notification as read
    markAsRead(notification: any): void {
      notification.read = true;
      this.unreadNotificationsCount = Math.max(0, this.unreadNotificationsCount - 1);
    }

    // Mark all as read
    markAllAsRead(): void {
      this.notifications.forEach(notification => notification.read = true);
      this.unreadNotificationsCount = 0;
    }

    // Clear all notifications
    clearAllNotifications(): void {
      this.notifications = [];
      this.unreadNotificationsCount = 0;
    }

    // Get notification icon based on type
    getNotificationIcon(type: string): string {
      switch(type) {
        case 'success': return 'check_circle';
        case 'error': return 'error';
        case 'warning': return 'warning';
        case 'info': return 'info';
        default: return 'notifications';
      }
    }

    // Get notification icon class
    getNotificationIconClass(type: string): string {
      switch(type) {
        case 'success': return 'success-icon';
        case 'error': return 'error-icon';
        case 'warning': return 'warning-icon';
        case 'info': return 'info-icon';
        default: return '';
      }
    }
}
