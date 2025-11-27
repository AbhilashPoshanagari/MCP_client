// // mcp-elicitation.service.ts
// import { Injectable } from '@angular/core';
// import { McpService } from '../mcp.service';
// import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
// import { BehaviorSubject, Observable } from 'rxjs';

// @Injectable({
//   providedIn: 'root'
// })
// export class McpElicitationService {
//   private currentForm = new BehaviorSubject<FormGroup | null>(null);
//   private currentSchema = new BehaviorSubject<any>(null);
//   private currentRequestId = new BehaviorSubject<string | number | null>(null);

//   constructor(
//     private fb: FormBuilder,
//     private mcpService: McpService
//   ) {
//     this.mcpService.elicitRequests$.subscribe(request => {
//       this.createFormFromSchema(request.schema);
//     });
//   }

//   public createFormFromSchema(schema: any, title: string = "Elicitation Request"): void {
//     this.currentSchema.next({schema: schema, title: title});
//     console.log("Schema : ", schema);
//     const formGroup = this.fb.group({});
//     const properties = schema.properties;
//     const required = schema.required || [];

//     for (const [fieldName, fieldSchema] of Object.entries(properties)) {
//       const field = fieldSchema as any;
      
//       if (field.type === 'array') {
//         const formArray = this.createFormArray(field, required.includes(fieldName));
//         formGroup.addControl(fieldName, formArray);
//       } else {
//         const validators = this.createValidators(field, required.includes(fieldName));
//         formGroup.addControl(
//           fieldName,
//           this.fb.control(field.default || null, validators)
//         );
//       }
//     }
//     this.currentForm.next(formGroup);
//   }

//   private createValidators(field: any, isRequired: boolean): any[] {
//     const validators = [];
//     if (isRequired) {
//       validators.push(Validators.required);
//     }
//     if (field.type === 'string') {
//       if (field.minLength) {
//         validators.push(Validators.minLength(field.minLength));
//       }
//       if (field.maxLength) {
//         validators.push(Validators.maxLength(field.maxLength));
//       }
//       if (field.format === 'email') {
//         validators.push(Validators.email);
//       }
//     }
//     if (field.type === 'number' || field.type === 'integer') {
//       if (field.minimum !== undefined) {
//         validators.push(Validators.min(field.minimum));
//       }
//       if (field.maximum !== undefined) {
//         validators.push(Validators.max(field.maximum));
//       }
//     }
//     return validators;
//   }

//   private createFormArray(field: any, isRequired: boolean): FormArray {
//     if (this.isNestedArray(field)) {
//       return this.createNestedFormArray(field, isRequired);
//     } else {
//       return this.createSimpleFormArray(field, isRequired);
//     }
//   }

//   private createSimpleFormArray(field: any, isRequired: boolean): FormArray {
//     const defaultItems = field.default || [];
//     if (defaultItems.length > 0) {
//       const formControls = defaultItems.map((item: any) => this.fb.control(item));
//       return this.fb.array(formControls);
//     } else if (isRequired) {
//       return this.fb.array([this.fb.control(this.getDefaultArrayValue(field.items))]);
//     } else {
//       return this.fb.array([]);
//     }
//   }

//   private createNestedFormArray(field: any, isRequired: boolean): FormArray {
//     const defaultItems = field.default || [];
//     if (defaultItems.length > 0) {
//       // For nested arrays, create FormArray of FormArrays (not FormGroups)
//       const nestedArrays = defaultItems.map((nestedArray: any[]) => {
//         return this.fb.array(
//           nestedArray.map(item => this.fb.control(item))
//         );
//       });
//       return this.fb.array(nestedArrays);
//     } else if (isRequired) {
//       // Start with one row containing one number
//       const nestedFormArray = this.fb.array([
//         this.fb.control(this.getDefaultArrayValue(field.items.items))
//       ]);
//       return this.fb.array([nestedFormArray]);
//     } else {
//       return this.fb.array([]);
//     }
//   }

