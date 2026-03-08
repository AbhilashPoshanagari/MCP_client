import { TestBed } from '@angular/core/testing';

import { VoiceToTextService } from './voice-to-text.service';

describe('VoiceToTextService', () => {
  let service: VoiceToTextService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VoiceToTextService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
