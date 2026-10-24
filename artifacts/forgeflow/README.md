# ForgeFlow — factory order and traceability demo

Separate application: **`/forgeflow/`**. Northstar remains at `/`, and Canvas at `/__mockup`. ForgeFlow does not read or change Northstar's browser storage, screens, employees or holidays.

## Sign in

These are intentionally public **demo-only credentials**. All accounts use **`ForgeDemo!2026`**:

| Email | Role | Purpose |
| --- | --- | --- |
| `sales@forgeflow.demo` | Sales — Alex Morgan | Submit and track own commercial orders |
| `sales2@forgeflow.demo` | Sales — Jordan Lee | Demonstrate ownership isolation |
| `manager@forgeflow.demo` | Manager — Morgan Chen | Manual decisions and separate official-order creation |
| `operator@forgeflow.demo` | Factory Operator — Sam Rivera | Inventory, material receipt, production, quality and dispatch |

Clicking an account on the login page only fills the credentials. It does not select a role. The server verifies a scrypt password hash and issues an opaque, HttpOnly session cookie. Signing out revokes that session. Session lifetime is eight hours.

**This is not a production identity system.** Do not enter real customer, financial or employee information. There is no password recovery, account administration or enterprise SSO.

## Presenter walkthrough

### Six starting scenarios

| Submission / official order | Customer | Starting state | What to demonstrate |
| --- | --- | --- | --- |
| SO-01001 | Atlas Motion Systems | Pending Manager Review | Sales submission and Manager advisory review |
| SO-01002 | Cobalt Industrial Supply | Rejected | Final decision, note, actor and timestamp; cannot be changed to approval |
| SO-01003 / FO-01003 | Meridian Automation | Ready for Dispatch | Approved finished-stock fulfillment, batch reservation and explicit readiness release |
| SO-01004 / FO-01004 | Summit Robotics | Waiting for Materials | Motor shortage, procurement task, receipt and inventory recheck |
| SO-01005 / FO-01005 | Vector Engineering | Quality Hold | In-production order with passed stages, a failed inspection and retained issue history |
| SO-01006 / FO-01006 | Harbor Controls | Dispatched | Complete production/inspection history, batch identity and demo shipment |

Summit Robotics belongs to the **second Sales account**. The first Sales account cannot view its commercial details. Manager and Operator can find it in their respective queues. Every signed-in role can see its sanitized production and traceability view.

### Full journey

1. **Sales** → Orders → New order. Enter a fictional customer, contact, requested delivery date and address. Add one or more different products, whole quantities and positive unit prices. Check the total and submit. The result is **Pending Manager Review**, not a factory order.
2. Sign out, then sign in as **Manager**. Open the submission. Read the explicitly sample/unverified advisory assessment and its evidence. Add decision and optional review notes. Approve or reject manually.
3. After approval, use the **separate Create official order action**. Approval alone cannot reserve stock, schedule production or dispatch goods.
4. Sign in as **Factory Operator**. Open the official order and **Check inventory**. Finished goods are reserved first. If materials for remaining quantities are missing, procurement tasks appear and the order waits.
5. For the seeded Summit Robotics order, receive its ten drive motors with a receipt reference, then **Check inventory again**. Receipt does not silently schedule production.
6. Production is sequential: **Material Preparation → Processing → Assembly → Quality Inspection → Packaging → Ready for Dispatch**. Record the full production allocation quantity across the order's lines, results/checklists and notes. Operator/inspector identity and times come from the signed-in session and server clock.
7. For Vector Engineering, inspect the failed Quality Inspection. Record a resolution. Notice that the stage remains **Failed**: resolution alone does not release it. Record a **passing re-inspection**, then pass Packaging and Ready for Dispatch.
8. Where finished stock is allocated, record the **stock readiness checklist and release notes** as well. Mixed stock/production orders need both release paths.
9. Dispatch only after all quantities are allocated and released, all production stages pass and no issue remains unresolved. Enter a fictional carrier and tracking number. This records one complete shipment, not a carrier booking.
10. Sign in again as Sales and refresh the order. Review the shipment and search Traceability by official/submission number, customer, serial number or batch identity. Expand inspection attempts to see failures and later passes together.

New multi-product demonstration: choose two Precision Servo Housings and one Linear Actuator Assembly. At untouched seed quantities, the housings reserve from stock while the actuator waits for a motor; receive one motor and recheck to demonstrate both fulfillment paths in one order.

## Important limitations