//   private isNestedArray(field: any): boolean {
//     return field.items && field.items.type === 'array';
//   }

//   private getDefaultArrayValue(itemsSchema: any): any {
//     if (!itemsSchema) return '';
//     switch (itemsSchema.type) {
//       case 'integer':
//       case 'number':
//         return 0;
//       case 'string':
//         return '';
//       case 'boolean':
//         return false;
//       default:
//         return '';
//     }
//   }

//   // Public methods for array manipulation
//   public addArrayItemToForm(form: FormGroup, fieldName: string): void {
//     const formArray = form.get(fieldName) as FormArray;
//     const schema = this.currentSchema.value?.schema;
//     const fieldSchema = schema?.properties[fieldName];
    
//     if (fieldSchema && !this.isNestedArray(fieldSchema)) {
//       const defaultValue = this.getDefaultArrayValue(fieldSchema.items);
//       formArray.push(this.fb.control(defaultValue));
//     }
//   }

//   public removeArrayItemFromForm(form: FormGroup, fieldName: string, index: number): void {
//     const formArray = form.get(fieldName) as FormArray;
//     if (formArray.length > 1) {
//       formArray.removeAt(index);
//     }
//   }

//   public addNestedArrayItem(form: FormGroup, fieldName: string, parentIndex: number): void {
//     const parentArray = form.get(fieldName) as FormArray;
//     if (parentIndex >= 0 && parentIndex < parentArray.length) {
//       const nestedArray = parentArray.at(parentIndex) as FormArray;
//       const schema = this.currentSchema.value?.schema;
//       const fieldSchema = schema?.properties[fieldName];
//       const nestedValue = this.getDefaultArrayValue(fieldSchema?.items?.items);
//       nestedArray.push(this.fb.control(nestedValue));
//     }
//   }

//   public removeNestedArrayItem(form: FormGroup, fieldName: string, parentIndex: number, childIndex: number): void {
//     const parentArray = form.get(fieldName) as FormArray;
//     if (parentIndex >= 0 && parentIndex < parentArray.length) {
//       const nestedArray = parentArray.at(parentIndex) as FormArray;
//       if (nestedArray.length > 1) {
//         nestedArray.removeAt(childIndex);
//       }
//     }
//   }

//   // Add method to add new rows to nested arrays
//   public addNestedArrayRow(form: FormGroup, fieldName: string): void {
//     const parentArray = form.get(fieldName) as FormArray;
//     const schema = this.currentSchema.value?.schema;
//     const fieldSchema = schema?.properties[fieldName];
//     const nestedValue = this.getDefaultArrayValue(fieldSchema?.items?.items);
    
//     // Create a new row with one number
//     const newRow = this.fb.array([this.fb.control(nestedValue)]);
//     parentArray.push(newRow);
//   }

//   public removeNestedArrayRow(form: FormGroup, fieldName: string, rowIndex: number): void {
//     const parentArray = form.get(fieldName) as FormArray;
//     if (parentArray.length > 1) {
//       parentArray.removeAt(rowIndex);
//     }
//   }

//   // Helper methods
//   public getFormArray(form: FormGroup, fieldName: string): FormArray {
//     const control = form.get(fieldName);
//     return control instanceof FormArray ? control : this.fb.array([]);
//   }

//   public getNestedFormArray(form: FormGroup, fieldName: string, index: number): FormArray {
//     try {
//       const formArray = this.getFormArray(form, fieldName);
//       if (index >= 0 && index < formArray.length) {
//         const arrayItem = formArray.at(index);
//         if (arrayItem instanceof FormArray) {
//           return arrayItem;
//         }
//       }
//     } catch (error) {
//       console.warn(`Error getting nested array for ${fieldName}[${index}]:`, error);
//     }
//     return this.fb.array([]);
//   }

//   getCurrentForm(): Observable<FormGroup | null> {
//     return this.currentForm.asObservable();
//   }

//   getCurrentSchema(): Observable<any> {
//     return this.currentSchema.asObservable();
//   }

