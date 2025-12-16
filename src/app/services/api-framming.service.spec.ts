import { TestBed } from '@angular/core/testing';

import { ApiFrammingService } from './api-framming.service';

describe('ApiFrammingService', () => {
  let service: ApiFrammingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ApiFrammingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
