import { describe, expect, it } from 'vitest';
import { ScanTracker } from '../app/scan-tracker';

describe('live detection history', () => {
  const qr = { text: 'tagscanner', format: 'QRCode' };
  it('records a continuously visible symbol once and records its return after absence', () => {
    const tracker = new ScanTracker();
    expect(tracker.observe([qr], 0).fresh).toEqual([qr]);
    for (let time = 100; time <= 5000; time += 100) {
      expect(tracker.observe([qr], time).fresh).toEqual([]);
    }
    tracker.observe([], 6300);
    expect(tracker.observe([qr], 6400).fresh).toEqual([qr]);
  });
  it('confirms fragile formats over consecutive frames without blocking a normal code', () => {
    const tracker = new ScanTracker();
    const noise = { text: '123', format: 'DataBar' };
    expect(tracker.observe([noise], 0).visible).toEqual([]);
    expect(tracker.observe([noise, qr], 100).visible).toEqual([qr]);
    expect(tracker.observe([noise], 200).fresh).toEqual([noise]);
    expect(tracker.observe([noise], 300).fresh).toEqual([]);
  });
  it('does not accumulate intermittent noise as consecutive confirmation', () => {
    const tracker = new ScanTracker();
    const noise = { text: '1', format: 'MicroQRCode' };
    for (let time = 0; time < 10000; time += 700) {
      expect(tracker.observe([noise], time).visible).toEqual([]);
    }
  });

  it('does not treat a slow decoder as a disappeared symbol', () => {
    const tracker = new ScanTracker();
    expect(tracker.observe([qr], 0).fresh).toEqual([qr]);
    expect(tracker.observe([qr], 2500).fresh).toEqual([]);
    expect(tracker.observe([qr], 5000).fresh).toEqual([]);
    tracker.observe([], 5100);
    expect(tracker.observe([qr], 6500).fresh).toEqual([qr]);
  });
});
