import { Injectable } from '@angular/core';
import { Observable, from, Subject, BehaviorSubject, shareReplay, timeout } from 'rxjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getDisplayName } from '@modelcontextprotocol/sdk/shared/metadataUtils.js';
import { JsonOutputParser, StringOutputParser } from "@langchain/core/output_parsers";
import {
  ListToolsRequest,
  ListToolsResultSchema,
  CallToolRequest,
  CallToolResultSchema,
  ListPromptsRequest,
  ListPromptsResultSchema,
  GetPromptRequest,
  GetPromptResultSchema,
  ListResourcesRequest,
  ListResourcesResultSchema,
  LoggingMessageNotificationSchema,
  ResourceListChangedNotificationSchema,
  ElicitRequestSchema,
  ResourceLink,
  ReadResourceRequest,
  ReadResourceResultSchema,
  ToolSchema,
  PromptSchema,
  ResourceSchema,
  ElicitResultSchema,
  CreateMessageRequestSchema,
  ProgressNotificationSchema,
  ElicitRequest,
  ElicitResult,
  McpError,
  ErrorCode,
  SamplingMessage,
  SamplingMessageContentBlock,
  CreateMessageRequest,
  CreateMessageResult
} from '@modelcontextprotocol/sdk/types.js';
import { ToolformatterService } from './toolformatter.service';
import { OriginalTool, OpenAITool } from '../constants/toolschema';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { OpenAiService } from './open-ai.service';
import { StorageService } from './storage.service';
import { AIMessagePromptTemplate, BaseMessagePromptTemplate, ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
export interface ElicitPrompt {
  requestId: number | string;
  message: string;
  schema: any;
  fields: ElicitField[];
}

export interface ElicitField {
  name: string;
  title: string;
  description?: string;
  type: string;
  required: boolean;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  format?: string;
  default?: any;
}

@Injectable({ providedIn: 'root' })
export class McpService {
  // private serverUrl = urls.mcp_base_url;
  public client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  public sessionId: string | undefined = undefined;
  public notificationCount = 0;
  
  // Subjects for handling events and state
  public connectionStatusSubject = new BehaviorSubject<boolean>(false);
  private notificationsSubject = new Subject<any>();
  private streamingSubject = new Subject<any>();
  private elicitRequestSubject = new Subject<ElicitPrompt>();
  
  // Public observables
  public connectionStatus$ = this.connectionStatusSubject.asObservable();
  // public connectionStatus$ = this.connectionStatusSubject.asObservable().pipe(
  //                           shareReplay({ bufferSize: 1, refCount: true })
  //                         );
  public notifications$ = this.notificationsSubject.asObservable();
  public elicitRequests$ = this.elicitRequestSubject.asObservable();
  public streaming$ = this.streamingSubject.asObservable();
  // Tools 
  private toolsSubject = new BehaviorSubject<Array<any>>([]);
  private promptsSubject = new BehaviorSubject<Array<any>>([]);
  private resourceSubject = new BehaviorSubject<Array<any>>([]);

  private mcpServerInstructionsSubject = new Subject<string | undefined>();
  public mcpServerInstructions$ = this.mcpServerInstructionsSubject.asObservable();

  // Public observables
  public tools$ = this.toolsSubject.asObservable();
  public promtps$ = this.promptsSubject.asObservable();
  public resources$ = this.resourceSubject.asObservable();

  private messageSource = new BehaviorSubject<boolean>(false);
  public currentMessage$ = this.messageSource.asObservable();
  private currentRequest: ElicitPrompt | null = null;

  private elicitResponseSubject = new Subject<any>();
  public elicitResponses$ = this.elicitResponseSubject.asObservable();
  public notificationsToolLastEventId: string | undefined = undefined;

  constructor( private toolformatterService: ToolformatterService, 
    private openai_service: OpenAiService, private storageService: StorageService) {}

  async connect(url: string): Promise<void> {
    let serverUrl = url;
    if (this.client) {
    await this.disconnect(); // Clean up existing connection first
  }

    console.log(`Connecting to ${serverUrl}...`);

    try {
      // Create a new client with elicitation capability
      this.client = new Client({
        name: 'angular-mcp-client',
        version: '1.0.0'
      }, {
        capabilities: {
          elicitation: {
            form: {}
          },
          sampling: {}    
        },
      });

       // Configure transport with proper headers and session management
    this.transport = new StreamableHTTPClientTransport(
      new URL(serverUrl),
      {
        sessionId: localStorage.getItem('mcp_session_id') || undefined,
        requestInit: {
          headers: new Headers ({
            'Accept': 'application/json',
            'Content-Type': 'application/json, text/event-stream'
          }),
          cache: 'no-store', // Disable caching
        },
        reconnectionOptions: {
          maxReconnectionDelay: 30000,
          initialReconnectionDelay: 1000,
          reconnectionDelayGrowFactor: 1.5,
          maxRetries: 3
        }
      },
    );

    // Set up error handler
    this.transport.onerror = async (error) => {
      console.error('Transport error:', error);
      if (error.message.includes('session')) {
        localStorage.removeItem('mcp_session_id');
        this.connectionStatusSubject.next(false)
        this.messageSource.next(false)
        // await this.transport?.terminateSession()
      }
    };

      this.client.onerror = async(error) => {
        console.error('Client error:', error);
        this.notificationsSubject.next({
          type: 'error',
          message: error.message
        });
        this.connectionStatusSubject.next(false)
        this.messageSource.next(false)
        // await this.transport?.terminateSession()
        localStorage.removeItem('mcp_session_id');
      };

      this.initializeElicitationHandler(this.client);
      this.samplingRequestHandler(this.client);
      this.progressNotificationHandler(this.client);
      this.loggingNotificationHandler(this.client);
      this.resourceListChangingHandler(this.client);

      // Connect the client
      await this.client.connect(this.transport, {timeout: 420000, maxTotalTimeout: 600000});
      this.mcpServerInstructionsSubject.next(this.client.getInstructions())
      this.sessionId = this.transport.sessionId;
      if (this.sessionId) {
        localStorage.setItem('mcp_session_id', this.sessionId);
      }
      // console.log('Transport created with session ID:', this.sessionId);
      this.connectionStatusSubject.next(true);
      this.messageSource.next(true)
      // Get tools with custom configuration
      this.listTools()
      this.listPrompts()
      this.listResources()
      // this.completion()
    } catch (error) {
      console.error('Failed to connect:', error);
      this.client = null;
      this.transport = null;
      this.connectionStatusSubject.next(false);
      this.messageSource.next(false)
      this.toolsSubject.next([])
      this.promptsSubject.next([])
      this.resourceSubject.next([])
      throw error; // Re-throw to allow error handling by caller
    }
  }

async completion(argumentName: string, partialValue: string, previousArgument: string = ""){
  // Request completions for any argument
  try {
      const result = await this.client?.complete({
      ref: {
          type: 'ref/prompt', // or "ref/resource"
          name: 'example' // or uri: "template://..."
      },
      argument: {
          name: argumentName,
          value: partialValue // What the user has typed so far
      },
      context: {
          // Optional: Include previously resolved arguments
          arguments: {
              previousArg: previousArgument
          }
      }
  });
  return result;
  } catch (error) {
    throw new Error(`Error : ${JSON.stringify(error)}`);
  }
}

resourceListChangingHandler(client: Client){
  client.setNotificationHandler(ResourceListChangedNotificationSchema, async (_) => {
      console.log('Resource list changed notification received');
      this.notificationsSubject.next({
        type: 'resource-change',
        message: 'Resource list has changed'
      });
      
      try {
        if (!this.client) {
          console.log('Client disconnected, cannot fetch resources');
          return;
        }
        const resourcesResult = await this.client.request({
          method: 'resources/list',
          params: {}
        }, ListResourcesResultSchema);

        this.notificationsSubject.next({
          type: 'resource-list',
          resources: resourcesResult.resources
        });

      } catch (error) {
        console.log('Failed to list resources after change notification', error);
        this.notificationsSubject.next({
          type: 'error',
          message: 'Failed to fetch updated resources'
        });
      }
    });
}

loggingNotificationHandler(client: Client){
    // Set up notification handlers
  client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
      let notificationObject: any = {type: "", message: "", status: ""};
      if(notification.params.data && typeof notification.params.data === 'object'){
        notificationObject = {type: "", message: "", status: ""};
        const keys = Object.keys(notification.params.data);
        notificationObject = notification.params.data;
        for(const key of keys){
          if(notificationObject[key] == "streaming"){
            const notificationMessage = {
                      type: notificationObject[key],
                      level: notification.params.level,
                      message: notificationObject.message,
                      status: notificationObject.status
                    };
            this.streamingSubject.next(notificationMessage);
          }
        }
      }
      else {
        this.notificationCount++;
        const notificationMessage = {
          type: 'log',
          level: notification.params.level,
          message: notification.params.data,
          count: this.notificationCount
        };
          console.log('MCP Notification:', notificationMessage);
        this.notificationsSubject.next(notificationMessage);
      }

    });
}

