// Lightweight logging facade. Stays free of any editor API import so that modules
// importing it (utils, math-renderer, chromium-resolver) remain unit-testable
// under tsx without a real editor runtime. The concrete sink is injected by
// extension.ts (the only host-aware module) at activation time.

export interface LogSink {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  show(preserveFocus?: boolean): void;
}

// Minimal host shape needed for initialization. The editor's ExtensionContext
// satisfies this structurally (no editor API import required here).
export interface LoggerHost {
  subscriptions: { push(disposable: { dispose(): void }): void };
}

let sink: LogSink | undefined;

export function setLogSink(s: LogSink | undefined): void {
  sink = s;
}

// Build the concrete channel via the injected factory, register it for disposal
// on the host lifecycle, and wire it as the active sink. Injecting the
// factory keeps this unit-testable with a fake host and fake factory.
export function initializeLogger(
  host: LoggerHost,
  createChannel: () => LogSink & { dispose(): void }
): void {
  const channel = createChannel();
  host.subscriptions.push(channel);
  setLogSink(channel);
}

export function logInfo(message: string, ...args: unknown[]): void {
  sink?.info(message, ...args);
}

export function logWarn(message: string, ...args: unknown[]): void {
  sink?.warn(message, ...args);
}

export function logError(message: string, ...args: unknown[]): void {
  sink?.error(message, ...args);
}

export function showLog(): void {
  sink?.show(true);
}

// Maximum depth to follow an error's cause chain / aggregated errors, guarding
// against pathologically deep or cyclic chains.
const MAX_ERROR_DEPTH = 5;

// Deterministically stringify an unknown error for logging. Prefer the stack
// (richest debug info); fall back to "name: message"; non-Error values via String().
// Follows error.cause and AggregateError.errors so a root cause nested by a wrapper
// is not lost. cause/AggregateError are read by duck typing because the tsconfig lib
// is ES2020 (their static types are unavailable), while Node provides them at runtime.
export function formatError(error: unknown): string {
  return formatErrorAt(error, 0, new Set<unknown>());
}

function formatErrorAt(error: unknown, depth: number, seen: Set<unknown>): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  if (seen.has(error)) {
    return '[circular error reference]';
  }
  if (depth >= MAX_ERROR_DEPTH) {
    return '[error chain truncated]';
  }
  seen.add(error);

  let result = error.stack ?? `${error.name}: ${error.message}`;

  // AggregateError (e.g. from Promise.any): include each aggregated error.
  const errors = (error as { errors?: unknown }).errors;
  if (error.name === 'AggregateError' && Array.isArray(errors)) {
    errors.forEach((sub, index) => {
      result += `\nAggregated error [${index}]: ${formatErrorAt(sub, depth + 1, seen)}`;
    });
  }

  // Follow the cause chain (the cause may itself be any value, not only an Error).
  const cause = (error as { cause?: unknown }).cause;
  if (cause !== undefined && cause !== null) {
    result += `\nCaused by: ${formatErrorAt(cause, depth + 1, seen)}`;
  }

  return result;
}
