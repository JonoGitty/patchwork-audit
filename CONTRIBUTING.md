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

## Reporting Issues

- Use GitHub Issues for bugs and feature requests.
- For security issues, do not open a public issue. See `SECURITY.md`.
