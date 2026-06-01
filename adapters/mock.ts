import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Adapter, AdapterOpts, AdapterRunResult } from "./base.js";

/**
 * Deterministic offline adapter. Reads a fixture response from the routine's
 * fixtures/ directory so the whole engine is provable without any real model CLI.
 *
 * Fixture selection: fixtures/response.<variant>.json, default variant "ok".
 */
export class MockAdapter implements Adapter {
  readonly name = "mock";

  constructor(private readonly variant: string = "ok") {}

  async run(_composedPrompt: string, opts: AdapterOpts): Promise<AdapterRunResult> {
    const fixturePath = join(
      opts.loaded.dir,
      "fixtures",
      `response.${this.variant}.json`,
    );
    if (!existsSync(fixturePath)) {
      return {
        raw: `MOCK: no fixture for variant "${this.variant}"`,
        exitStatus: 1,
      };
    }
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
      raw: string;
      exitStatus?: number;
    };
    return { raw: fixture.raw, exitStatus: fixture.exitStatus ?? 0 };
  }
}
