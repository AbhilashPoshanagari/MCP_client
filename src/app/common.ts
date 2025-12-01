export interface NamedItem {
    name: string; 
    displayName?: string; // Optional for display purposes
    description?: string; // Optional for additional information
    uri?: string; // Optional for resources
    parameters?: any; // Optional for tools
    inputSchema: any;
    title: string;
}

export interface OpenAIFunctions {
  type: string,
  function: {
    name: string,
    description: string,
    parameters: {
      properties: any
      required: Array<string>
      type: string
    }
  }
}

export interface OpenAiConfig {
  openAIKey: string;
  model?: string;
  temparature?: number;
  maxToken?: number;
  streaming?: boolean;
}

