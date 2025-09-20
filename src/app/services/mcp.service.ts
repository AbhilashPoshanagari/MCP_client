import { Injectable } from '@angular/core';
import { Observable, from, Subject, BehaviorSubject, shareReplay } from 'rxjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getDisplayName } from '@modelcontextprotocol/sdk/shared/metadataUtils.js';
import { urls } from '../apiUrl';
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
  ProgressNotificationSchema
} from '@modelcontextprotocol/sdk/types.js';
import Ajv from "ajv";
import { switchMap, expand, takeWhile, finalize } from 'rxjs/operators';

export interface ElicitPrompt {
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
  private serverUrl = urls.mcp_base_url;
  public client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  public sessionId: string | undefined = undefined;
  public notificationCount = 0;
  
  // Subjects for handling events and state
  public connectionStatusSubject = new BehaviorSubject<boolean>(false);
  private notificationsSubject = new Subject<any>();
  private elicitRequestSubject = new Subject<ElicitPrompt>();
  
  // Public observables
  public connectionStatus$ = this.connectionStatusSubject.asObservable();
  // public connectionStatus$ = this.connectionStatusSubject.asObservable().pipe(
  //                           shareReplay({ bufferSize: 1, refCount: true })
  //                         );
  public notifications$ = this.notificationsSubject.asObservable();
  public elicitRequests$ = this.elicitRequestSubject.asObservable();

  // Tools 
  private toolsSubject = new BehaviorSubject<Array<any>>([]);
  private promptsSubject = new BehaviorSubject<Array<any>>([]);
  private resourceSubject = new BehaviorSubject<Array<any>>([]);
  
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

  constructor() {}

  async connect(url?: string): Promise<void> {
    let serverUrl = url || this.serverUrl;
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
          elicitation: {},
          sampling: {},
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
      this.samplingCapability(this.client);
      this.progressNotificationHandler(this.client);
      this.loggingNotificationHandler(this.client);
      this.resourceListChangingHandler(this.client);

      // Connect the client
      await this.client.connect(this.transport);
      this.sessionId = this.transport.sessionId;
      if (this.sessionId) {
        localStorage.setItem('mcp_session_id', this.sessionId);
      }
      console.log('Transport created with session ID:', this.sessionId);
      console.log('Connected to MCP server');
      this.connectionStatusSubject.next(true);
      this.messageSource.next(true)
      this.listTools()
      this.listPrompts()
      this.listResources()
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
      this.notificationCount++;
      const notificationMessage = {
        type: 'log',
        level: notification.params.level,
        message: notification.params.data,
        count: this.notificationCount
      };
      console.log('MCP Notification:', notificationMessage);
      this.notificationsSubject.next(notificationMessage);
    });
}

progressNotificationHandler(client: Client){
  client.setNotificationHandler(ProgressNotificationSchema, (notification) => {
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
  });
}

initializeElicitationHandler(client: Client): void {
  client.setRequestHandler(ElicitRequestSchema, (request: any) => {
    // Trigger the UI to show (assuming handleElicitRequest does this)
    this.handleElicitRequest(request);
    
    // Return a Promise that resolves when we get a response from the UI
    return new Promise((resolve) => {
      const subscription = this.elicitResponses$.subscribe({
        next: (response: any) => {
          // Clean up the subscription
          subscription.unsubscribe();
          console.log("resp : ", response)
          // Return the response in the expected format
          resolve({
            action: response?.action || "cancel",  // Default to cancel if no action
            content: response?.content || {}       // Empty content if none provided
          });
        },
        error: () => {
          subscription.unsubscribe();
          resolve({
            action: "decline"
          });
        }
      });
    });
  });
}

// Add this method to handle reconnection with existing session
async reconnect(): Promise<void> {
  const storedSessionId = localStorage.getItem('mcp_session_id');
  if (storedSessionId) {
    this.sessionId = storedSessionId;
    await this.connect();
  } else {
    throw new Error('No stored session ID found');
  }
}

samplingCapability(client: Client){
  client.setRequestHandler(CreateMessageRequestSchema, () => ({
      model: "test-model",
      role: "assistant",
      content: {
        type: "text",
        text: "Test response",
      },
    }));
}

// renderElicitationUI(schema: any): Promise<any>{

