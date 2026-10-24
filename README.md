# ForgeFlow

**Factory order-to-delivery workflow and product traceability for small manufacturers**

ForgeFlow is a role-based web application that connects sales orders, manager review, factory fulfillment, production, quality checks, dispatch, and traceability in one persistent workflow. It is a hackathon prototype built with fictional demo data.

## Live demo

[Open the Replit-hosted ForgeFlow demo](https://efc961db-e94c-4415-a08b-a75381586db6-00-158x0gilza3ss.pike.replit.dev/forgeflow/). This link was verified during package preparation; confirm it remains available before submission.

## The problem

Small manufacturers often coordinate order approval, stock checks, production updates, inspections, and delivery through separate spreadsheets and messages. That makes handoffs harder to follow and product history harder to retrieve.

## What ForgeFlow does

- **Sales order intake:** submit multi-product orders with customer, quantity, price, requested delivery date, and notes.
- **Manager review:** review an advisory sample risk assessment, record notes, approve or reject the submission, and create an official factory order as a separate action.
- **Inventory and materials:** reserve available finished stock, identify material shortages, record material receipts, and recheck availability.
- **Production and quality:** record six production stages, operator, time, checks, measurements, and notes. Failed inspections remain in history and require a passing re-inspection before release.
- **Dispatch and traceability:** record carrier and tracking details; search order, customer, serial number, or batch history.
- **Role-based access and audit:** separate Sales, Manager, and Factory Operator permissions and preserve action history.

## Order workflow

`Sales submits order → Manager reviews → Approve or reject → Create official order → Check stock and materials → Produce and inspect → Dispatch → Search traceability`

A rejection is final. Approval does not reserve stock or schedule production until the Manager separately creates the official order.

## User roles

| Role | Main actions |
| --- | --- |
| Sales | Submit and track its own commercial orders |
| Manager | Review submissions, make final decisions, and create official orders |
| Factory Operator | Check inventory, record material receipts, production, quality, and dispatch |
| All signed-in roles | View the sanitized production and traceability history |

## Sustainable Development Goals

**Primary link: SDG 9 — Industry, Innovation and Infrastructure.** ForgeFlow is designed to help small manufacturers digitize order handoffs and keep structured production and traceability records. This is a product-design alignment, not a measured impact claim.

The workflow may also support the direction of SDG 8 (Decent Work and Economic Growth) and SDG 12 (Responsible Consumption and Production). No outcome or productivity improvement has yet been measured.

## Technology

- Frontend: React, TypeScript, Vite
- API: Node.js, Express 5, TypeScript
- Database: PostgreSQL with Drizzle ORM
- API validation and client: Zod schemas and generated React Query client
- Package management: pnpm

## AI and risk-assessment disclosure

The risk panel is **deterministic fictional sample data** selected for demonstration. It does not call a live AI model, perform credit research, verify a real company, or make an approval decision. All evidence is marked sample/unverified; a human Manager makes the final decision. No external AI or credit-data API key is required to run this demo.

## Run locally

See [START-HERE.md](START-HERE.md) for the full Windows and macOS setup guide. In brief, install Node.js 22.12+, PostgreSQL 16+, and pnpm 10.26.1, create a local database named `forgeflow`, configure `.env` from `.env.example`, then run:

```text
pnpm install --frozen-lockfile
pnpm setup:local
pnpm dev
```

Open `http://localhost:5173/`. Keep the terminal open while using the app. For later runs, use `pnpm dev`.

## Demo accounts

All accounts below use the public demo password `ForgeDemo!2026`. These are sample-only accounts; do not enter real customer, financial, or employee information.

| Email | Role |
| --- | --- |
| `sales@forgeflow.demo` | Sales |
| `sales2@forgeflow.demo` | Second Sales profile |
| `manager@forgeflow.demo` | Manager |
| `operator@forgeflow.demo` | Factory Operator |

See [docs/ForgeFlow-presenter-guide.md](docs/ForgeFlow-presenter-guide.md) for the seeded scenarios and presentation walkthrough.

## Prototype scope and limitations

This project demonstrates a small factory workflow. It does not include live credit research, real AI inference, ERP/accounting integration, purchasing or payment execution, carrier booking, automatic shipping labels, external notifications, or document/photo uploads. Company, order, material, inspection, and tracking data are fictional. It is not hardened for production deployment.

## Security and repository notes

- `.env` contains local secrets and must not be committed. Commit `.env.example` only.
- The demo credentials are intentionally public and must not be reused for real accounts.
- Before publishing, inspect the repository for passwords, API keys, local database data, and real customer information.

## License

This project is licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).

