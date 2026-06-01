# _central — developer entrypoints.
# One-command bootstrap and a single quality gate that mirrors CI.
# Routine commands wrap `run.ts`; pass R=<routine> M=<mock|claude|codex>.

NODE_MIN := 20.12
R ?= example-echo
M ?= mock

.DEFAULT_GOAL := help

.PHONY: help setup check typecheck lint format test coverage audit run schedule apply promote clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

setup: ## Verify Node >= 20.12 and install locked deps
	@node -e 'const[a,b]=process.versions.node.split(".").map(Number);if(a<20||(a===20&&b<12)){console.error("Node >= $(NODE_MIN) required, found "+process.versions.node);process.exit(1)}'
	npm ci
	@echo "Ready. Try: make run R=daily-command-center M=mock"

check: typecheck lint format test audit ## Full local gate (mirrors CI)

typecheck: ## Type-check without emitting
	npm run typecheck

lint: ## Lint sources
	npm run lint

format: ## Verify formatting
	npm run format:check

test: ## Run the test suite
	npm test

coverage: ## Run tests with coverage thresholds
	npm run test:coverage

audit: ## Fail on high-severity advisories (as CI does)
	npm audit --audit-level=high

run: ## Run a routine: make run R=<routine> M=<model> [I=key=val]
	npx tsx run.ts run $(R) --model $(M) $(if $(I),--input $(I),)

schedule: ## Emit a host crontab line: make schedule R=<routine> M=<model>
	npx tsx run.ts schedule $(R) --model $(M)

apply: ## Apply a routine's last-run proposals (DRY=1 to preview)
	npx tsx run.ts apply $(R) $(if $(DRY),--dry-run,)

promote: ## Promote a memory hypothesis: make promote R=<routine> HYP=<n>
	npx tsx run.ts promote $(R) --hyp $(or $(HYP),0)

clean: ## Remove run artifacts and coverage output
	rm -rf coverage runs **/.last-run.json