//  return new Promise((resolve) => {
//           // Create modal container
//           const modal = document.createElement('div');
//           modal.style.position = 'fixed';
//           modal.style.top = '0';
//           modal.style.left = '0';
//           modal.style.width = '100%';
//           modal.style.height = '100%';
//           modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
//           modal.style.display = 'flex';
//           modal.style.justifyContent = 'center';
//           modal.style.alignItems = 'center';
//           modal.style.zIndex = '1000';
          
//           // Create form container
//           const form = document.createElement('div');
//           form.style.backgroundColor = 'white';
//           form.style.padding = '20px';
//           form.style.borderRadius = '8px';
//           form.style.maxWidth = '500px';
//           form.style.width = '100%';
          
//           // Add title (with fallback)
//           const title = document.createElement('h2');
//           title.textContent = schema?.title || "Please provide additional information";
//           form.appendChild(title);
          
//           // Create form fields with proper validation
//           const formData: any = {};
//           const fields = schema?.fields || [];
          
//           fields.forEach((field: any) => {
//             const fieldContainer = document.createElement('div');
//             fieldContainer.style.marginBottom = '15px';
            
//             const label = document.createElement('label');
//             label.textContent = field?.label || field?.name || 'Field';
//             label.style.display = 'block';
//             label.style.marginBottom = '5px';
//             fieldContainer.appendChild(label);
            
//             if (field?.type === 'boolean') {
//               const checkbox = document.createElement('input');
//               checkbox.type = 'checkbox';
//               checkbox.id = field.name;
//               checkbox.checked = false; // Default value
//               checkbox.addEventListener('change', (e) => {
//                 formData[field.name] = (e.target as HTMLInputElement).checked;
//               });
//               fieldContainer.appendChild(checkbox);
//             } 
//             else if (field?.type === 'select') {
//               const select = document.createElement('select');
//               select.id = field.name;
//               select.style.width = '100%';
//               select.style.padding = '8px';
              
//               // Add options
//               const options = field?.options || [];
//               options.forEach((option: string) => {
//                 const optionElement = document.createElement('option');
//                 optionElement.value = option;
//                 optionElement.textContent = option;
//                 select.appendChild(optionElement);
//               });
              
//               // Set default value
//               formData[field.name] = options[0] || '';
//               select.addEventListener('change', (e) => {
//                 formData[field.name] = (e.target as HTMLSelectElement).value;
//               });
//               fieldContainer.appendChild(select);
//             }
//             else {
//               const input = document.createElement('input');
//               input.type = field?.type || 'text';
//               input.id = field?.name || `field-${Math.random().toString(36).substring(2, 9)}`;
//               input.style.width = '100%';
//               input.style.padding = '8px';
//               input.addEventListener('input', (e) => {
//                 formData[field.name] = (e.target as HTMLInputElement).value;
//               });
//               fieldContainer.appendChild(input);
//             }
            
//             form.appendChild(fieldContainer);
//           });
          
//           // Add submit button
//           const submitButton = document.createElement('button');
//           submitButton.textContent = 'Submit';
//           submitButton.style.padding = '8px 16px';
//           submitButton.style.backgroundColor = '#007bff';
//           submitButton.style.color = 'white';
//           submitButton.style.border = 'none';
//           submitButton.style.borderRadius = '4px';
//           submitButton.style.marginTop = '10px';
//           submitButton.addEventListener('click', () => {
//             document.body.removeChild(modal);
//             resolve(formData);
//           });
//           form.appendChild(submitButton);
          
//           modal.appendChild(form);
//           document.body.appendChild(modal);
//         });
// }

