import { defineConfig } from '@vscode/test-cli';
import fs from 'fs';
import os from 'os';
import path from 'path';
const isWSL2 = !!process.env.WSL_DISTRO_NAME;

function detectVSCodePath() {
  if (isWSL2) {
    return null;
  }

  const candidates = [];

  if (process.platform === 'win32') {
    candidates.push(
      path.join(process.env.LOCALAPPDATA || '', 'Programs/Microsoft VS Code/Code.exe'),
      'C:\\Program Files\\Microsoft VS Code\\Code.exe'
    );
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Visual Studio Code.app/Contents/MacOS/Electron');
  } else {
    candidates.push('/usr/share/code/code', '/usr/bin/code');
  }

  return candidates.find((c) => fs.existsSync(c)) || null;
}

const vscodePath = detectVSCodePath();
const installationOption = vscodePath ? { useInstallation: { fromPath: vscodePath } } : {};
const userDataDir = path.join(os.tmpdir(), 'vscode-test-userdata-linux');
const settingsDir = path.join(userDataDir, 'User');

fs.mkdirSync(settingsDir, { recursive: true });
fs.writeFileSync(path.join(settingsDir, 'settings.json'), JSON.stringify({
  'security.workspace.trust.enabled': false,
  'markdown-pdf.plantumlServer': 'http://www.plantuml.com/plantuml',
}));

export default defineConfig([
  {
    label: 'integration',
    files: 'test/integration/**/*.test.js',
    mocha: { ui: 'tdd', timeout: 60000 },
    skipExtensionDependencies: true,
    launchArgs: ['--user-data-dir=' + userDataDir],
    ...installationOption,
  },
]);
