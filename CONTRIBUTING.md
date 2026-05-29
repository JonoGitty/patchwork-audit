# Contributing to Patchwork

Thanks for contributing.

## Prerequisites

- Node.js `>=20`
- `pnpm` `9.x`

## Setup

```bash
pnpm install
pnpm build
```

## Development Workflow

1. Create a feature branch from `main`.
2. Make focused changes.
3. Add or update tests with your change.
4. Run validation locally.
5. Open a pull request with a clear description.

## Validation Commands

```bash
pnpm lint
pnpm test
pnpm build
```

Optional:

```bash
pnpm test:log
pnpm hooks:install
```

`pnpm hooks:install` configures the local `pre-push` hook to run `pnpm test:log`.

## Project Structure

- `packages/core`: schema, policy engine, storage, hashing
- `packages/agents`: agent adapters and parsers
- `packages/cli`: `patchwork` command

## Commit Guidance

- Keep commits scoped and atomic.
- Use descriptive commit messages.
- Avoid mixing refactors with behavior changes unless tightly related.

## Pull Request Checklist

- Tests added/updated for behavior changes
- Docs updated for user-facing changes
- No secrets or credentials added
- CI is passing (or failures explained)

## Releasing (maintainers)

1. Update version in `packages/cli/package.json` (and `core`/`agents` if APIs changed).
2. Commit: `git commit -m "chore: bump version to X.Y.Z"`
3. Tag: `git tag vX.Y.Z`
4. Push: `git push origin main --tags`
5. The `publish.yml` workflow will build, test, and publish `patchwork-audit` to npm.

Requires `NPM_TOKEN` secret configured in the repository.

## Security-hardening contributions (Mythos-readiness)

Work toward hardening Patchwork against autonomous (Mythos-class) agents is tracked in [`DESIGN/v0.6.12-mythos-readiness-tracker.md`](DESIGN/v0.6.12-mythos-readiness-tracker.md). If you're picking up a hardening item:

1. Read the tracker's **"load-bearing property"** section first — every contribution must move toward the single reference-monitor invariant, not just patch one bypass.
2. Pick an item from the at-a-glance table. Each has acceptance criteria + a validation command. Update the **"Next action"** line when you change an item's state.
3. **Design items (D-series, M-series architecture)** get a cross-vendor review (e.g. via GPT-5.5) BEFORE implementation. **Code items** (F/T/U) follow the normal feature-branch + tests flow above.
4. Don't mix a whole-file reformat into a behaviour change (see the X2 note in the tracker) — keep security commits focused.
5. Verbatim cross-vendor reviews live in `REVIEWS/`. Add yours there for traceability.

## Reporting Issues

- Use GitHub Issues for bugs and feature requests.
- For security issues, do not open a public issue. See `SECURITY.md`.