private handleElicitRequest(request: any): void {
    const schema = request.params.requestedSchema;
    const fields = this.parseSchemaToFields(schema);
    
    this.elicitRequestSubject.next({
      message: request.params.message,
      schema: schema,
      fields: fields,
    });
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
        tool['displayName'] = getDisplayName(tool)
      }
    this.toolsSubject.next(toollist.tools)
  }

  // async callTool(toolId: string, parameters: any){
  //   if (!this.client) {
  //     throw new Error('Client not connected');
  //   }

  //   return await this.client.callTool({
  //               name: toolId,
  //               arguments: parameters
  //               });;
  // }


  async listPrompts() {
    if (!this.client) {
      throw new Error('Client not connected');
    }
    const prompts = await this.client.request({
      method: 'prompts/list',
      params: {}
    }, ListPromptsResultSchema);
    for (const prompt of prompts.prompts) {
        prompt['displayName'] = getDisplayName(prompt)
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
        resource['displayName'] = getDisplayName(resource)
      }
    this.resourceSubject.next(resources.resources)
  }

  readResource(resourceLink: ResourceLink) {
    if (!this.client) {
      throw new Error('Client not connected');
    }
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

  callToolWithStream(toolId: string, parameters: any): Observable<{ content: string, progress?: number }> {
    const progressToken = this.generateProgressToken(); // Generate a unique token
    const outputSubject = new Subject<{ content: string, progress?: number }>();
    let accumulatedOutput = '';

    if (!this.client) {
      throw new Error('Client not connected');
    }
    // Initial call
    this.client.request({
            method: 'tools/call',
            params: {
              name: toolId,
              arguments: parameters,
              _meta: {
                progressToken: progressToken,
                stream: true
              }
            }
          }, CallToolResultSchema).then(initialResponse => {
             // Check if response is already complete
              if (this.isComplete(initialResponse)) {
                accumulatedOutput += this.extractContent(initialResponse);
                outputSubject.next({
                  content: accumulatedOutput,
                  progress: 100
                });
                outputSubject.complete();
              } else {
                // If server supports streaming, it might keep the connection open
                // Otherwise we'll need to modify this based on actual API behavior
                this.handleStreamingResponse(initialResponse, outputSubject, accumulatedOutput);
              }
            // this.handleToolResponse(initialResponse, outputSubject, accumulatedOutput);
          }).catch(err => {
            outputSubject.error(err);
          });

    return outputSubject.asObservable();
  }

  private handleStreamingResponse(
    response: any,
    subject: Subject<{ content: string, progress?: number }>,
    accumulatedOutput: string
  ) {
    // Implementation depends on your server's actual streaming mechanism:
    
    // Option 1: If server keeps connection open and streams chunks
    if (response.stream) {
      response.stream.on('data', (chunk: any) => {
        accumulatedOutput += this.extractContent(chunk);
        subject.next({
          content: accumulatedOutput,
          progress: this.extractProgress(chunk)
        });
      });
      
      response.stream.on('end', () => {
        subject.complete();
      });
      
      response.stream.on('error', (err: any) => {
        subject.error(err);
      });
    }
    // Option 2: If server returns immediately but provides a way to fetch updates
    else if (response._meta?.streamId) {
      console.log(response._meta?.streamId)
      // this.pollForUpdates(response._meta.streamId, subject, accumulatedOutput);
    }
    // Option 3: Default behavior - single response
    else {
      accumulatedOutput += this.extractContent(response);
      subject.next({
        content: accumulatedOutput,
        progress: 100
      });
      subject.complete();
    }
  }

  private handleToolResponse(
    response: any,
    subject: Subject<{ content: string, progress?: number }>,
    accumulatedOutput: string
  ) {
    // Process the current chunk
    const newContent = this.extractContent(response);
    accumulatedOutput += newContent;
    console.log("streaming output : ", accumulatedOutput)
    
    subject.next({
      content: accumulatedOutput,
      progress: this.extractProgress(response)
    });

    // Check if we should continue polling
    if (!this.isComplete(response)) {
      
      // Poll for updates using the progress token
      setTimeout(() => {
         if (!this.client) {
            throw new Error('Client not connected');
          }
        this.client.request({
          method: 'tools/call',
          params: {
            name: 'get_progress', // Or whatever your progress endpoint is
            arguments: {
              progressToken: response._meta?.progressToken
            }
          }
        }, CallToolResultSchema).then(nextResponse => {
          this.handleToolResponse(nextResponse, subject, accumulatedOutput);
        }).catch(err => {
          subject.error(err);
        });
      }, 500); // Adjust polling interval as needed
    } else {
      subject.complete();
    }
  }

  private extractContent(response: any): string {
    // Implement logic to extract content from response
    return response.structuredContent?.result || response.output || '';
  }

  private extractProgress(response: any): number | undefined {
    // Implement logic to extract progress from response
    return response._meta?.progress || response.progress;
  }

  private isComplete(response: any): boolean {
    // Implement logic to check if response is complete
    return response._meta?.complete || response.status === 'completed';
  }

  private generateProgressToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

}