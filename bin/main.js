#!/usr/bin/env node

'use strict';

const path = require('path');
const { runTests } = require('vscode-test');

async function main() {
  try {
    if (process.argv.length != 4) { // ['node', 'bin/main.js', type, source]
      usage();
      throw 'invalid arguments';
    }
    const type = process.argv[2];
    const source = process.argv[3];

    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test runner script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './runner');

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ['--disable-extensions'],
      extensionTestsEnv: { type, source }
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

function usage() {
  console.log(`
vscode-markdown-pdf TYPE FILE

TYPE    A type of output; pdf, html, png, jpeg, or all.
FILE    A source Markdown path.
  `.trim());
}

main();
