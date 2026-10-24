# Changes made only to this downloadable copy

- Added `tools/local.mjs` and root setup/dev/build/start/test commands that work
  without Unix-only environment assignment syntax.
- Added a local-only Vite configuration using `/`, loopback ports, and `/api`
  proxy routing. The original Replit `vite.config.ts` is preserved.
- Added `.env.example` and instructions for a local PostgreSQL database.
- Removed platform-disabling pnpm overrides so dependencies for Windows and Mac
  are not deliberately excluded. Security/version overrides are retained.
- Regenerated the export's lockfile for its actual included workspace packages.
- Removed the root Unix-only preinstall hook and unrelated connector dependency.
- Kept the application/backend workflow, authorization, schema, generated
  contracts, tests, demo fixtures, and documentation.

The server runs in development mode for a LOCAL HTTP demo (so session cookies
work over local HTTP). Do not publish this local launcher directly to the public
internet. Follow the presenter's documented limitations and use fictional data.

The original Replit database and secrets are not exported. To preserve current
order/production records rather than using fresh demo fixtures, a separate,
authorized database backup/export would be required.
