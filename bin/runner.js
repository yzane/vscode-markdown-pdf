'use strict';

const vscode = require('vscode');

function run() {
  return new Promise((c, e) => {
    (async () => {
      const type = process.env.type;
      const source = process.env.source;
      var document = await vscode.workspace.openTextDocument(source);
      await vscode.window.showTextDocument(document);
      await vscode.commands.executeCommand('extension.markdown-pdf.' + type);
      c();
    })()
  });
}

exports.run = run;
