export interface OriginalTool {
  name: string;
  title: string;
  description: string;
  annotations?: { [key: string]: { description: string } };
  inputSchema: {
    type: string;
    properties: {
      [key: string]: {
        title: string;
        type: string;
        description?: string;
      };
    };
    required: string[];
    title: string;
  };
  displayName: string;
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: {
        [key: string]: {
          type: string;
          description: string;
        };
      };
      required: string[];
    };
  };
}