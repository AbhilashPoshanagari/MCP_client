import { TestBed } from '@angular/core/testing';

import { ToolformatterService } from './toolformatter.service';

describe('ToolformatterService', () => {
  let service: ToolformatterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToolformatterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
