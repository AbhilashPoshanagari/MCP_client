export interface NamedItem {
    name: string; 
    displayName?: string; // Optional for display purposes
    description?: string; // Optional for additional information
    uri?: string; // Optional for resources
    parameters?: any; // Optional for tools
    inputSchema: any;
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