# ForgeFlow — complete project for your computer

This is the COMPLETE ForgeFlow application source, not just documentation.
This updated package includes the Dashboard's static order-to-delivery workflow
diagram, its approved/rejected branch, and the shared-status visibility note.
It is a web app with a server and a PostgreSQL database. Double-clicking an HTML
file will NOT start it. You do not need a Replit account, AI key, or other paid API.

## 1. Install these programs once

- **Node.js 22.12 or newer**: https://nodejs.org/
- **PostgreSQL 16 or newer**, including pgAdmin: https://www.postgresql.org/download/
  Remember the database username and password YOU choose during installation.
- Open PowerShell (Windows) or Terminal (Mac) and install pnpm:

```text
npm install -g pnpm@10.26.1
```

If Mac reports a permissions error, use a user-owned Node installation rather
than changing permissions on system directories. Restart your terminal after
installing Node.

## 2. Extract the ZIP and open a terminal in the extracted folder

Windows: right-click the ZIP → Extract All. Open the extracted
`ForgeFlow-Complete-Project` folder. Right-click empty space → Open in Terminal.

Mac: double-click the ZIP. Open Terminal, type `cd ` (including the space),
drag the extracted `ForgeFlow-Complete-Project` folder into Terminal, and press Return.

The correct folder contains `package.json`, `pnpm-workspace.yaml`, and this guide.
You may open this folder in Visual Studio Code to view/edit all source files.

## 3. Create a dedicated local database

Open pgAdmin and connect to your LOCAL PostgreSQL installation. Right-click
**Databases → Create → Database** and name it `forgeflow`.

Use a NEW, empty database for this project. The setup command creates its schema
and demo records. Do not point this demo at a company or production database.

## 4. Create your local settings

Windows PowerShell:

```powershell
Copy-Item .env.example .env
notepad .env
```

Mac Terminal:

```sh
cp .env.example .env
open -e .env
```

In `.env`, replace `YOUR_PASSWORD` with the password for YOUR local PostgreSQL
user. If your username/host/port differ, update those parts too. Save the file.
Do not send your password to anyone or commit `.env` to Git.

Connection format:

```text
postgresql://USERNAME:PASSWORD@localhost:5432/forgeflow
```

Special password characters must be URL-encoded, e.g. `@` becomes `%40`,
`#` becomes `%23`, and `%` becomes `%25`.

## 5. Install, initialize, and run

Run these commands in the extracted project folder. They work in both PowerShell
and Mac Terminal. Installation needs internet access.

```text
pnpm install --frozen-lockfile
pnpm setup:local
pnpm dev
```

If schema setup asks for confirmation, check that you selected your new local
`forgeflow` database before accepting.

When Vite reports ready, open:

**http://localhost:5173/**

The local launcher starts the API on port 3001 and the website on port 5173.
The local web configuration forwards `/api` requests to that API, preserving
same-origin sessions. Keep the terminal open while using the app. Ctrl+C stops it.

For later use, open the folder in a terminal and run only `pnpm dev`.
Do not initialize/reset the database each time.

## 6. Demo sign-in

These are intentionally public, sample-only accounts. All use the demo password
`ForgeDemo!2026`.

| Account | Role |
| --- | --- |
| sales@forgeflow.demo | Sales |
| sales2@forgeflow.demo | Second Sales profile |
| manager@forgeflow.demo | Manager |
| operator@forgeflow.demo | Factory Operator |

See `docs/ForgeFlow-presenter-guide.md` for the six scenarios and the full
Sales → Review → Official Order → Inventory/Production → Quality → Dispatch
walkthrough. Do not use real customer or financial information.

## Included files

- `artifacts/forgeflow/`: complete React/TypeScript frontend, styles, public
  assets, and original Replit configuration.
- `artifacts/api-server/`: server, sessions/permissions, workflow logic,
  demo seed fixtures, backend tests, and build configuration.
- `lib/db/`: PostgreSQL schema, Drizzle configuration, and DB library.
- `lib/api-client-react/`, `lib/api-zod/`, `lib/api-spec/`: API client,
  validation schemas, generated types, and complete OpenAPI specification.
- `scripts/`: original workspace utility scripts.
- `docs/`: presenter guide, project scope, and export notes.
- `attached_assets/`: original factory project requirements.
- Root workspace configuration, lockfile, TypeScript settings, local launcher,
  and `.env.example`.

Not included: installed dependencies (`node_modules`), transient build/cache
files, secret settings, or a copy of the current Replit database's live records.
Sample/demo records are INCLUDED as seed code. The unrelated Northstar and Canvas
apps are not part of this ForgeFlow export.

## Optional checks and compiled local run

```text
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

`pnpm test` requires the initialized local database. `pnpm start` serves the
compiled local demo after `pnpm build`; it is NOT a hardened internet deployment.
Use only one of `pnpm dev` and `pnpm start` at a time.

## Troubleshooting

- **`pnpm` / `node` not recognized**: install Node/pnpm, then reopen the terminal.
- **`package.json` missing**: you are in the wrong folder. `cd` into the extracted
  folder containing this guide.
- **Connection refused / password authentication failed**: make sure PostgreSQL
  is running and `.env` uses your local username, password, port, and database.
- **Missing database table**: run `pnpm setup:local` against the new local DB.
- **Port already in use**: stop any older ForgeFlow terminal with Ctrl+C. Or
  change `FORGEFLOW_WEB_PORT` / `FORGEFLOW_API_PORT` in `.env` to different unused
  ports, restart, and visit the new WEB port.
- **Cannot reach API / sign-in disabled**: look at the API error in the terminal.
  Both services must be running. Always use `http://localhost:5173/`, not a
  double-clicked file or the Replit `/forgeflow/` URL.
- **Wrong browser location**: the downloaded app uses `/` locally. The original
  Replit app still uses `/forgeflow/`.