progressNotificationHandler(client: Client){
  client.setNotificationHandler(ProgressNotificationSchema, (notification) => {
    let notificationObject: any = {type: "", message: "", status: ""};
      if(notification.params.message && typeof notification.params.message === 'object'){
        notificationObject = {type: "", message: "", status: ""};
        const keys = Object.keys(notification.params.message);
        notificationObject = notification.params.message;
        for(const key of keys){
          if(notificationObject[key] == "streaming"){
            const notificationMessage = {
                      type: notificationObject[key],
                      progress: notification.params.progress,
                      total: notification.params.total,
                      message: notificationObject.message,
                      progressToken: notification.params.progressToken,
                      status: notificationObject.status
                    };
            this.streamingSubject.next(notificationMessage);
          }
        }
      }
      else {
    console.log("On progress : ", notification)
      this.notificationCount++;
      const notificationMessage = {
        type: 'log',
        progress: notification.params.progress,
        total: notification.params.total,
        message: notification.params.message,
        progressToken: notification.params.progressToken,
        count: this.notificationCount
      };
      console.log('MCP Notification:', notificationMessage);
      this.notificationsSubject.next(notificationMessage);
    }
  });
}

initializeElicitationHandler(client: Client): void {
  client.setRequestHandler(ElicitRequestSchema, (request: ElicitRequest, extra: RequestHandlerExtra<any, any>): Promise<ElicitResult> => {
    if (request.params.mode && request.params.mode !== 'form') {
            throw new McpError(ErrorCode.InvalidParams, `Unsupported elicitation mode: ${request.params.mode}`);
        }
    // Use the requestId from extra to uniquely identify this request
    const currentRequestId: string | number = extra.requestId;
    // console.log(`Handling elicit request with ID: ${currentRequestId}`);

    // Trigger the UI to show (assuming handleElicitRequest does this)
    const schema = request.params.requestedSchema;
    const fields = this.parseSchemaToFields(schema);
    
    this.elicitRequestSubject.next({
      requestId: currentRequestId,
      message: request.params.message,
      schema: schema,
      fields: fields,
    });
    // console.log("Extras : ", extra);
    
    // Return a Promise that resolves when we get a response from the UI
    return new Promise<ElicitResult>((resolve, reject) => {
      // Track if we've already resolved to prevent duplicate handling
      let isResolved = false;
      // Set up a timeout using setTimeout (simple approach)
      const timeoutDuration = 360000; // 6 minutes
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          subscription.unsubscribe();
          console.warn(`Request ${currentRequestId} timed out after ${timeoutDuration}ms`);
          resolve({
            action: "cancel",
            content: { reason: "Request timeout" }
          });
        }
      }, timeoutDuration);

      const subscription = this.elicitResponses$.subscribe({
        next: (response: ElicitResult) => {
          // Check if this response belongs to the current request
          if (isResolved) {
            console.warn(`Request ${currentRequestId} already resolved, ignoring duplicate response`);
            return;
          }
          isResolved = true;
          // Clean up the subscription
          subscription.unsubscribe();
          console.log("resp : ", response)
          // Return the response in the expected format
          resolve({
            _meta: { requestId: extra.requestId},
            action: response?.action || "cancel",  // Default to cancel if no action
            content: response?.content || {}       // Empty content if none provided
          });
        },
        error: () => {
          if (isResolved) return;
          isResolved = true;
          clearTimeout(timeoutId); // Clear the timeout
          subscription.unsubscribe();
          resolve({
            _meta: {requestId: extra.requestId},
            action: "decline"
          });
        }
      });
      
      // Optional: Handle abort signal
      if (extra.signal) {
        const abortHandler = () => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            subscription.unsubscribe();
            console.log(`Request ${currentRequestId} was aborted`);
            resolve({
              action: "cancel",
              content: { reason: "Request aborted" }
            });
          }
        };
        extra.signal.addEventListener('abort', abortHandler);
      }

    });

  });
}




