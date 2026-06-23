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

    it('appends a "Caused by" section for an Error with a cause', () => {
      const inner = new Error('inner reason');
      const outer = new Error('outer failure') as Error & { cause?: unknown };
      outer.cause = inner;
      const out = logger.formatError(outer);
      assert.ok(out.includes(outer.stack ?? 'outer failure'));
      assert.match(out, /Caused by:/);
      assert.ok(out.includes(inner.stack ?? 'inner reason'));
    });

    it('follows a multi-level cause chain in order', () => {
      const inner = new Error('LEVELROOT');
      const mid = new Error('LEVELMID') as Error & { cause?: unknown };
      mid.cause = inner;
      const outer = new Error('LEVELTOP') as Error & { cause?: unknown };
      outer.cause = mid;
      const out = logger.formatError(outer);
      const iTop = out.indexOf('LEVELTOP');
      const iMid = out.indexOf('LEVELMID');
      const iRoot = out.indexOf('LEVELROOT');
      assert.ok(iTop >= 0 && iMid > iTop && iRoot > iMid);
    });

    it('stringifies a non-Error cause', () => {
      const outer = new Error('outer') as Error & { cause?: unknown };
      outer.cause = 'plain root reason';
      assert.match(logger.formatError(outer), /Caused by: plain root reason/);
    });

    it('expands AggregateError.errors (duck-typed)', () => {
      const agg = new Error('all failed') as Error & { errors: unknown[] };
      agg.name = 'AggregateError';
      agg.errors = [new Error('AGGFIRST'), new Error('AGGSECOND')];
      const out = logger.formatError(agg);
      assert.match(out, /Aggregated error \[0\]/);
      assert.match(out, /AGGFIRST/);
      assert.match(out, /Aggregated error \[1\]/);
      assert.match(out, /AGGSECOND/);
    });

    it('does not loop on a circular cause', () => {
      const a = new Error('a') as Error & { cause?: unknown };
      const b = new Error('b') as Error & { cause?: unknown };
      a.cause = b;
      b.cause = a;
      let out = '';
      assert.doesNotThrow(() => { out = logger.formatError(a); });
      assert.match(out, /\[circular error reference\]/);
    });

    it('truncates a cause chain deeper than the limit', () => {
      const head = new Error('level-0') as Error & { cause?: unknown };
      let cur = head;
      for (let i = 1; i <= 7; i++) {
        const next = new Error('level-' + i) as Error & { cause?: unknown };
        cur.cause = next;
        cur = next;
      }
      assert.match(logger.formatError(head), /\[error chain truncated\]/);
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
