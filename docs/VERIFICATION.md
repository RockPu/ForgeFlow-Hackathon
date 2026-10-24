# Export verification

## Latest dashboard update

The export includes the latest Dashboard source and its static workflow diagram.
The updated portable copy passed type checking and the local production build.
The runtime/proxy checks listed below were performed for the previous export;
the local launcher, server, routing, and database code have not changed since.

Checked in a separate copy of the ForgeFlow workspace:

- Fresh pnpm dependency installation succeeded.
- Type checking succeeded for the shared libraries, frontend, server, and scripts.
- Frontend and API builds succeeded.
- All nine factory workflow/domain unit tests passed.
- Both `pnpm dev` and compiled `pnpm start` served the website and forwarded
  `/api/healthz` to the API successfully.
- Unauthenticated `/api/factory/orders` requests returned 401 through the local
  web proxy, as expected.
- Stopping either local launcher closed both web and API service ports.
- The lockfile includes native Windows x64 and Mac ARM64 dependency entries.

These commands were run on Linux with Node.js 24 and pnpm 10.26.1. Windows and
macOS were not directly available for testing. Setup instructions and the launcher
avoid Unix-only command syntax. Your local PostgreSQL connection/schema setup
still needs to be completed on your own computer.

The original application's business logic and permission rules were not changed
for this export. No current database records or private environment settings
were copied into the archive.
