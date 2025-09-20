import { Injectable } from '@angular/core';
// import { Domain } from '../models/domain';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  saveValuesInKey(key: string, value: any): void {
    localStorage.setItem(key, value);
  }

  getValueFromKey(key: string): any {
    const data = localStorage.getItem(key);
    return data ? data : '';
  }
}

