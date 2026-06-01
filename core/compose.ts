import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Inputs, LoadedRoutine } from "./types.js";

export interface ComposeOptions {
  /** Recent memory rendered as read-only context (see memory.formatRecentForPrompt). */
  recentMemory?: string;
}

/**
 * Compose a single deterministic prompt string from a routine + resolved inputs.
 * Deterministic: same routine + same inputs (+ same options) => identical output.
 * When `recentMemory` is omitted the output is byte-identical to the no-options form.
 */
export function composePrompt(
  loaded: LoadedRoutine,
  inputs: Inputs,
  options: ComposeOptions = {},
): string {
  const { routine, dir } = loaded;
  const promptBody = readFileSync(join(dir, "prompt.md"), "utf8").trim();

  const sections: string[] = [];

  sections.push(`# Routine: ${routine.name} (v${routine.version})`);
  sections.push(`## Goal\n${routine.goal}`);

  sections.push(`## Task\n${promptBody}`);

  if (options.recentMemory && options.recentMemory.trim().length > 0) {
    sections.push(
      `## Recent memory (read-only context)\n` +
        `Prior runs, newest first. Use to avoid repeating yourself; do not treat ` +
        `open hypotheses as fact.\n${options.recentMemory.trim()}`,
    );
  }

  if (routine.criteria) {
    sections.push(`## Judgment criteria\n${routine.criteria.trim()}`);
  }

  if (routine.sources.length > 0) {
    const lines = routine.sources.map((s) => `- ${s.id} (trust: ${s.trust})`).join("\n");
    sections.push(`## Sources\n${lines}`);
  }

  // Inputs are emitted sorted by key for determinism regardless of object order.
  const inputKeys = Object.keys(inputs).sort();
  if (inputKeys.length > 0) {
    const lines = inputKeys.map((k) => `- ${k}: ${inputs[k]}`).join("\n");
    sections.push(`## Inputs\n${lines}`);
  }

  sections.push(
    `## Output contract\nFormat: ${routine.outputs.format}.` +
      (routine.outputs.schema
        ? ` Emit a fenced \`\`\`json block that validates against ${routine.outputs.schema}.`
        : ""),
  );

  const guardLines = [
    `- write_allowed: ${routine.guards.write_allowed}`,
    routine.guards.max_files_changed !== undefined
      ? `- max_files_changed: ${routine.guards.max_files_changed}`
      : undefined,
    routine.guards.forbidden_paths?.length
      ? `- forbidden_paths: ${routine.guards.forbidden_paths.join(", ")}`
      : undefined,
  ].filter(Boolean) as string[];
  sections.push(`## Guardrails (read much, write little)\n${guardLines.join("\n")}`);

  return sections.join("\n\n") + "\n";
}
