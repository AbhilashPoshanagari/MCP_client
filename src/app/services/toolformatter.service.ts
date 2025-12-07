import { Injectable } from '@angular/core';
import { OriginalTool, OpenAITool } from '../constants/toolschema';
import { DynamicStructuredTool, DynamicTool } from '@langchain/core/tools';
import { z } from 'zod/v4';
@Injectable({
  providedIn: 'root'
})
export class ToolformatterService {

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
  
  /**
   * Convert a single OriginalTool to a LangChain DynamicTool
   */
  convertToolForLangChain(originalTool: OriginalTool): DynamicStructuredTool {
    // Convert JSON schema to Zod schema
    const zodSchema = this.convertJsonSchemaToZod(originalTool.inputSchema)
    
    return new DynamicStructuredTool({
      name: originalTool.name,
      description: originalTool.description.trim(),
      schema: zodSchema,
      func: async (input: any) => {
        // This is where your tool's implementation would go
        // For now, return a placeholder
        return `Tool ${originalTool.name} executed with input: ${JSON.stringify(input)}`
      }
    })
  }
  
  /**
   * Convert multiple tools to LangChain tools
   */
  convertMultipleTools(tools: OriginalTool[]): DynamicStructuredTool[] {
    return tools.map(tool => this.convertToolForLangChain(tool))
  }
  
  /**
   * Recursively convert JSON schema to Zod schema
   */
  private convertJsonSchemaToZod(jsonSchema: any): z.ZodObject<any> {
    const properties: Record<string, z.ZodTypeAny> = {}
    
    // Handle object properties
    if (jsonSchema.type === "object" && jsonSchema.properties) {
      for (const [propName, propSchema] of Object.entries(jsonSchema.properties)) {
        properties[propName] = this.convertPropertyToZod(propSchema as any)
      }
    }
    
    // Create Zod object with optional required fields
    const zodObject = z.object(properties)
    
    // Apply required fields if specified
    if (jsonSchema.required && jsonSchema.required.length > 0) {
      return zodObject.required() as z.ZodObject<any>
    }
    
    return zodObject
  }
  
  /**
   * Convert a single property to Zod type
   */
  private convertPropertyToZod(propertySchema: any): z.ZodTypeAny {
    const { type, description } = propertySchema
    
    // Handle basic types
    switch (type) {
      case "string":
        return z.string().describe(description || "")
      case "number":
        return z.number().describe(description || "")
      case "integer":
        return z.number().int().describe(description || "")
      case "boolean":
        return z.boolean().describe(description || "")
      case "array":
        if (propertySchema.items) {
          const itemType = this.convertPropertyToZod(propertySchema.items)
          return z.array(itemType).describe(description || "")
        }
        return z.array(z.any()).describe(description || "")
      case "object":
        if (propertySchema.properties) {
          return this.convertJsonSchemaToZod(propertySchema)
        }
        return z.object({}).describe(description || "")
      default:
        return z.any().describe(description || "")
    }
  }
}