//   getCurrentRequestId(): string | number | null {
//     return this.currentRequestId.value;
//   }

//   submitResponse(response: { action: 'accept' | 'decline' | 'cancel', content?: any}): void {
//     this.mcpService.submitElicitResponse(response);
//   }

//   validateAgainstSchema(data: any, schema: any): boolean {
//     if (!schema) return false;
//     const required = schema.required || [];
//     for (const field of required) {
//       if (data[field] === undefined || data[field] === null || data[field] === '') {
//         return false;
//       }
//       if (Array.isArray(data[field]) && data[field].length === 0) {
//         return false;
//       }
//     }
//     return true;
//   }
// }


// mcp-elicitation.service.ts
import { Injectable } from '@angular/core';
import { McpService } from '../mcp.service';
import { FormBuilder, FormGroup, Validators, FormArray, AbstractControl } from '@angular/forms';
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
    
    const formGroup = this.buildFormGroup(schema);
    this.currentForm.next(formGroup);
  }

  public buildFormGroup(schema: any): FormGroup {
    const formGroup = this.fb.group({});
    const properties = schema.properties;
    const required = schema.required || [];

    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      const field = fieldSchema as any;
      
      if (field.type === 'array') {
        console.log("Array Field type : ", field.type, fieldName)
        const formArray = this.createFormArray(field, required.includes(fieldName));
        formGroup.addControl(fieldName, formArray);
      } else if (field.type === 'object') {
        console.log("Object Field type : ", field.type, fieldName)
        const nestedFormGroup = this.createObjectFormArray(field, required.includes(fieldName));
        formGroup.addControl(fieldName, nestedFormGroup);
      } else {
        console.log("primative Field type : ", field.type, fieldName)
        const validators = this.createValidators(field, required.includes(fieldName));
        formGroup.addControl(
          fieldName,
          this.fb.control(field.default || null, validators)
        );
      }
    }
    return formGroup;
  }

  // Add this new method for object form arrays
private createObjectFormArray(field: any, isRequired: boolean): FormArray {
    const defaultItems = field.default || {};
    
    // Convert object to array of {key, value} pairs with explicit typing
    const keyValuePairs = Object.entries(defaultItems).map(([key, value]) => {
      return this.fb.group({
        key: [key, Validators.required],
        value: [value as string], // Explicitly cast to string
        valueType: [this.determineValueType(value)]
      });
    });

    // If no defaults but required, start with one empty pair
    if (keyValuePairs.length === 0 && isRequired) {
      keyValuePairs.push(
        this.fb.group({
          key: ['', Validators.required],
          value: [''], // Explicit empty string
          valueType: ['string']
        })
      );
    }

    return this.fb.array(keyValuePairs, isRequired ? Validators.required : null);
  }

