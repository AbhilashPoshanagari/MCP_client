// mcp-elicitation.service.ts
import { Injectable } from '@angular/core';
import { McpService } from '../mcp.service';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { BehaviorSubject, Observable } from 'rxjs';

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
    this.mcpService.elicitRequests$.subscribe(request => {
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
      
      if (field.type === 'array') {
        const formArray = this.createFormArray(field, required.includes(fieldName));
        formGroup.addControl(fieldName, formArray);
      } else {
        const validators = this.createValidators(field, required.includes(fieldName));
        formGroup.addControl(
          fieldName,
          this.fb.control(field.default || null, validators)
        );
      }
    }
    this.currentForm.next(formGroup);
  }

  private createValidators(field: any, isRequired: boolean): any[] {
    const validators = [];
    if (isRequired) {
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
    return validators;
  }

  private createFormArray(field: any, isRequired: boolean): FormArray {
    if (this.isNestedArray(field)) {
      return this.createNestedFormArray(field, isRequired);
    } else {
      return this.createSimpleFormArray(field, isRequired);
    }
  }

  private createSimpleFormArray(field: any, isRequired: boolean): FormArray {
    const defaultItems = field.default || [];
    if (defaultItems.length > 0) {
      const formControls = defaultItems.map((item: any) => this.fb.control(item));
      return this.fb.array(formControls);
    } else if (isRequired) {
      return this.fb.array([this.fb.control(this.getDefaultArrayValue(field.items))]);
    } else {
      return this.fb.array([]);
    }
  }

  private createNestedFormArray(field: any, isRequired: boolean): FormArray {
    const defaultItems = field.default || [];
    if (defaultItems.length > 0) {
      // For nested arrays, create FormArray of FormArrays (not FormGroups)
      const nestedArrays = defaultItems.map((nestedArray: any[]) => {
        return this.fb.array(
          nestedArray.map(item => this.fb.control(item))
        );
      });
      return this.fb.array(nestedArrays);
    } else if (isRequired) {
      // Start with one row containing one number
      const nestedFormArray = this.fb.array([
        this.fb.control(this.getDefaultArrayValue(field.items.items))
      ]);
      return this.fb.array([nestedFormArray]);
    } else {
      return this.fb.array([]);
    }
  }

  private isNestedArray(field: any): boolean {
    return field.items && field.items.type === 'array';
  }

  private getDefaultArrayValue(itemsSchema: any): any {
    if (!itemsSchema) return '';
    switch (itemsSchema.type) {
      case 'integer':
      case 'number':
        return 0;
      case 'string':
        return '';
      case 'boolean':
        return false;
      default:
        return '';
    }
  }

  // Public methods for array manipulation
  public addArrayItemToForm(form: FormGroup, fieldName: string): void {
    const formArray = form.get(fieldName) as FormArray;
    const schema = this.currentSchema.value?.schema;
    const fieldSchema = schema?.properties[fieldName];
    
    if (fieldSchema && !this.isNestedArray(fieldSchema)) {
      const defaultValue = this.getDefaultArrayValue(fieldSchema.items);
      formArray.push(this.fb.control(defaultValue));
    }
  }

  public removeArrayItemFromForm(form: FormGroup, fieldName: string, index: number): void {
    const formArray = form.get(fieldName) as FormArray;
    if (formArray.length > 1) {
      formArray.removeAt(index);
    }
  }

  public addNestedArrayItem(form: FormGroup, fieldName: string, parentIndex: number): void {
    const parentArray = form.get(fieldName) as FormArray;
    if (parentIndex >= 0 && parentIndex < parentArray.length) {
      const nestedArray = parentArray.at(parentIndex) as FormArray;
      const schema = this.currentSchema.value?.schema;
      const fieldSchema = schema?.properties[fieldName];
      const nestedValue = this.getDefaultArrayValue(fieldSchema?.items?.items);
      nestedArray.push(this.fb.control(nestedValue));
    }
  }

  public removeNestedArrayItem(form: FormGroup, fieldName: string, parentIndex: number, childIndex: number): void {
    const parentArray = form.get(fieldName) as FormArray;
    if (parentIndex >= 0 && parentIndex < parentArray.length) {
      const nestedArray = parentArray.at(parentIndex) as FormArray;
      if (nestedArray.length > 1) {
        nestedArray.removeAt(childIndex);
      }
    }
  }

  // Add method to add new rows to nested arrays
  public addNestedArrayRow(form: FormGroup, fieldName: string): void {
    const parentArray = form.get(fieldName) as FormArray;
    const schema = this.currentSchema.value?.schema;
    const fieldSchema = schema?.properties[fieldName];
    const nestedValue = this.getDefaultArrayValue(fieldSchema?.items?.items);
    
    // Create a new row with one number
    const newRow = this.fb.array([this.fb.control(nestedValue)]);
    parentArray.push(newRow);
  }

  public removeNestedArrayRow(form: FormGroup, fieldName: string, rowIndex: number): void {
    const parentArray = form.get(fieldName) as FormArray;
    if (parentArray.length > 1) {
      parentArray.removeAt(rowIndex);
    }
  }

  // Helper methods
  public getFormArray(form: FormGroup, fieldName: string): FormArray {
    const control = form.get(fieldName);
    return control instanceof FormArray ? control : this.fb.array([]);
  }

  public getNestedFormArray(form: FormGroup, fieldName: string, index: number): FormArray {
    try {
      const formArray = this.getFormArray(form, fieldName);
      if (index >= 0 && index < formArray.length) {
        const arrayItem = formArray.at(index);
        if (arrayItem instanceof FormArray) {
          return arrayItem;
        }
      }
    } catch (error) {
      console.warn(`Error getting nested array for ${fieldName}[${index}]:`, error);
    }
    return this.fb.array([]);
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
    if (!schema) return false;
    const required = schema.required || [];
    for (const field of required) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        return false;
      }
      if (Array.isArray(data[field]) && data[field].length === 0) {
        return false;
      }
    }
    return true;
  }
}