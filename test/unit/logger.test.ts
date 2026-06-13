import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import * as logger from '../../src/logger';
import type { LogSink } from '../../src/logger';

interface Recorded { method: string; args: unknown[]; }

function makeFakeSink(): { sink: LogSink; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const sink: LogSink = {
    info: (...args: unknown[]) => { calls.push({ method: 'info', args }); },
    warn: (...args: unknown[]) => { calls.push({ method: 'warn', args }); },
    error: (...args: unknown[]) => { calls.push({ method: 'error', args }); },
    show: (...args: unknown[]) => { calls.push({ method: 'show', args }); },
  };
  return { sink, calls };
}

describe('logger', () => {
  afterEach(() => {
    logger.setLogSink(undefined);
  });

  it('forwards logInfo/logWarn/logError to the sink with all arguments', () => {
    const { sink, calls } = makeFakeSink();
    logger.setLogSink(sink);

    logger.logInfo('hello', 1, 'a');
    logger.logWarn('careful', { x: 1 });
    logger.logError('boom');

    assert.deepEqual(calls, [
      { method: 'info', args: ['hello', 1, 'a'] },
      { method: 'warn', args: ['careful', { x: 1 }] },
      { method: 'error', args: ['boom'] },
    ]);
  });

  it('showLog calls sink.show(true)', () => {
    const { sink, calls } = makeFakeSink();
    logger.setLogSink(sink);

    logger.showLog();

    assert.deepEqual(calls, [{ method: 'show', args: [true] }]);
  });

  it('is a no-op when no sink is set', () => {
    logger.setLogSink(undefined);
    assert.doesNotThrow(() => {
      logger.logInfo('x');
      logger.logWarn('y');
      logger.logError('z');
      logger.showLog();
    });
  });

  describe('formatError', () => {
    it('returns the stack for an Error that has one', () => {
      const err = new Error('boom');
      assert.equal(logger.formatError(err), err.stack);
    });

    it('falls back to "name: message" when stack is absent', () => {
      const err = new Error('boom');
      err.stack = undefined;
      assert.equal(logger.formatError(err), 'Error: boom');
    });

    it('stringifies non-Error values', () => {
      assert.equal(logger.formatError('plain'), 'plain');
      assert.equal(logger.formatError(42), '42');
      assert.equal(logger.formatError(null), 'null');
    });
  });

  describe('initializeLogger', () => {
    it('creates the channel once, registers it, and routes logs to it', () => {
      const pushed: { dispose(): void }[] = [];
      const host = { subscriptions: { push: (d: { dispose(): void }) => { pushed.push(d); } } };
      const warnCalls: unknown[][] = [];
      let created = 0;
      const channel = {
        info() {},
        warn(...a: unknown[]) { warnCalls.push(a); },
        error() {},
        show() {},
        dispose() {},
      };
      const factory = () => { created++; return channel; };

      logger.initializeLogger(host, factory);

      assert.equal(created, 1);
      assert.equal(pushed.length, 1);
      assert.equal(pushed[0], channel);

      logger.logWarn('routed');
      assert.deepEqual(warnCalls, [['routed']]);
    });
  });
});
