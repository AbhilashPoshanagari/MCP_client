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
import { NamedItem, OpenAIFunctions } from './common';
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import { RunnableSequence } from "@langchain/core/runnables";
import { ElicitationComponent } from './components/elicitation/elicitation.component';
import { McpElicitationService } from './services/mcp/mcp-elicitation.service';
import { DomainDialogComponent } from './components/domain-dialog/domain-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { StorageService } from './services/storage.service';
import { OpenAITool } from './constants/toolschema';
import { TableLayout } from './components/models/message.model';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
interface DialogData {
  page: string;
  server: string;
  open_ai_token: string;
}
@Component({
  selector: 'app-root',
  imports: [InputBoxComponent, ChatbotComponent, SidebarComponent, MatSidenavModule, McpClientComponent,
    MatButtonModule, MatIconModule, MatToolbarModule, MatListModule, ElicitationComponent, 
    MatProgressBarModule, MatProgressSpinnerModule],
  standalone: true,
  providers: [McpService, McpElicitationService],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,

})
export class AppComponent implements OnDestroy {
  @ViewChild('chatComponent') chatComponent!: ChatbotComponent;
  messages: any[] = [];
  title = 'AI powered chatbot';
  // isSidebarOpen = false;
  isSidebarOpen = false;
  isMobileScreen = false;

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

