import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const origin = 'https://example.com';
const scope = origin + '/tagscanner/';
const currentName = 'tagscanner-/tagscanner/-v6';
const script = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

function harness() {
  const stores = new Map<string, Map<string, string>>();
  const handlers: Record<string, (event: unknown) => void> = {};
  const key = (request: string | { url: string }) => typeof request === 'string' ? request : request.url;
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const cache = stores.get(name)!;
      return {
        keys: async () => [...cache.keys()].map(url => ({ url })),
        delete: async (request: { url: string }) => cache.delete(key(request)),
        match: async (request: string | { url: string }) => cache.get(key(request)),
      };
    },
  };
  vm.runInNewContext(script, {
    URL, caches, fetch: async () => { throw new Error('offline'); },
    self: {
      registration: { scope }, location: { origin }, clients: { claim: async () => {} },
      addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler; },
    },
  });
  return { stores, handlers };
}

describe('service worker upgrades', () => {
  it('migrates only this site out of legacy shared caches', async () => {
    const { stores, handlers } = harness();
    const other = origin + '/AnyTagScanner/';
    stores.set('tagscanner-v4', new Map([[scope, 'old'], [other, 'other site']]));
    stores.set('tagscanner-/tagscanner/-v5', new Map([[scope, 'prior']]));
    stores.set(currentName, new Map([[scope, 'new']]));
    stores.set('unrelated', new Map([[origin + '/', 'keep']]));
    let activation: Promise<void> | undefined;
    handlers.activate({ waitUntil: (promise: Promise<void>) => { activation = promise; } });
    await activation;
    expect(stores.get('tagscanner-v4')?.has(scope)).toBe(false);
    expect(stores.get('tagscanner-v4')?.get(other)).toBe('other site');
    expect(stores.has('tagscanner-/tagscanner/-v5')).toBe(false);
    expect(stores.get(currentName)?.get(scope)).toBe('new');
    expect(stores.has('unrelated')).toBe(true);
  });

  it('uses only the current cache for offline navigation and unversioned assets', async () => {
    const { stores, handlers } = harness();
    const worker = scope + 'vendor/barcode/worker.js';
    stores.set('tagscanner-v4', new Map([[scope, 'old HTML'], [worker, 'old worker']]));
    stores.set(currentName, new Map([[scope, 'new HTML'], [worker, 'new worker']]));
    for (const [url, mode, expected] of [[scope, 'navigate', 'new HTML'], [worker, 'same-origin', 'new worker']]) {
      let response: Promise<unknown> | undefined;
      handlers.fetch({ request: { url, mode, method: 'GET' }, respondWith: (promise: Promise<unknown>) => { response = promise; } });
      expect(await response).toBe(expected);
    }
  });
});
