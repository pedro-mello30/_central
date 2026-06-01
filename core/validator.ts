import { readFileSync } from "node:fs";
import Ajv from "ajv";
import type { Failure } from "./types.js";

const ajv = new Ajv({ allErrors: true, strict: false });

export interface ValidationResult {
  valid: boolean;
  failures: Failure[];
}

/**
 * Extract the last fenced ```json block from model output. Adapters emit JSON inside
 * a fenced block by convention; we take the last one to skip examples in prose.
 */
export function extractJsonBlock(raw: string): unknown | undefined {
  const re = /```json\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  let last: string | undefined;
  while ((match = re.exec(raw)) !== null) {
    last = match[1];
  }
  if (last === undefined) return undefined;
  try {
    return JSON.parse(last);
  } catch {
    return undefined;
  }
}

/** Validate parsed output against a JSON Schema file. */
export function validateOutput(json: unknown, schemaPath: string): ValidationResult {
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const validate = ajv.compile(schema);
  const valid = validate(json) as boolean;
  if (valid) return { valid: true, failures: [] };
  const failures: Failure[] = (validate.errors ?? []).map((e) => ({
    stage: "validate" as const,
    message: `${e.instancePath || "(root)"} ${e.message ?? "is invalid"}`,
  }));
  return { valid: false, failures };
}
