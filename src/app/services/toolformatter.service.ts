import { Injectable } from '@angular/core';
import { OriginalTool, OpenAITool } from '../constants/toolschema';

@Injectable({
  providedIn: 'root'
})
export class ToolformatterService {

  //   formatToolForOpenAI(originalTool: OriginalTool): OpenAITool {
  //   const properties: { [key: string]: { type: string; description: string, } } = {};
    
  //   // Convert all properties to the required format
  //   Object.entries(originalTool.inputSchema.properties).forEach(([key, value]) => {
  //     let description: string | null = '';
  //     if(originalTool.annotations && originalTool.annotations[key] && originalTool.annotations[key].description){
  //       description = originalTool.annotations[key]?originalTool.annotations[key].description:null;
  //     }
  //     if()
  //     properties[key] = {
  //       type: value.type || 'object',
  //       description: description?description: `user questions on ${originalTool.title}`
  //     };
  //     // console.log("properties : ", properties)
  //   });

  //   return {
  //     type: 'function',
  //     function: {
  //       name: originalTool.name,
  //       description: originalTool.description.trim(),
  //       parameters: {
  //         type: 'object',
  //         properties,
  //         required: originalTool.inputSchema.required
  //       }
  //     }
  //   };
  // }

  // formatMultipleTools(tools: OriginalTool[]): OpenAITool[] {
  //   return tools.map(tool => this.formatToolForOpenAI(tool));
  // }

  formatToolForOpenAI(originalTool: OriginalTool): OpenAITool {

    // Recursively convert JSON schema into OpenAI function schema
    const convertSchema = (schema: any): any => {
      if (!schema || typeof schema !== "object") return schema;

      const out: any = { ...schema };

      // --- Handle arrays ---
      if (schema.type === "array") {
        if (!schema.items) {
          throw new Error(`Array schema for key is missing 'items'.`);
        }

        // If items is an array → tuple typing
        if (Array.isArray(schema.items)) {
          out.items = schema.items.map((item: any) => convertSchema(item));
        } 
        // Normal array type
        else {
          out.items = convertSchema(schema.items);
        }
      }

      // --- Handle objects ---
      if (schema.type === "object" && schema.properties) {
        out.properties = {};
        for (const [propName, propValue] of Object.entries(schema.properties)) {
          out.properties[propName] = convertSchema(propValue);
        }
      }

      return out;
    };

    // Convert root properties
    const properties: Record<string, any> = {};
    Object.entries(originalTool.inputSchema.properties).forEach(([key, value]) => {
      const annotationDesc =
        originalTool.annotations?.[key]?.description ||
        `user questions on ${originalTool.title}`;

      properties[key] = {
        ...convertSchema(value),
        description: annotationDesc
      };
    });

    return {
      type: "function",
      function: {
        name: originalTool.name,
        description: originalTool.description.trim(),
        parameters: {
          type: "object",
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