  constructor(private mcpService: McpService, private openAIService: OpenAiService, 
    private storageService: StorageService,
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
    this.isMobileScreen = window.innerWidth <= 768; // You can adjust this breakpoint
  }

private initializeSidebarState() {
    // Set sidebar state based on screen size
    if (this.isMobileScreen) {
      this.isSidebarOpen = false;
    } else {
      this.isSidebarOpen = true;
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

  InitializeLLM(token: string, tools: OpenAITool[] = []){
        this.llm_model = this.openAIService.getOpenAiClient(token)  
        if (tools.length > 0){
            try {
                this.llm_with_tools = this.openAIService.openAImodels("langchain", 
                this.llm_model,
                tools,
                this.system_prompt,
                this.human_prompt
                );
                this.llm_runnable = RunnableSequence.from([
                        this.llm_with_tools.overall_prompt,
                        this.llm_with_tools.model_with_tools
                      ]);

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

toolsList(tools: OpenAITool[]){
  this.InitializeLLM(this.openAiKey(), tools)
}

testTool(tool: NamedItem | null){
  if(tool){
    this.selectedTool = tool;
    // Only open sidebar on mobile
    if (this.isMobileScreen) {
      this.isSidebarOpen = true;
    }
    this.mcpElicitationService.createFormFromSchema(tool.inputSchema, "Tool test")
  }else {
    this.selectedTool = null;
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
  }else{

  }
  // setTimeout(() => {
  //   this.chatComponent.scrollToBottom(); // Force scroll
  // }, 0);
}

tool_request(form: {request: string}){
  // this.isSidebarOpen = false;
   // Only close sidebar on mobile
  if (this.isMobileScreen) {
    this.isSidebarOpen = false;
  }
  this.chatMessages.push({
        role: 'user',
        content: form.request,
        timestamp: new Date()
      });
}

async agentWorkflow(userInput: string) {
   if (this.destroyed) return;
  let fullChunk: AIMessageChunk | null = null;
  // let inputMessages: Array<any> = []
  // const usedTools = new Set<string>();
  this.inputMessages.push({ role: 'user', content: userInput });
  this.chatMessages.push({ role: 'user', content: userInput, timestamp: new Date() });
  console.log("all input message : ", this.inputMessages)

  try {
    let continueLoop = true;
    let iteration = 0;
    const usedTools = new Set<string>();
      
      // Count total tools that will be used in this workflow
      // const estimatedTotalTools = 5; // You can adjust this based on your logic
      // let currentToolCount = 0;
      // Show loader at the start
    this.setLoadingState(true);
    this.updateProgress(0, 1); // Start with 0/1
    while (continueLoop && iteration < 20 && !this.destroyed) { // safety limit
      iteration++;

      // Create abort controller for this stream
        const abortController = new AbortController();
      try {
      const stream = await this.llm_runnable.stream({ input: this.inputMessages }, { signal: abortController.signal });
      this.activeStream = stream;
      fullChunk = null;
      this.chatMessages.push({ role: 'bot', content: '', timestamp: new Date() });
      for await (const chunk of stream) {
        if (this.destroyed) {
              abortController.abort();
              break;
            }
        if (chunk instanceof AIMessageChunk) {
          fullChunk = fullChunk ? fullChunk.concat(chunk) : chunk;
          const lastIndex = this.chatMessages.length - 1;
          this.chatMessages[lastIndex].content = fullChunk.content;
          this.cdr.detectChanges();
          setTimeout(() => {
              if (!this.destroyed) {
                  this.chatComponent.scrollToBottom();
                }
            }, 0);
        }
      }
      } catch (streamError: any) {
          if (streamError.name === 'AbortError') {
            console.log('Stream aborted due to component destruction');
            return;
          }
          throw streamError;
        }finally {
          this.activeStream = null;
        }

      if (this.destroyed) break;
      // Check for tool calls
      const toolCalls = fullChunk?.tool_calls ?? [];

      if (toolCalls.length === 0) {
        // No more tools → stop loop
        continueLoop = false;
        break;
      }
      
      // Process tools once per iteration
      // Update total tools for progress calculation
      this.updateProgress(0, toolCalls.length);

      // for (const toolCall of toolCalls) {
      for (let i = 0; i < toolCalls.length; i++) {
        if (this.destroyed) break;

        const toolCall = toolCalls[i];
        const toolName = toolCall.name;
        const toolArgs = toolCall.args;

        // Avoid repeating same tool
        if (usedTools.has(toolName)) {
          console.warn(`Skipping repeated tool: ${toolName}`);
          continueLoop = false;
          break;
        }
        usedTools.add(toolName);
        this.updateProgress(i+1, toolCalls.length);
        this.setLoadingState(true);
        // Call MCP tool
        try {
        const ragResponse = await this.mcpService.callTool(toolName, toolArgs);
        this.setLoadingState(false);
        const toolOutput = Array.isArray(ragResponse?.content)
          ? ragResponse.content.map((c: { type: string; text: string }) => c.text).join('\n')
          : JSON.stringify(ragResponse);
          // console.log("Tool response : ", toolOutput);
            try {
              const extract_results = JSON.parse(ragResponse["content"][0]["text"])
              // console.log("Extract Results : ", extract_results);
                const server_keys = Object.keys(extract_results);
                // console.log("Extract Results : ", server_keys);
                if(server_keys.includes("layouts")){

                    // Create response with only specific fields (excluding layouts)
                    const { layouts, ...contentWithoutLayouts } = extract_results;

                    this.chatMessages.push({
                        role: 'bot',
                        content: "```json \n " + JSON.stringify(contentWithoutLayouts, null, 2) + "\n```",
                        layouts: extract_results.layouts,
                        timestamp: new Date(),
                      });
                console.log("check : ", this.chatMessages)
                }else {
                this.chatMessages.push({
                    role: 'bot',
                    content: "```json \n " + toolOutput + "\n```",
                    timestamp: new Date(),
                  });
                }
            } catch (parseError) {
              // Handle plain text response
              this.chatMessages.push({
                    role: 'bot',
                    content: toolOutput,
                    timestamp: new Date(),
                  });              
            }

        // Add tool call + output back to LLM context
        this.inputMessages.push({
          role: 'assistant',
          type: 'function_call',
          id: toolCall.id,
          name: toolName,
          arguments: JSON.stringify(toolArgs)
        });

        this.inputMessages.push({
          role: 'tool',
          type: 'function_call_output',
          id: toolCall.id,
          output: toolOutput,
        });
        } catch (toolError) {
          console.error(`Tool ${toolName} error:`, toolError);
          
          this.chatMessages.push({
            role: 'bot',
            content: `Error executing tool ${toolName}: ${toolError}`,
            timestamp: new Date(),
          });
          
          continueLoop = false;
          break;
        }

      }
      console.log("input messages : ", this.inputMessages);
    }
  } catch (error) {
     if (this.destroyed) return;
    console.error("Agent workflow error:", error);
    this.chatMessages.push({
      role: 'bot',
      content: 'Sorry, something went wrong while processing your request.',
      timestamp: new Date(),
    });
  }finally {
    // Always hide loader and reset progress when done
    if (!this.destroyed) {
      this.setLoadingState(false);
      this.updateProgress(0, 0);
    }
  }
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

}
