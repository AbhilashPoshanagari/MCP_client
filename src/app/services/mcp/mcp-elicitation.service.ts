// elicitation.service.ts
import { Injectable } from '@angular/core';
import { McpService } from '../mcp.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class McpElicitationService {
  private currentForm = new BehaviorSubject<FormGroup | null>(null);
  private currentSchema = new BehaviorSubject<any>(null);
  private currentRequestId = new BehaviorSubject<string | number | null>(null);

  constructor(
    private fb: FormBuilder,
    private mcpService: McpService
  ) {
    
    // Listen for MCP elicit requests
      this.mcpService.elicitRequests$.subscribe(request => {
        // console.log("request : ", request);
      this.createFormFromSchema(request.schema);
    });
  }

  public createFormFromSchema(schema: any, title: string = "Elicitation Request"): void {
    this.currentSchema.next({schema: schema, title: title});
    console.log("Schema : ", schema);
    const formGroup = this.fb.group({});
    const properties = schema.properties;
    const required = schema.required || [];

    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      const field = fieldSchema as any;
      const validators = [];
      // console.log("Field : ", field);

      if (required.includes(fieldName)) {
        validators.push(Validators.required);
      }

      if (field.type === 'string') {
        if (field.minLength) {
          validators.push(Validators.minLength(field.minLength));
        }
        if (field.maxLength) {
          validators.push(Validators.maxLength(field.maxLength));
        }
        if (field.format === 'email') {
          validators.push(Validators.email);
        }
      }

      if (field.type === 'number' || field.type === 'integer') {
        if (field.minimum !== undefined) {
          validators.push(Validators.min(field.minimum));
        }
        if (field.maximum !== undefined) {
          validators.push(Validators.max(field.maximum));
        }
      }

      formGroup.addControl(
        fieldName,
        this.fb.control(field.default || null, validators)
      );
    }
    this.currentForm.next(formGroup);
  }

  getCurrentForm(): Observable<FormGroup | null> {
    return this.currentForm.asObservable();
  }

  getCurrentSchema(): Observable<any> {
    return this.currentSchema.asObservable();
  }

  getCurrentRequestId(): string | number | null {
    return this.currentRequestId.value;
  }

  submitResponse(response: { action: 'accept' | 'decline' | 'cancel', content?: any}): void {
      this.mcpService.submitElicitResponse(response);
  }

  validateAgainstSchema(data: any, schema: any): boolean {
    // Simple validation - for more complex validation consider using AJV
    if (!schema) return false;
    
    const required = schema.required || [];
    for (const field of required) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        return false;
      }
    }
    
    return true;
  }
}