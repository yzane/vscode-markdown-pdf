import { describe, it, mock } from 'node:test';
import assert from 'assert';
import childProcess from 'child_process';
import type { SpawnSyncOptionsWithStringEncoding } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildPlantumlImageSource } from '../../src/utils';

describe('local PlantUML rendering', function () {
  it('passes UTF-8 source to Java and embeds the returned SVG', function () {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-pdf-plantuml-'));
    const jarPath = path.join(directory, 'plantuml.jar');
    fs.writeFileSync(jarPath, '');
    const source = '@startuml\nAlice -> Bob: 日本語\n@enduml';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>日本語</text></svg>';
    const spawn = mock.method(childProcess, 'spawnSync', (command: string, args: readonly string[], options: SpawnSyncOptionsWithStringEncoding) => {
      assert.strictEqual(command, 'java');
      assert.deepStrictEqual(args, ['-jar', jarPath, '-tsvg', '-pipe', '-charset', 'UTF-8']);
      assert.strictEqual(options.input, source);
      assert.strictEqual(options.encoding, 'utf8');
      return { status: 0, stdout: svg, stderr: '' };
    });
    try {
      const result = buildPlantumlImageSource(source, 'https://unused.example.com', jarPath);
      assert.strictEqual(result, 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64'));
      assert.strictEqual(spawn.mock.callCount(), 1);
    } finally {
      spawn.mock.restore();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('reports Java startup, rendering, and invalid output failures', function () {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-pdf-plantuml-'));
    const jarPath = path.join(directory, 'plantuml.jar');
    fs.writeFileSync(jarPath, '');
    try {
      for (const [result, expected] of [
        [{ error: new Error('Java missing') }, /Unable to start Java for PlantUML: Java missing/],
        [{ status: 1, stderr: 'syntax error', stdout: '' }, /PlantUML JAR rendering failed: syntax error/],
        [{ status: 0, stdout: 'not SVG', stderr: '' }, /PlantUML JAR did not return SVG output/],
      ] as const) {
        const spawn = mock.method(childProcess, 'spawnSync', () => result);
        try {
          assert.throws(() => buildPlantumlImageSource('source', '', jarPath), expected);
        } finally {
          spawn.mock.restore();
        }
      }
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