private determineValueType(value: any): string {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

  private createObjectFormGroup(field: any, isRequired: boolean): FormGroup {
    console.log("Object form group : ", field)
    const nestedFormGroup = this.buildFormGroup(field);
    
    // Add required validator for the entire object if needed
    if (isRequired) {
      nestedFormGroup.setValidators(this.objectRequiredValidator);
    }
    
    return nestedFormGroup;
  }

  private objectRequiredValidator(control: AbstractControl): { [key: string]: any } | null {
    if (!(control instanceof FormGroup)) {
      return null;
    }
    
    const formGroup = control as FormGroup;
    const hasValues = Object.keys(formGroup.controls).some(controlName => {
      const controlValue = formGroup.get(controlName)?.value;
      return controlValue !== null && controlValue !== undefined && controlValue !== '';
    });
    
    return hasValues ? null : { objectRequired: true };
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
    } else if (field.items && field.items.type === 'object') {
      return this.createObjectFormArray(field, isRequired);
    } else {
      return this.createSimpleFormArray(field, isRequired);
    }
  }

  private createSimpleFormArray(field: any, isRequired: boolean): FormArray {
    const defaultItems = field.default || [];
    if (defaultItems.length > 0) {
      const formControls = defaultItems.map((item: any) => this.fb.control(item));
      return this.fb.array(formControls, isRequired ? Validators.required : null);
    } else if (isRequired) {
      return this.fb.array([this.fb.control(this.getDefaultArrayValue(field.items))], Validators.required);
    } else {
      return this.fb.array([]);
    }
  }

  // private createObjectFormArray(field: any, isRequired: boolean): FormArray {
  //   const defaultItems = field.default || [];
  //   const itemSchema = field.items;
    
  //   if (defaultItems.length > 0) {
  //     const formGroups = defaultItems.map((item: any) => this.buildFormGroup({
  //       properties: itemSchema.properties,
  //       required: itemSchema.required || []
  //     }));
  //     return this.fb.array(formGroups, isRequired ? Validators.required : null);
  //   } else if (isRequired) {
  //     // Start with one empty object form group
  //     const formGroup = this.buildFormGroup({
  //       properties: itemSchema.properties,
  //       required: itemSchema.required || []
  //     });
  //     return this.fb.array([formGroup], Validators.required);
  //   } else {
  //     return this.fb.array([]);
  //   }
  // }

  private createNestedFormArray(field: any, isRequired: boolean): FormArray {
    const defaultItems = field.default || [];
    if (defaultItems.length > 0) {
      const nestedArrays = defaultItems.map((nestedArray: any[]) => {
        return this.fb.array(
          nestedArray.map(item => this.fb.control(item))
        );
      });
      return this.fb.array(nestedArrays, isRequired ? Validators.required : null);
    } else if (isRequired) {
      const nestedFormArray = this.fb.array([
        this.fb.control(this.getDefaultArrayValue(field.items.items))
      ]);
      return this.fb.array([nestedFormArray], Validators.required);
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
    
    if (fieldSchema) {
      if (fieldSchema.items && fieldSchema.items.type === 'object') {
        // Add object form group
        const objectFormGroup = this.buildFormGroup({
          properties: fieldSchema.items.properties,
          required: fieldSchema.items.required || []
        });
        formArray.push(objectFormGroup);
      } else if (this.isNestedArray(fieldSchema)) {
        // Add nested array row
        this.addNestedArrayRow(form, fieldName);
      } else {
        // Add primitive value
        const defaultValue = this.getDefaultArrayValue(fieldSchema.items);
        formArray.push(this.fb.control(defaultValue));
      }
    }
  }

  public removeArrayItemFromForm(form: FormGroup, fieldName: string, index: number): void {
    const formArray = form.get(fieldName) as FormArray;
    if (formArray.length > 0) {
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
      if (nestedArray.length > 0) {
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
    
    const newRow = this.fb.array([this.fb.control(nestedValue)]);
    parentArray.push(newRow);
  }

  public removeNestedArrayRow(form: FormGroup, fieldName: string, rowIndex: number): void {
    const parentArray = form.get(fieldName) as FormArray;
    if (parentArray.length > 0) {
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

  public getObjectFormGroup(form: FormGroup, fieldName: string): FormGroup {
    const control = form.get(fieldName);
    return control instanceof FormGroup ? control : this.fb.group({});
  }

  public getObjectFormArrayItem(formArray: FormArray, index: number): FormGroup {
    try {
      if (index >= 0 && index < formArray.length) {
        const arrayItem = formArray.at(index);
        if (arrayItem instanceof FormGroup) {
          return arrayItem;
        }
      }
    } catch (error) {
      console.warn(`Error getting object array item at index ${index}:`, error);
    }
    return this.fb.group({});
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
      // For nested objects, recursively validate
      if (typeof data[field] === 'object' && !Array.isArray(data[field])) {
        const nestedSchema = schema.properties[field];
        if (nestedSchema && nestedSchema.type === 'object') {
          const isValid = this.validateAgainstSchema(data[field], nestedSchema);
          if (!isValid) return false;
        }
      }
    }
    return true;
  }
}