- **Risk is deterministic sample data, not live AI, credit research or verified information.** A hash of the company name selects a fictional Low/Medium/High scenario. The confidence number describes that sample scenario only, not statistical confidence about a real company. Every evidence item is marked sample/unverified. No external services are contacted, and the result never decides an order.
- All companies, contact details, material receipts, checks and tracking data are fictional.
- Prices are displayed in **USD** for this independent factory demo. There are no taxes, payments or accounting integrations.
- Requested delivery dates are requests, not guarantees. Expected dispatch dates are explicitly **estimates**. Only a recorded shipment has a confirmed dispatch timestamp.
- **No split shipments:** retained stock reservations are combined with production for one complete dispatch. There is no cancellation or reservation-release workflow in this scope.
- Small production allocations of up to ten units receive individual unique serial numbers. Larger runs use an explicit batch ID and quantity. Finished stock retains its original opening-stock batch identity and allocated quantity. Production inspection records apply to every production allocation in that order; the processed quantity must equal their combined quantity. Complex independent per-line production scheduling is not implemented.
- Stock comes from quality-passed opening batches, but still requires explicit order-specific readiness release. Production requires all six passed stages.
- Notes are persistent text. There are **no uploads**, stored photos, external document storage, live procurement, carrier APIs, notifications or ERP integrations.
- Shared production/traceability deliberately omits contact details, address, prices, order value, risk assessment, Sales ownership and Manager decision/review notes. Company, product, batch, inspection and shipment history remain visible as required.
- Dashboards, order details, inventory, production and traceability refresh periodically; successful writes also invalidate affected caches. Refreshing or switching accounts does not erase committed data.

## Setup and checks

Use the managed ForgeFlow and API workflows; they supply `PORT`, `BASE_PATH` and proxy routing. Do not start a duplicate server.

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run factory:seed
pnpm run typecheck
pnpm --filter @workspace/api-server run test:factory
pnpm --filter @workspace/html-css-js-starter run test
```

Database configuration is the existing PostgreSQL/Drizzle foundation. The schema command adds factory-prefixed tables. There is no schema creation at API startup and no production migration script. The development post-merge script installs, applies the development schema and seeds idempotently.

`factory:seed` preserves an existing demo's workflow state and only applies additive identity-format upgrades if needed. It does not reset passwords on existing users or erase changed orders. The HTTP tests use a uniquely named isolated database aggregate, remove that aggregate and their sessions afterward, and retain append-only test audit evidence. They do **not** reserve from the presenter's live demo inventory.

## Safe demo restoration — local development only

There is intentionally no reset button or destructive HTTP endpoint. **Restoration replaces the six seeded fixture orders and their factory inventory/materials with their original scenario state. Any edits to those fixture orders are removed from the active presentation, but a full before-state archive and all previous audit events are retained.** Northstar, Canvas, user credentials and sessions are not modified.

First stop any presentation and read this section. Restoration is refused if the factory workspace contains **any user-created orders**, because resetting global stock could invalidate their reservations. Preserve those records; use a separate development database/project for a completely fresh presentation instead of deleting them.

Only when the workspace still contains just the six seeded fixture orders:

```sh
NODE_ENV=development FACTORY_ALLOW_DEMO_RESTORE=1 \
  pnpm --filter @workspace/api-server run factory:seed -- \
  --restore-demo --confirm=RESTORE-FORGEFLOW-FIXTURES
```

Both the explicit environment opt-in and exact confirmation are required. The command refuses `NODE_ENV=production`. A transaction and row lock prevent interference with workflow writes; restored versions increase to invalidate stale browser commands. Reload browser views after restoration. Archived snapshots are in the factory audit table under the workspace's maintenance event, not exposed through a public administrative screen.

## Implementation and integrity

- API namespace: `/api/factory/*`; health remains `/api/healthz`.
- Contract: `lib/api-spec/openapi.yaml`; generated React Query hooks and server Zod schemas are regenerated with `pnpm --filter @workspace/api-spec run codegen`.
- Backend domain: `artifacts/api-server/src/factory/`; handlers: `artifacts/api-server/src/routes/factory.ts`.
- Schema: `lib/db/src/schema/factory.ts`. Credentials, sessions and audit events have their own tables. The demo's customers, catalog/BOM, submissions, official-order references, fulfillment allocations, procurement, stages, inspections, issues and shipments live in one typed JSONB aggregate. This is an intentional small-demo consistency boundary, **not** a design for high-volume manufacturing.
- Each mutation locks that aggregate with PostgreSQL `FOR UPDATE`, validates authorization and expected order version, and commits state plus the append-only audit event together. This prevents negative inventory, duplicate reservations, stale decisions, duplicate official orders and repeat dispatches across concurrent requests/processes.
- Actor, ownership, identity, timestamps, totals and transition outcomes are server-owned. A role or actor sent by a browser cannot override them.
- Sessions use cryptographically random tokens stored only as hashes, rotated at login; SameSite strict, HttpOnly cookies, secure cookies over HTTPS, CSRF tokens for all writes (including login/logout), cross-site request rejection, bounded sign-in throttling and no-store responses.
- Audit is append-only through application commands and has no update/delete endpoint. Events retain before/after order and inventory snapshots and input details, including material receipt references. Commercial audit reads are restricted to Manager and submitting Sales.

The automated suite covers role/ownership restrictions, malformed submissions, final rejection, explicit official-order gating, concurrent and duplicate stock allocation, material rechecks, sequential stages, issue resolution with mandatory re-inspection, finished-stock release, dispatch prerequisites, duplicate dispatch, safe shared data projections, audit attribution and persistence after sign-out/sign-in.
