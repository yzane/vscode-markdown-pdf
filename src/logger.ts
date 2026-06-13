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

let sink: LogSink | undefined;

export function setLogSink(s: LogSink | undefined): void {
  sink = s;
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