// Add this method to handle reconnection with existing session
async reconnect(): Promise<void> {
  const storedSessionId = localStorage.getItem('mcp_session_id');
  const mcp_server_url = localStorage.getItem('mcp_server');
  if (storedSessionId && mcp_server_url) {
    this.sessionId = storedSessionId;
    await this.connect(mcp_server_url);
  } else {
    throw new Error('No stored session ID found');
  }
}

samplingRequestHandler(client: Client): void{
  client.setRequestHandler(CreateMessageRequestSchema, ( request: CreateMessageRequest ): Promise<CreateMessageResult> => {
    // Arrays to collect all messages
    const messageTemplates: BaseMessagePromptTemplate[] = [];
    
    console.log(request.params);
    let userInput = "";
    // Add system prompt if available
    if (request.params.systemPrompt) {
      const systemPrompt = typeof request.params.systemPrompt === 'string' 
        ? request.params.systemPrompt 
        : JSON.stringify(request.params.systemPrompt);
      messageTemplates.push(SystemMessagePromptTemplate.fromTemplate(systemPrompt));
    }
    
    // Process all messages in order
    if (request.params.messages && request.params.messages.length > 0) {
      for (let i = 0; i < request.params.messages.length; i++) {
        const message = request.params.messages[i];
        const role = message.role;
        const content = message.content;
        
        let textContent = '';
        
        // Extract text content from different content formats
        if (typeof content === 'object' && !Array.isArray(content) && content.type === 'text' && 'text' in content) {
          textContent = content.text;
        } else if (Array.isArray(content)) {
          const textPart = content.find(c => c.type === 'text' && 'text' in c);
          if (textPart && 'text' in textPart) {
            textContent = textPart.text;
          }
        } else if (typeof content === 'string') {
          textContent = content;
        }
        
        // Create appropriate message template based on role
        if (textContent) {
          if (role === 'assistant') {
            userInput = textContent;
            messageTemplates.push(AIMessagePromptTemplate.fromTemplate(textContent));
          } else if (role === 'user') {
            messageTemplates.push(HumanMessagePromptTemplate.fromTemplate(textContent));
          } else if (role === 'system') {
            messageTemplates.push(SystemMessagePromptTemplate.fromTemplate(textContent));
          }
        }
      }
    }
    
    console.log(`\n[Sampling] Collected ${messageTemplates.length} messages`);

      return new Promise(async (resolve, reject) => {
        let options = {
          userInput: userInput, 
          messages: messageTemplates,
          model_preference: request.params.modelPreferences?.hints?.[0]?.name
        }
        const response = await this.openAISampling(options)
        console.log("Sampleing front-end response : ", response)
        resolve({
              model: 'gpt-4o-mini',
              role: 'assistant',
              content: { type: 'text', 
                text: typeof response === 'string' ? response : JSON.stringify(response)
               }
          })
    })
  });
}


