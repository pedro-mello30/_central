import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { LoadedRoutine, Routine } from "./types.js";

const sourceSchema = z.object({
  id: z.string().min(1),
  trust: z.enum(["source", "context", "hypothesis"]),
});

const triggerSchema = z.object({
  type: z.enum(["schedule", "api", "github", "manual"]),
  cron: z.string().optional(),
});

const toolsSchema = z
  .object({
    shell: z.boolean().optional(),
    web: z.boolean().optional(),
    mcp: z.array(z.string()).optional(),
  })
  .default({});

const outputsSchema = z.object({
  format: z.string().min(1),
  schema: z.string().optional(),
});

const guardsSchema = z.object({
  write_allowed: z.boolean(),
  forbidden_paths: z.array(z.string()).optional(),
  max_files_changed: z.number().int().nonnegative().optional(),
});

const learningSchema = z
  .object({
    memory: z.string().optional(),
    promote: z.enum(["human", "auto"]).optional(),
  })
  .optional();

/** Zod schema for a routine.yaml — used by both the engine and tests to validate fixture files. */
export const routineSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "name must be kebab-case"),
  version: z.number().int().positive(),
  goal: z.string().min(1),
  trigger: triggerSchema,
  sources: z.array(sourceSchema).default([]),
  inputs: z.array(z.string()).default([]),
  tools: toolsSchema,
  criteria: z.string().optional(),
  outputs: outputsSchema,
  guards: guardsSchema,
  learning: learningSchema,
});

/** Thrown when routine.yaml fails Zod validation; carries the full issue list for structured logging. */
export class RoutineValidationError extends Error {
  constructor(public readonly issues: z.ZodIssue[]) {
    super(
      "Invalid routine.yaml:\n" +
        issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n"),
    );
    this.name = "RoutineValidationError";
  }
}

/** Parse + validate a routine.yaml string into a Routine. */
export function parseRoutine(yamlText: string): Routine {
  const raw = parseYaml(yamlText);
  const result = routineSchema.safeParse(raw);
  if (!result.success) {
    throw new RoutineValidationError(result.error.issues);
  }
  return result.data;
}

/** Load a routine from a directory containing routine.yaml. */
export function loadRoutine(dir: string): LoadedRoutine {
  const yamlText = readFileSync(join(dir, "routine.yaml"), "utf8");
  return { routine: parseRoutine(yamlText), dir };
}
