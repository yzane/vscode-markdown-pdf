import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as utils from '../../src/utils';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('awaitWithTimeout', () => {
  it('returns the resolved value when the promise settles before timeout', async () => {
    const result = await utils.awaitWithTimeout(Promise.resolve('done'), 100);

    assert.deepEqual(result, { timedOut: false, value: 'done' });
  });

  it('propagates rejection when the promise rejects before timeout', async () => {
    const error = new Error('early failure');

    await assert.rejects(
      utils.awaitWithTimeout(Promise.reject(error), 100),
      error
    );
  });

  it('returns timedOut true when the promise stays pending past timeout', async () => {
    const pending = new Promise<string>(() => undefined);

    const result = await utils.awaitWithTimeout(pending, 5);

    assert.deepEqual(result, { timedOut: true });
  });

  it('does not emit unhandledRejection when the original promise rejects after timeout', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);

    let rejectLater!: (error: Error) => void;
    const lateRejecting = new Promise<void>((_, reject) => {
      rejectLater = reject;
    });

    try {
      const result = await utils.awaitWithTimeout(lateRejecting, 5);
      assert.deepEqual(result, { timedOut: true });

      rejectLater(new Error('late failure'));
      await delay(0);

      assert.deepEqual(unhandled, []);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('clears the timeout when the original promise resolves before timeout', async () => {
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    const fakeHandle = { kind: 'timeout' } as unknown as ReturnType<typeof setTimeout>;
    let cleared = false;

    try {
      global.setTimeout = ((handler: (...args: unknown[]) => void, timeout?: number, ...args: unknown[]) => {
        return fakeHandle;
      }) as typeof setTimeout;
      global.clearTimeout = ((handle?: ReturnType<typeof setTimeout>) => {
        if (handle === fakeHandle) {
          cleared = true;
        }
      }) as typeof clearTimeout;

      const result = await utils.awaitWithTimeout(Promise.resolve('fast'), 1000);

      assert.deepEqual(result, { timedOut: false, value: 'fast' });
      assert.equal(cleared, true);
    } finally {
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
    }
  });

  it('clears the timeout when the original promise rejects before timeout', async () => {
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    const fakeHandle = { kind: 'timeout' } as unknown as ReturnType<typeof setTimeout>;
    let cleared = false;

    try {
      global.setTimeout = ((handler: (...args: unknown[]) => void, timeout?: number, ...args: unknown[]) => {
        return fakeHandle;
      }) as typeof setTimeout;
      global.clearTimeout = ((handle?: ReturnType<typeof setTimeout>) => {
        if (handle === fakeHandle) {
          cleared = true;
        }
      }) as typeof clearTimeout;

      const error = new Error('fast failure');
      await assert.rejects(utils.awaitWithTimeout(Promise.reject(error), 1000), error);

      assert.equal(cleared, true);
    } finally {
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
    }
  });
});