async openAISampling(options: { userInput: string, messages: BaseMessagePromptTemplate[], model_preference?: string }) {
  try {
    const storedToken = this.storageService.getValueFromKey('open_ai_token') || '';
    let open_ai_model = this.openai_service.getOpenAiClient({
      openAIKey: storedToken, 
      model: options.model_preference || "gpt-4o-mini"
    });

    // Create the prompt template from the collected messages
    const prompt = ChatPromptTemplate.fromMessages(options.messages);
    console.log("prompt : ", prompt);
    const llm_runnable = RunnableSequence.from([prompt, open_ai_model, new StringOutputParser()]);
    
    const llm_response = await llm_runnable.invoke({input: options.userInput});
    return llm_response;
  } catch (error) {
    console.error("Agent workflow error:", error);
    return error;
  }
}


private parseSchemaToFields(schema: any): any[] {
    const properties = schema.properties;
    const required = schema.required || [];
    
    return Object.entries(properties).map(([fieldName, fieldSchema]: [string, any]) => ({
      name: fieldName,
      title: fieldSchema.title || fieldName,
      description: fieldSchema.description,
      type: fieldSchema.type || 'string',
      required: required.includes(fieldName),
      enum: fieldSchema.enum,
      minimum: fieldSchema.minimum,
      maximum: fieldSchema.maximum,
      minLength: fieldSchema.minLength,
      maxLength: fieldSchema.maxLength,
      format: fieldSchema.format,
      default: fieldSchema.default
    }));
  }
  // Method to submit elicit responses from UI components
 submitElicitResponse(response: { 
              action: 'accept' | 'decline' | 'cancel', 
              content?: any
            }): void {
    this.elicitResponseSubject.next(response);
  }

  // Wrapper methods for common MCP operations
  async listTools() {
    if (!this.client) {
      throw new Error('Client not connected');
    }
    const toollist = await this.client.request({
      method: 'tools/list',
      params: {}
    }, ListToolsResultSchema);
      for (const tool of toollist.tools) {
        tool['title'] = getDisplayName(tool)
      }
    this.toolsSubject.next(toollist.tools)
    // console.log("Tools : ", toollist.tools);
  }


  createOpenAiToolSchema(mcpTool: OriginalTool[]): OpenAITool[] {
    const openai_tools = this.toolformatterService.formatMultipleTools(mcpTool);
    console.log("Open ai tools : ", openai_tools)
    return openai_tools;
  }

  async listPrompts() {
    if (!this.client) {
      throw new Error('Client not connected');
    }
    const prompts = await this.client.request({
      method: 'prompts/list',
      params: {}
    }, ListPromptsResultSchema);
    for (const prompt of prompts.prompts) {
        prompt['title'] = getDisplayName(prompt)
      }
      console.log("Prompt : ", prompts.prompts)
    this.promptsSubject.next(prompts.prompts)
  }

  async getPrompt(promptId: string) {
    if (!this.client) {
      throw new Error('Client not connected');
    }
    const prompt = await this.client.request({
      method: 'prompts/get',
      params: {
        promptId
      }
    }, GetPromptResultSchema)
    return prompt;
  }

  async callElicitation(message: string, data: any = null) {
    if (!this.client) {
      throw new Error('Client not connected');
    }
    const prompt = await this.client.request({
      method: "elicitation/create",
      params: {
        message: message,
        requestedSchema: data  // Describes expected response structure
      }
    }, ElicitResultSchema)
    return prompt;
  }

  async listResources(){
    if (!this.client) {
      throw new Error('Client not connected');
    }
    let resources = await this.client.request({
      method: 'resources/list',
      params: {}
    }, ListResourcesResultSchema)
      for(const resource of resources.resources) {
        console.log("Resources : ", resource);
        resource['title'] = getDisplayName(resource);
      }
    this.resourceSubject.next(resources.resources)
  }

