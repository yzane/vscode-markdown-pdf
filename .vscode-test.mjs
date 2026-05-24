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
const launchArgs = [
  '--user-data-dir=' + userDataDir,
  '--no-sandbox',
  '--disable-setuid-sandbox',
];

fs.mkdirSync(settingsDir, { recursive: true });
fs.writeFileSync(path.join(settingsDir, 'settings.json'), JSON.stringify({
  'security.workspace.trust.enabled': false,
  'markdown-pdf.plantumlServer': 'http://www.plantuml.com/plantuml',
}));

export default defineConfig([
  {
    label: 'integration',
    files: 'test/integration/**/*.test.ts',
    mocha: { ui: 'tdd', timeout: 60000, require: ['tsx'] },
    skipExtensionDependencies: true,
    launchArgs,
    ...installationOption,
  },
  {
    label: 'sample',
    files: 'test/sample/generate-sample.ts',
    mocha: { ui: 'tdd', timeout: 120000, require: ['tsx'] },
    skipExtensionDependencies: true,
    launchArgs,
    ...installationOption,
  },
  {
    label: 'readme-previews',
    files: 'test/sample/update-readme-previews.ts',
    mocha: { ui: 'tdd', timeout: 120000, require: ['tsx'] },
    skipExtensionDependencies: true,
    launchArgs,
    ...installationOption,
  },
]);
