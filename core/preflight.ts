import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Failure, Inputs, LoadedRoutine } from "./types.js";

/**
 * Cheap checks performed BEFORE invoking the model. Collects failures rather than
 * throwing, so the runner can surface them as visible output.
 */
export function preflight(
  loaded: LoadedRoutine,
  inputs: Inputs,
  composedPrompt: string,
): Failure[] {
  const { routine, dir } = loaded;
  const failures: Failure[] = [];
  const fail = (message: string) => failures.push({ stage: "preflight", message });

  // 1. All declared inputs resolved and non-empty.
  for (const name of routine.inputs) {
    const v = inputs[name];
    if (v === undefined || v === "") {
      fail(`required input "${name}" is not resolved`);
    }
  }

  // 2. Guard coherence: write-narrow posture must be internally consistent.
  if (
    routine.guards.write_allowed === false &&
    routine.guards.max_files_changed !== undefined &&
    routine.guards.max_files_changed > 0
  ) {
    fail(
      `incoherent guards: write_allowed=false but max_files_changed=${routine.guards.max_files_changed}`,
    );
  }

  // 3. Composed prompt must be non-empty.
  if (composedPrompt.trim().length === 0) {
    fail("composed prompt is empty");
  }

  // 4. If an output schema is declared, it must exist and parse.
  if (routine.outputs.schema) {
    const schemaPath = join(dir, routine.outputs.schema);
    if (!existsSync(schemaPath)) {
      fail(`output schema "${routine.outputs.schema}" not found`);
    } else {
      try {
        JSON.parse(readFileSync(schemaPath, "utf8"));
      } catch {
        fail(`output schema "${routine.outputs.schema}" is not valid JSON`);
      }
    }
  }

  return failures;
}