readResource(resourceLink: ResourceLink) {
    if (!this.client) {
      throw new Error('Client not connected');
    }
    // this.client.readResource(resourceLink)
    return this.client.request({
      method: 'resources/read',
      params: {
        resourceLink
      }
    }, ReadResourceResultSchema);

  }

// Update your disconnect method
async disconnect(): Promise<void> {
  if (this.client && this.transport) {
    try {
       if (this.transport.sessionId) {
        try {
          console.log('Terminating session before exit...');
          await this.transport.terminateSession();
          console.log('Session terminated successfully');
        } catch (error) {
          console.error('Error terminating session:', error);
        }
      }
      // Clear the stored session ID
      await this.transport?.close();
      this.client = null;
      this.transport = null;
      this.sessionId = undefined;
      this.connectionStatusSubject.next(false);
      this.messageSource.next(false)
      localStorage.removeItem('mcp_session_id');
    } catch (error) {
      console.error('Error during disconnect:', error);
    }

  }
}

async callTool(toolId: string, parameters: any): Promise<any> {
    const progressToken = this.generateProgressToken(); // Generate a unique token
    if (!this.client) {
      throw new Error('Client not connected');
    }
    return await this.client.request({
          method: 'tools/call',
          params: {
            name: toolId,
            arguments: parameters,
            _meta:{
              stream: true,
              progressToken: progressToken
            }
          }
        }, CallToolResultSchema);  
  }

async longRunningTool(toolId: string, parameters: any){
      let self = this;
      const progressToken = this.generateProgressToken(); // Generate a unique token
      const onLastEventIdUpdate = (event: string) => {
      self.notificationsToolLastEventId = event;
      console.log(`Updated resumption token: ${event}`);
      console.log(`Updated resumption token: ${self.notificationsToolLastEventId}`);
    };

    if (!this.client) {
      throw new Error('Client not connected');
    }
    return await this.client.request({
          method: 'tools/call',
          params: {
            name: toolId,
            arguments: parameters,
            _meta:{
              stream: true,
              progressToken: progressToken
            }
          }
        }, CallToolResultSchema,
        {
          resumptionToken: self.notificationsToolLastEventId,
          onresumptiontoken: onLastEventIdUpdate
        }
      );
}

  private generateProgressToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

}