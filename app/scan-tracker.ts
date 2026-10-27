export type Identified = { text: string; format: string };

export class ScanTracker {
  private seen = new Map<string, { at: number; count: number; recorded: boolean }>();

  reset() { this.seen.clear(); }

  observe<T extends Identified>(items: T[], now: number, stillImage = false) {
    const present = new Set(items.map(item => JSON.stringify([item.format, item.text])));
    for (const [key, value] of this.seen) {
      if ((!present.has(key) || value.count === 0) && now - value.at > 1200) this.seen.delete(key);
      else if (!present.has(key)) value.count = 0;
    }
    const visible: T[] = [];
    const fresh: T[] = [];
    for (const item of items) {
      const key = JSON.stringify([item.format, item.text]);
      const previous = this.seen.get(key);
      const count = previous && now - previous.at < 600 ? previous.count + 1 : 1;
      const fragile = /micro|rmqr|databar|rss/i.test(item.format);
      const accepted = stillImage || !fragile || count >= 3;
      const recorded = previous?.recorded ?? false;
      this.seen.set(key, { at: now, count, recorded: recorded || accepted });
      if (accepted) visible.push(item);
      if (accepted && !recorded) fresh.push(item);
    }
    return { visible, fresh };
  }
}
