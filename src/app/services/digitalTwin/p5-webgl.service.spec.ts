import { TestBed } from '@angular/core/testing';

import { P5WebglService } from './p5-webgl.service';

describe('P5WebglService', () => {
  let service: P5WebglService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(P5WebglService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
