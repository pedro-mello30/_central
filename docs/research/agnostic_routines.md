claude code routines
Completed 2 steps
Claude Code routines are repeatable automations you configure once with a prompt, repo, and connectors, then run on a schedule, via API, or on GitHub events in Anthropic’s cloud. They’re part of Claude Code’s research preview and are available on Pro, Max, Team, and Enterprise plans with daily run limits.

What they do
Routines are meant for backlog work, PR review, alert triage, and other repeatable tasks that benefit from an LLM making judgments rather than just executing fixed steps. Because they run on Claude Code’s web infrastructure, your laptop does not need to stay open.

Trigger types
Anthropic documents three trigger modes: scheduled runs, API-triggered runs, and GitHub event–triggered runs. A routine gets its own endpoint and auth token for API use, and GitHub routines can start a new session per matching PR or event.

Limits and access
The docs say routines are available in Claude Code on the web, and usage counts against your subscription limits. Daily caps are 5 for Pro, 15 for Max, and 25 for Team and Enterprise, with extra usage possible beyond those caps.

Good fit
For your kind of work, routines look especially useful for AI-assisted GTM ops, PR triage, inbox triage, and semi-structured research workflows where an LLM should interpret context before acting. If you want, I can turn this into a practical setup template for one routine, like lead enrichment, GitHub PR review, or daily market scanning.

how to create routines that is agnostic to claude or codex
Completed 2 steps
To make routines portable across Claude Code and Codex, define them as vendor-neutral task specs and keep each model-specific runtime as a thin adapter. Claude Code routines are saved configs with prompt, repos, connectors, environment, and triggers running in Anthropic’s cloud, while Codex CLI is a local terminal agent that can inspect repos, edit files, run commands, and script repeatable workflows with exec.

Core pattern
Treat a routine as three layers: intent, tools, and runtime. Claude routines natively bundle prompt, repositories, connectors, environment, and triggers, while Codex exposes local scripting, approval modes, MCP, cloud tasks, and model selection, so the shared layer should be the task contract rather than the vendor’s UI or command syntax.

A good portable routine spec usually includes:

Goal: what success looks like.

Inputs: event payload, repo path, branch, env vars, secrets references.

Allowed actions: read files, run tests, open PR, post to Slack.

Output contract: markdown summary, JSON result, patch path, exit status.

Safety policy: max files changed, forbidden paths, approval requirement.
These are all concepts both systems can honor even though they expose them differently.

Practical design
Store routines in your repo as files like routines/pr-review.md plus routines/pr-review.schema.json and routines/pr-review.yaml. Claude can use repo-committed skills and .mcp.json from the cloned repository, and Codex can script repeatable workflows through the CLI, so repo-local routine definitions are the cleanest shared source of truth.

A portable YAML shape could look like this:

text
name: pr-review
goal: Review an incoming PR and produce actionable feedback.
inputs:
  - pr_url
  - repo
  - base_branch
tools:
  shell: true
  git: true
  web: false
  mcp:
    - github
outputs:
  format: markdown+json
  json_schema: review_result_v1
guards:
  max_files_changed: 20
  forbidden_paths:
    - infra/prod/**
steps:
  - fetch_pr
  - inspect_diff
  - run_tests
  - summarize_risks
  - emit_review
This works because the YAML is not tied to Anthropic triggers or Codex commands; each adapter only maps the same spec into its own execution surface.

Adapter layer
For Claude Code, the adapter should translate the shared spec into a routine prompt plus selected repositories, connectors, cloud environment, and trigger type such as schedule, API, or GitHub event. For Codex, the adapter should translate the same spec into a local codex exec or interactive session invocation, set the model and approval mode, and mount the right repo plus MCP access as needed.

In practice, build two tiny runners:

run_claude_routine.ts: reads the YAML, composes the Claude system/task prompt, and fires the routine via Claude’s web/API trigger model.

run_codex_routine.ts: reads the same YAML, composes the Codex prompt, and runs codex exec or a scripted CLI flow with your chosen mode.

The rule is simple: keep less than 10 percent of the logic in the adapter and more than 90 percent in shared artifacts such as prompt templates, schemas, test fixtures, and validators. That minimizes lock-in because changing vendors mostly means changing the execution shim, not the routine definition itself.

What to avoid
Do not encode Claude-only concepts like “connectors included by default” or “per-routine cloud endpoint” into the core spec, because those are runtime details, not task semantics. Do not encode Codex-only concepts like a specific approval flag or terminal UI interaction into the core spec either, because those are execution controls, not workflow intent.

Also avoid freeform prompts as the only artifact. A prompt alone is hard to port, but a prompt plus structured input schema, output schema, and policy constraints becomes much easier to run on either Claude or Codex with predictable behavior.

Example mapping
For a GTM-style “daily lead triage” routine, the shared routine would define: ingest new leads, enrich, score, summarize, and emit JSON plus markdown. In Claude Code, you would run it as a scheduled or API-triggered routine with the relevant connectors and environment configured in the cloud, while in Codex you would run the same routine from cron, GitHub Actions, or your own orchestrator using the CLI plus MCP/tools available on the host machine.

A clean architecture for you would be:

routine.yaml as the contract.

prompt.md as the reusable task instructions.

schema.json for output validation.

fixtures/ for deterministic tests.

adapters/claude.ts and adapters/codex.ts as thin execution wrappers.
That gives you a routine library that is model-agnostic in authoring, while still taking advantage of each runtime’s strengths at execution time.

Would you like a concrete starter repo structure for this, with one routine implemented for both Claude Code and Codex?