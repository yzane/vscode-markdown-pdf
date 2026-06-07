import { pathToFileURL } from 'node:url';

/**
 * Converts an absolute filesystem path to the project's file URI contract,
 * in an OS-independent way.
 *
 * OS-dependent parts (drive letter, slash direction) are delegated to Node's
 * pathToFileURL. The project-specific contract is then applied as a thin layer:
 * spaces and unicode are kept literal (decoded), and '#' is escaped as %23.
 *
 * On POSIX, pathToFileURL still percent-encodes spaces/unicode; decodeURIComponent
 * cancels that encoding (round-trip), so the result equals the original POSIX
 * literal (e.g. '/home/user/x.png' -> 'file:///home/user/x.png').
 */
export function fileUri(absPath: string): string {
  return decodeURIComponent(pathToFileURL(absPath).href).replace(/#/g, '%23');
}
