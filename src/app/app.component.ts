import { Component, ChangeDetectorRef } from '@angular/core';
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
@Component({
  selector: 'app-root',
  imports: [InputBoxComponent, ChatbotComponent, SidebarComponent, MatSidenavModule, McpClientComponent,
    MatButtonModule, MatIconModule, MatToolbarModule, MatListModule, ElicitationComponent],
  standalone: true,
  providers: [McpService, McpElicitationService],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  messages: any[] = [];
  title = 'AI powered chatbot';
  isSidebarOpen = true;
  chatMessages: any[] = [
    { sender: 'bot', content: 'Hello! How can I assist you today?', timestamp: new Date() }
  ];
  opentAI_functions: OpenAIFunctions[] | undefined;
  llm_model: any;
  llm_with_tools: any;
  errorMessage: string = '';
  system_prompt: string = '';
  human_prompt: string = '';
  llm_runnable: any;
  selectedTool: NamedItem | null = null;
  constructor(private mcpService: McpService, private openAIService: OpenAiService, 
    private mcpElicitationService: McpElicitationService, private cdr: ChangeDetectorRef) {

    this.system_prompt = "You are a helpful assistant. Use tools *only* when needed. \
     If you already have the answer, reply normally instead of calling a tool again.";
    this.human_prompt = "{input}";
    this.openAIService.getOpenAIFunctions().subscribe(result => {
      if (result.status === 200) {
         try {
            this.llm_model = this.openAIService.getOpenAiClient()
            this.llm_with_tools = this.openAIService.openAImodels("langchain", 
            this.llm_model,
            result.open_ai,
            this.system_prompt,
            this.human_prompt
            )
            this.llm_runnable = RunnableSequence.from([
                    this.llm_with_tools.overall_prompt,
                    this.llm_with_tools.mode_with_tools
                  ]);

          } catch (error) {
            
          }
      } else {
        this.errorMessage = result.message;
        console.error('Error loading OpenAI functions:', result.message);
      }
    });
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

// appendMessages(messages: any){
//   this.chatMessages.push({ sender: 'bot', 
//       content: messages,
//       timestamp: new Date() });
// }

testTool(tool: NamedItem | null){
  if(tool){
    console.log("Tool : ", tool)
    this.selectedTool = tool;
    this.mcpElicitationService.createFormFromSchema(tool.inputSchema, "Tool test")
  }else {
    this.selectedTool = null;
  }
  
}

tool_response(form: {request: string, response: string}){
  this.chatMessages.push({
        sender: 'user',
        content: form.request,
        timestamp: new Date()
      });
  this.chatMessages.push({
          sender: 'bot',
          content: form.response,
          timestamp: new Date()
        });
}

async agentWorkflow(userInput: string) {
  // Initial user message
  let processedText: string = '';
  let fullChunk: AIMessageChunk | null = null;
  const inputMessages: any[] = [ { role: 'user', content: userInput }];

 // Optionally add user's question to chat

  this.chatMessages.push({sender: 'user', content: userInput, timestamp: new Date()});
  // First call to the model
  try {
     const firstStream = await this.llm_runnable.stream({ input: inputMessages });
    // Pre-allocate bot message for streaming content
    this.chatMessages.push({ sender: 'bot', content: '', timestamp: new Date() });

    for await (const chunk of firstStream) {
      if (chunk instanceof AIMessageChunk) {
        if (!fullChunk) fullChunk = chunk;
        else fullChunk = fullChunk.concat(chunk);

        const lastIndex = this.chatMessages.length - 1;
        this.chatMessages[lastIndex].content = fullChunk.content;
        this.cdr.detectChanges();
      }
    }
        //  Tool call expected
        if (fullChunk?.tool_calls && fullChunk.tool_calls.length > 0) {
          console.log("Open AI func res : ", firstStream.tool_calls)
          const tool_call = fullChunk.tool_calls[0];  // handle one tool for now

          const toolArgs = tool_call.args;
          const toolName = tool_call.name;

          console.log(`Tool call: ${toolName}(${JSON.stringify(toolArgs)})`);

          const rag_response: any = await this.mcpService.callTool(toolName, toolArgs);
          console.log("rag response : ", rag_response)
          const toolOutput = rag_response["content"].map((content:{type: string, text: string}) => content.text).join('\n');
          // const toolOutput = rag_response["content"][0]["text"].result;
          this.chatMessages.push({sender: 'bot', content: toolOutput, timestamp: new Date() });

          // Add assistant tool_call response
          inputMessages.push({
            type: 'function_call',
            id: tool_call.id,
            name: tool_call.name,
            arguments: JSON.stringify(toolArgs),
          });

          // Add tool output as structured message
          inputMessages.push({
            type: "function_call_output",
            id: tool_call.id,
            output: toolOutput
          });

          // Second call to model with appended context
          const secondResponse = await this.llm_runnable.stream({ input: inputMessages });
          fullChunk = null; // Reset for next stream

          this.chatMessages.push({sender: 'bot', content: '', timestamp: new Date() });
            for await (const chunk of secondResponse) {
              if ( chunk instanceof AIMessageChunk){
                  if (!fullChunk) {
                    fullChunk = chunk;
                  } else {
                    fullChunk = fullChunk.concat(chunk);
                  }
                const lastIndex = this.chatMessages.length - 1;
                this.chatMessages[lastIndex].content = fullChunk.content;
                this.cdr.detectChanges(); // To ensure Angular re-renders it
              }else {
                // this.chatMessages.push({sender: 'bot', content: secondResponse.content, timestamp: new Date() });
              }
            }
        }
    } catch (error) {
    this.chatMessages.push({
      sender: 'bot',
      content: 'Sorry, something went wrong while processing your request.',
      timestamp: new Date()
    });
  }
 
 }


}
