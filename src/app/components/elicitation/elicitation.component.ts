// elicitation.component.ts
import { Component, OnDestroy, OnInit, Output, EventEmitter, Input, OnChanges, NgZone, SimpleChanges } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { McpElicitationService } from '../../services/mcp/mcp-elicitation.service';
import { Observable, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { McpService } from '../../services/mcp.service';
import { NamedItem } from '../../common';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';

@Component({
  selector: 'app-elicitation',
  imports: [FormsModule, ReactiveFormsModule, CommonModule, MatProgressSpinnerModule],
  templateUrl: './elicitation.component.html',
  styleUrls: ['./elicitation.component.css'],
  standalone: true
})
export class ElicitationComponent implements OnInit, OnDestroy, OnChanges {
  @Input() tool: NamedItem | null = null;
  form$: Observable<FormGroup | null>;
  schema$: Observable<any>;
  currentRequest: any;
  validationErrors: string[] = [];
  showConfirmation = false;
  submittedData: any;
  formAvailable: boolean = false;
  waitingForResponse: boolean = false;
  title: string = "";
  @Output() sendToolResponse = new EventEmitter<{response: string, layouts?: Array<any>}>();
  @Output() sendToolRequest = new EventEmitter<{request: string}>();

  private subscriptions: Subscription[] = [];
  form: FormGroup = new FormGroup({}); // Initialize with empty form group

  constructor(
    private elicitationService: McpElicitationService, 
    private mcpService: McpService,  private fb: FormBuilder,
    private ngZone: NgZone
  ) {
    this.form$ = this.elicitationService.getCurrentForm();
    this.schema$ = this.elicitationService.getCurrentSchema();
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log("UI update: ", changes);
    if(!this.tool?.name && this.title != "Elicitation Request"){
      this.formAvailable = false;
      this.waitingForResponse = false;
    }
  }

  ngOnInit(): void {
    this.subscriptions.push(
      this.schema$.subscribe(schema => {
        this.waitingForResponse = false;
        this.currentRequest = schema?.schema;
        this.title = schema?.title;
        this.formAvailable = true;
      })
    );

    // Subscribe to form changes and set the local form property
    this.subscriptions.push(
      this.form$.subscribe(form => {
        if (form) {
          this.form = form;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  confirmSubmission(confirm: boolean): void {
    this.waitingForResponse = false;
     if (confirm) {
      this.elicitationService.submitResponse({
        action: 'accept',
        content: this.submittedData
      });
    } else {
      this.elicitationService.submitResponse({
        action: 'decline'
      });
    }
    this.resetForm();
    this.formAvailable = false;
  }

  onEdit(): void {
    this.showConfirmation = false;
    this.formAvailable = true;
  }

  cancel(): void {
    if(this.title === "Elicitation Request"){
      this.elicitationService.submitResponse({
          action: 'cancel'
        });
    }else{
      console.log(this.title);
      this.sendToolResponse.emit({response : ""})
    }
    this.resetForm();
    this.formAvailable = false;
  }

  maskSensitiveData(data: any): any {    
    if(data.password){
      const password = data.password;
      const marked_password = password.length > 2 
        ? password.slice(0,3) + '****'
        : '****';
    return {
      ...data,
      password: marked_password // Mask the password
    };
    }
    return data;
  }

  /**
 * Convert form data arrays for object fields into plain objects.
 * Looks at currentRequest schema to detect object fields.
 * Example input for field 'meta': [ {key:'a', value:'1'}, {key:'b', value:'2'} ]
 * becomes meta: { a: '1', b: '2' }
 */
transformObjectFields(formValue: any, schemaWrapper: any): any {
  if (!schemaWrapper || !schemaWrapper.properties) return formValue;
  const result = { ...formValue };

  Object.keys(schemaWrapper.properties).forEach(fieldName => {
    const prop = schemaWrapper.properties[fieldName];
    if (!prop) return;

    if (prop.type === 'object') {
      // Expect stored as array of { key, value, valueType? }
      const arr = result[fieldName];
      if (!Array.isArray(arr)) return;

      const obj: any = {};
      arr.forEach((entry: any) => {
        if (!entry || entry.key === undefined || entry.key === null) return;
        let value = entry.value;
        // If there is valueType selection try to coerce
        if (entry.valueType) {
          switch (entry.valueType) {
            case 'number':
              const num = Number(value);
              value = isNaN(num) ? value : num;
              break;
            case 'boolean':
              if (typeof value === 'string') {
                const vLower = value.toLowerCase();
                value = (vLower === 'true' || vLower === '1');
              } else {
                value = Boolean(value);
              }
              break;
            default:
              // keep as string
              break;
          }
        }
        obj[entry.key] = value;
      });
      result[fieldName] = obj;
    }
  });

  return result;
}


  onSubmit(form: FormGroup): void {
    // this.markFormGroupTouched(form);
    if (form.invalid) {
      this.validationErrors = this.getFormErrors(form);
      return;
    }
    
    // based on currentRequest schema (if present)
    const transformed = this.transformObjectFields(form.value, this.currentRequest);
    console.log("Transformed : ", transformed)

    // const formData = form.value;
    const isValid = this.elicitationService.validateAgainstSchema(transformed, this.currentRequest);

    if (!isValid) {
      this.validationErrors = ['Data does not match the required schema.'];
      return;
    }

    Object.keys(transformed).forEach(key => {
      if(transformed[key] === null || transformed[key] === undefined || transformed[key] === ''){
        delete transformed[key];
      }
    });
    
    this.submittedData = transformed;
    if(this.title === "Tool test"){
      this.sendToolRequest.emit({request: JSON.stringify(transformed)})
      this.toolCall(transformed)
    }else{
      this.showConfirmation = true;
    }
  }

private markFormGroupTouched(formGroup: FormGroup | FormArray) {
  Object.keys(formGroup.controls).forEach(key => {
    const control = formGroup.get(key);
    
    if (control instanceof FormGroup || control instanceof FormArray) {
      this.markFormGroupTouched(control);
    } else {
      control?.markAsTouched();
    }
  });
}

  async toolCall(formData: any){
    if(this.tool?.name){
      console.log("Tool name : ", this.tool.name)
      try {
        let rag_response: any = {};
        if(this.tool?.description == "long running task"){
          this.waitingForResponse = true;
          rag_response = await this.mcpService.longRunningTool(this.tool?.name, formData);
          this.waitingForResponse = false;
        }else{
          this.waitingForResponse = true;
          rag_response = await this.mcpService.longRunningTool(this.tool?.name, formData);
          this.waitingForResponse = false;
        }
        // console.log("RAG tool response : ", rag_response["content"][0]["text"])
          try {
             const extract_results = JSON.parse(rag_response["content"][0]["text"])
              const server_keys = Object.keys(extract_results);
              if(server_keys.includes("layouts")){

                  const { layouts, ...contentWithoutLayouts } = extract_results;
                  console.log("chek keys : ", Object.keys(contentWithoutLayouts).length, Object.keys(contentWithoutLayouts));
                  if(Object.keys(contentWithoutLayouts).length){
                    this.sendToolResponse.emit({
                      response : "```json \n " + JSON.stringify(contentWithoutLayouts, null, 2) + "\n```",
                      layouts: extract_results.layouts
                    })
                  }else {
                  this.sendToolResponse.emit({
                    response : "",
                    layouts: extract_results.layouts
                  })
                  }

              }else {
                  this.sendToolResponse.emit({response : rag_response["content"][0]["text"]})
              }
          } catch (e) {
            // Handle plain text response
            this.sendToolResponse.emit({response : rag_response["content"][0]["text"]})
          }
        this.resetForm();
        this.formAvailable = false;
      } catch (error) {
        this.ngZone.run(() => {
          this.validationErrors = ['Error occurred while calling the tool. Please try again.'];
          console.log("Sothing went worng : ", error)
          this.waitingForResponse = false;
          this.resetForm();
          this.formAvailable = false;
        });
      }
    }else {
      console.log("Tool name not received : ", this.tool?.name)
    }
    
  }

  private getFormErrors(form: FormGroup): string[] {
    const errors: string[] = [];
    Object.keys(form.controls).forEach(key => {
      const controlErrors = form.get(key)?.errors;
      if (controlErrors) {
        Object.keys(controlErrors).forEach(keyError => {
          errors.push(`${key}: ${this.getErrorMessage(keyError, controlErrors[keyError])}`);
        });
      }
    });
    return errors;
  }

  private getErrorMessage(errorName: string, errorValue: any): string {
    switch (errorName) {
      case 'required':
        return 'This field is required';
      case 'minlength':
        return `Minimum length is ${errorValue.requiredLength}`;
      case 'maxlength':
        return `Maximum length is ${errorValue.requiredLength}`;
      case 'min':
        return `Minimum value is ${errorValue.min}`;
      case 'max':
        return `Maximum value is ${errorValue.max}`;
      case 'email':
        return 'Invalid email format';
      default:
        return 'Invalid value';
    }
  }

  private resetForm(): void {
    this.validationErrors = [];
    this.showConfirmation = false;
    this.submittedData = null;
  }

  // Add these methods to the elicitation component
  getFieldNames(schema: any): string[] {
    return schema ? Object.keys(schema.properties) : [];
  }

  getFieldType(schema: any, fieldName: string): string {
    if (!schema || !schema.properties[fieldName]) return 'string';
    const field = schema.properties[fieldName];
    if(fieldName === 'password'){
      return 'password';
    }
    if (field.enum) return 'enum';
    return field.type || 'string';
  }

  getFieldTitle(schema: any, fieldName: string): string {
    return schema?.properties[fieldName]?.title || fieldName;
  }

  getFieldDescription(schema: any, fieldName: string): string | null {
    return schema?.properties[fieldName]?.description || null;
  }

  getFieldDefault(schema: any, fieldName: string): any {
    return schema?.properties[fieldName]?.default;
  }

  getFieldMin(schema: any, fieldName: string): number | null {
    return schema?.properties[fieldName]?.minimum || null;
  }

  getFieldMax(schema: any, fieldName: string): number | null {
    return schema?.properties[fieldName]?.maximum || null;
  }

  getFieldOptions(schema: any, fieldName: string): any[] {
    return schema?.properties[fieldName]?.options || [];
  }

  getFieldExamples(schema: any, fieldName: string): any[] {
    return schema?.properties[fieldName]?.examples || '';
  }

  isFieldRequired(schema: any, fieldName: string): boolean {
    return schema?.required?.includes(fieldName) || false;
  }

/**
 * Returns possible value type options for object values if schema suggests types.
 * Example: ['string','number','boolean'] or empty array.
 */
getObjectValueTypeOptions(schema: any, fieldName: string): string[] {
  const prop = schema?.properties?.[fieldName];
  // If schema defines additionalProperties with types, derive options
  if (!prop) return [];
  const additional = prop.additionalProperties;
  if (!additional) return [];
  const types = additional.type;
  if (!types) return [];
  if (Array.isArray(types)) return types;
  return [types];
}

  // Array-specific methods
  isNestedArray(schema: any, fieldName: string): boolean {
    const field = schema?.properties[fieldName];
    return field?.items?.type === 'array';
  }

  // getArrayItemType(schema: any, fieldName: string): string {
  //   const field = schema?.properties[fieldName];
  //   if (field?.items?.type === 'integer' || field?.items?.type === 'number') {
  //     return 'number';
  //   }
  //   return 'string';
  // }

    getArrayItemType(schema: any, fieldName: string): string {
    const field = schema?.properties[fieldName];
    if (this.isNestedArray(schema, fieldName)) {
      // For nested arrays, get the type of the nested items
      return field?.items?.items?.type === 'integer' ? 'number' : 'text';
    } else {
      // For simple arrays, get the type of the items
      return field?.items?.type === 'integer' ? 'number' : 'text';
    }
  }

  getArrayPlaceholder(schema: any, fieldName: string): string {
    const field = schema?.properties[fieldName];
    return `Enter ${field?.items?.type || 'value'}`;
  }

  // Array manipulation methods using the service
  addArrayItem(fieldName: string): void {
    if (this.form) {
      this.elicitationService.addArrayItemToForm(this.form, fieldName);
    }
  }

  removeArrayItem(fieldName: string, index: number): void {
    if (this.form) {
      this.elicitationService.removeArrayItemFromForm(this.form, fieldName, index);
    }
  }

  addNestedArrayItem(fieldName: string, parentIndex: number): void {
    if (this.form) {
      this.elicitationService.addNestedArrayItem(this.form, fieldName, parentIndex);
    }
  }

  removeNestedArrayItem(fieldName: string, parentIndex: number, childIndex: number): void {
    if (this.form) {
      this.elicitationService.removeNestedArrayItem(this.form, fieldName, parentIndex, childIndex);
    }
  }

  getFormArray(form: FormGroup, fieldName: string): FormArray {
    return this.elicitationService.getFormArray(form, fieldName);
  }

  getNestedFormArray(form: FormGroup, fieldName: string, index: number): FormArray {
    return this.elicitationService.getNestedFormArray(form, fieldName, index);
  }

  // Add method to add new rows to nested arrays
  addNestedArrayRow(fieldName: string): void {
    if (this.form) {
      this.elicitationService.addNestedArrayRow(this.form, fieldName);
    }
  }

  removeNestedArrayRow(fieldName: string, rowIndex: number): void {
    if (this.form) {
      this.elicitationService.removeNestedArrayRow(this.form, fieldName, rowIndex);
    }
  }

  // elicitation.component.ts - Fix object field methods

/**
 * Returns the FormArray for object fields (array of {key, value} groups)
 */
getObjectFormArray(form: FormGroup, fieldName: string): FormArray {
  try {
    const arr = form.get(fieldName) as FormArray;
    if (arr && arr instanceof FormArray) {
      return arr;
    }
    // If not found, create empty array and add to form
    console.warn(`FormArray for ${fieldName} not found, creating empty one`);
    const newArr = this.fb.array([]);
    form.setControl(fieldName, newArr);
    return newArr;
  } catch (e) {
    console.error('Error getting object form array:', e);
    return this.fb.array([]);
  }
}

/**
 * Add a new key/value FormGroup to object field
 */
addObjectItem(fieldName: string): void {
  if (!this.form) return;
  const arr = this.getObjectFormArray(this.form, fieldName);
  const fg = this.fb.group({
    key: ['', Validators.required],
    value: [''],
    valueType: ['string']
  });
  arr.push(fg);
}

/**
 * Remove a key/value pair from object field
 */
removeObjectItem(fieldName: string, index: number): void {
  if (!this.form) return;
  const arr = this.getObjectFormArray(this.form, fieldName);
  if (index >= 0 && index < arr.length) {
    arr.removeAt(index);
  }
}

/**
 * Validate object field items
 */
getObjectItemError(fieldName: string, index: number): string | null {
  if (!this.form) return null;
  const arr = this.getObjectFormArray(this.form, fieldName);
  
  if (index < 0 || index >= arr.length) return null;
  
  const control = arr.at(index) as FormGroup;
  const keyControl = control.get('key');
  
  // Check for empty required key
  if (keyControl?.errors?.['required'] && keyControl.touched) {
    return 'Key is required';
  }
  
  // Check for duplicate keys
  const key = keyControl?.value;
  if (key && key.trim()) {
    const keys = arr.controls
      .map((g, i) => i !== index ? (g as FormGroup).get('key')?.value : null)
      .filter(k => k && k.trim() === key.trim());
    
    if (keys.length > 0) {
      return 'Duplicate key';
    }
  }
  
  return null;
}
}