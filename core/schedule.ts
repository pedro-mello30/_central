import type { LoadedRoutine } from "./types.js";

export interface ScheduleOptions {
  /** Model to run under (mock | claude | codex). */
  model: string;
  /** Absolute path to the _central repo root (where run.ts lives). */
  repoDir: string;
  /** Directory for run logs, relative to repoDir or absolute. Default: "runs". */
  logDir?: string;
}

/**
 * Translate a routine's `trigger.cron` into an installable host crontab line.
 * Execution stays on the host's cron — `_central` only emits the line, keeping
 * scheduling vendor-neutral. Throws if the routine is not a schedule trigger.
 */
export function crontabLine(loaded: LoadedRoutine, opts: ScheduleOptions): string {
  const { routine } = loaded;
  if (routine.trigger.type !== "schedule") {
    throw new Error(
      `routine "${routine.name}" has trigger.type "${routine.trigger.type}", not "schedule"`,
    );
  }
  if (!routine.trigger.cron) {
    throw new Error(`routine "${routine.name}" has no trigger.cron`);
  }

  const logDir = opts.logDir ?? "runs";
  const log = `${logDir}/${routine.name}.log`;
  const cmd =
    `cd ${opts.repoDir} && npx tsx run.ts run ${routine.name} --model ${opts.model} ` +
    `>> ${log} 2>&1`;
  return `${routine.trigger.cron} ${cmd}`;
}
