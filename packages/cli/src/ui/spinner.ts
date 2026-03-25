import ora, { type Ora } from 'ora';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Spinner {
  start(text?: string): void;
  stop(): void;
  succeed(text?: string): void;
  fail(text?: string): void;
  update(text: string): void;
}

export interface SpinnerOptions {
  /** When true, all spinner methods are no-ops (dry-run mode). */
  dryRun?: boolean;
}

// ── Global dry-run flag (set once at CLI startup) ─────────────────────────────

let globalDryRun = false;
/** Configure dry-run mode globally. */
export const setDryRun = (enabled: boolean): void => { globalDryRun = enabled; };

// ── Spinner implementations ───────────────────────────────────────────────────

const noop = (): void => undefined;
const createNoOpSpinner = (): Spinner =>
  ({ start: noop, stop: noop, succeed: noop, fail: noop, update: noop });

const createOraSpinner = (text: string): Spinner => {
  const s: Ora = ora(text);
  return {
    start: (t?: string) => { s.start(t); },
    stop: () => { s.stop(); },
    succeed: (t?: string) => { s.succeed(t); },
    fail: (t?: string) => { s.fail(t); },
    update: (t: string) => { s.text = t; },
  };
};

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create a new independent spinner.
 * Returns a no-op when dry-run mode is active (per options or global flag).
 */
export const createSpinner = (text: string, options: SpinnerOptions = {}): Spinner => {
  const isDryRun = options.dryRun ?? globalDryRun;
  return isDryRun ? createNoOpSpinner() : createOraSpinner(text);
};
