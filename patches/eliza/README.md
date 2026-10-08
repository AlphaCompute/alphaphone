# patches/eliza

Explicit, tested upstream patches for `vendor/eliza` (elizaOS/eliza), per `AGENTS.md`.

## Convention

- `NNNN-<topic>.patch`: a `git diff --full-index` taken from one recorded upstream commit.
- `<topic>-source-base.json`: the base commit (full SHA), the patch sha256, files changed,
  the contract, and the exact verification commands with their results.
- Each patch must pass `git apply --check` against a clean checkout of its recorded base.
- Patches are applied and tested only in isolated upstream worktrees. They are never applied to
  the `vendor/eliza` checkout. The submodule moves only when a reviewed upstream commit lands.
- The historical series 0001-0036 was retired on 2026-10-03/04 when Alpha moved to merged
  upstream (`db6888a4`, `55c2944f`; see git history and `docs/app-upstream-ownership.md`).
  Numbering continues from 0037.

## Current

`0037-gmail-inbox-read-state.patch` (base `3cca1ee4f1f1e4cd417de7272ba5195263dcb63b`) adds the
reviewed managed Gmail inbox-v1 kinds `mark-read` and `mark-unread`, `capabilities.readState`,
and additive migration `0535_managed_gmail_read_state_operations` (widens
`managed_gmail_operation_receipts_kind_check`). It has not been upstreamed or deployed to
Eliza Cloud. Until it is, servers omit `readState`, and the client treats that as false.

## Apply and test

```sh
BASE=3cca1ee4f1f1e4cd417de7272ba5195263dcb63b
git -C vendor/eliza worktree add --detach /tmp/eliza-0037 "$BASE"
cd /tmp/eliza-0037
git apply --check /path/to/patches/eliza/0037-gmail-inbox-read-state.patch
git apply /path/to/patches/eliza/0037-gmail-inbox-read-state.patch
bun install --frozen-lockfile   # or provide lockfile-pinned pglite/drizzle-orm/hono
cd packages/cloud/shared
bun test src/lib/services/agent-google-connector/inbox-provider.http.integration.test.ts
node ../scripts/shared/check-migration-prefix-order.ts
cd - && git -C /path/to/vendor/eliza worktree remove --force /tmp/eliza-0037
```

The tests use synthetic tokens, a closed in-process fetch transport and PGlite. They make no
Google network calls.
