'use strict';

const rimraf = require('rimraf')

// const assert = require('assert');
const before = require('mocha').before;
const path = require('path');

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
const vscode = require('vscode');
// const myExtension = require('.extension');

suite('Extension Test Suite', () => {
    before(() => {
        vscode.window.showInformationMessage('Start all tests.');
    });

    test('Mermaid', async function() {
        this.timeout(6000000);
        var textDocument = await vscode.workspace.openTextDocument(path.resolve(__dirname, 'mermaid.md'));
        await vscode.window.showTextDocument(textDocument);
        await vscode.commands.executeCommand('extension.markdown-pdf.all');

        rimraf.sync(path.resolve(__dirname, 'mermaid.pdf'));
        rimraf.sync(path.resolve(__dirname, 'mermaid.jpeg'));
        rimraf.sync(path.resolve(__dirname, 'mermaid.png'));
        rimraf.sync(path.resolve(__dirname, 'mermaid.html'));
    });
});
