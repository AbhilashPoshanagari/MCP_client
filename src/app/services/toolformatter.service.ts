import { Injectable } from '@angular/core';
import { OriginalTool, OpenAITool } from '../constants/toolschema';

@Injectable({
  providedIn: 'root'
})
export class ToolformatterService {

    formatToolForOpenAI(originalTool: OriginalTool): OpenAITool {
    const properties: { [key: string]: { type: string; description: string } } = {};
    
    // Convert all properties to the required format
    Object.entries(originalTool.inputSchema.properties).forEach(([key, value]) => {
      let description: string | null = '';
      if(originalTool.annotations && originalTool.annotations[key] && originalTool.annotations[key].description){
        description = originalTool.annotations[key]?originalTool.annotations[key].description:null;
      }
      properties[key] = {
        type: value.type,
        description: description?description: `user questions on ${originalTool.title}`
      };
    });

    return {
      type: 'function',
      function: {
        name: originalTool.name,
        description: originalTool.description.trim(),
        parameters: {
          type: 'object',
          properties,
          required: originalTool.inputSchema.required
        }
      }
    };
  }

  formatMultipleTools(tools: OriginalTool[]): OpenAITool[] {
    return tools.map(tool => this.formatToolForOpenAI(tool));
  }
  
}
