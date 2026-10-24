# Factory Order Traceability Demo

## What & Why
Build the functional, English-language factory management application specified in the attached brief. Cover Sales Order → Manager Review → Official Order → Inventory or Production → Quality Checks → Dispatch, with reliable permissions, persistent history, and searchable product/batch traceability.

This is a new product, not an extension of Northstar. Create a separate web artifact with distinct factory-oriented branding and its own preview path, preserving Northstar and the existing Canvas. Reuse the existing Express API under an isolated factory namespace and PostgreSQL/Drizzle foundation; database configuration is present, but connectivity and schema availability still need verification. Use clearly labeled deterministic demo customer-risk assessments rather than implying a live AI or credit-data connection. The complete uploaded brief is the source specification.

## Done looks like
- A separate responsive factory application is available in Replit, with English navigation, labels, validation, and sample data; Northstar still works unchanged.
- Seeded Sales, Manager, and Factory Operator users can sign in and sign out. Server-side authorization restricts Sales order lists/details to their own submissions, decisions and official-order creation to Managers, and factory updates to Factory Operators. All authenticated users can view production progress and traceability as requested without gaining access to restricted commercial/order-management fields.
- Sales can submit multi-product orders with customer company/contact, quantities, unit prices, calculated totals, requested delivery date, delivery address, and notes. Required-field and numeric validation is clear, and successful submissions become Pending Manager Review.
- Managers see pending submissions, amounts, dates, advisory risk levels, confidence, explanations, evidence, and review notes. Every demo assessment and source is visibly marked sample/unverified; it never makes the decision automatically.
- Approval/rejection captures actor, time, and decision notes. Rejected orders cannot become approved after refresh, repeated requests, or stale updates; approved orders enter the factory only after a distinct official-order creation action.
- Factory Operators check inventory, reserve available finished goods without over-allocation, produce shortages when raw materials permit, or create procurement tasks and mark Waiting for Materials. Recording material receipt allows the order to be checked again and scheduled.
- Production uses the preset stages Material Preparation, Processing, Assembly, Quality Inspection, Packaging, and Ready for Dispatch. Stage records capture Not Started/In Progress/Passed/Failed, operator or inspector, times, processed quantity, measurements/checklists, and notes/issues. Failed inspections remain visible, block affected goods from dispatch, and require recorded resolution plus a passing re-inspection.
- Finished-stock fulfillment and production fulfillment both enforce applicable quality/readiness checks. Dispatch requires reserved/released goods and no unresolved blocking issues, records carrier/tracking/time, and updates Sales tracking and traceability.
- Each produced item has a unique serial ID, or an explicit batch ID and quantity for larger runs. Finished-stock goods also retain traceable identities; all allocated quantities connect to official order, customer, stage/inspection history, staff, timestamps, and shipment. Search supports order number, serial number, batch ID, and customer name.
- Role dashboards provide search/filtering, status badges, progress timelines, pending/completed inspections, material status, decision notes, and shipment information. Expected dispatch dates are clearly estimates; committed changes appear on refresh and on subsequent dashboard fetches without losing state.
- Audit events preserve actors, actions, timestamps, and before/after state for submissions, decisions, official orders, inventory, procurement/material receipts, stages, inspections, issue resolution, and dispatch. Refreshing or signing in as another seeded user does not erase data.
- Idempotent demo seeding supplies users, customers, products, bill-of-materials requirements, finished stock, raw materials, and all six requested scenarios: awaiting review, rejected, approved stock fulfillment, waiting for materials, in production with inspections, and dispatched with complete traceability.
- Automated checks and a browser walkthrough verify the entire workflow, unauthorized requests, immutable rejection, duplicate/concurrent reservations, official-order gating, failed-inspection blocking, and dispatch prerequisites. Presenter documentation explains demo accounts, scenario walkthroughs, sample-risk limitations, and safe demo-data restoration.

## Out of scope
- Changes to Northstar's screens, employee/holiday functionality, branding, or storage.
- Live credit research, external AI services, automatic approval, real creditworthiness claims, or live customer-data integrations.
- ERP/accounting integrations, real purchasing/payments, carrier APIs, automated shipping labels, external notifications, and production deployment.
- Enterprise identity/SSO, password recovery, user-administration screens, multi-tenant organizations, configurable production-stage editors, and complex split shipments.
- Binary document/photo storage. Support the required notes fields; do not expose misleading upload controls or imply documents are stored when they are not.

## Steps
1. **Standalone application foundation** — Create and register a new factory web artifact using the workspace artifact lifecycle and managed routing, with its own branding and preview path. Reuse the API through a factory-specific namespace, maintain existing health behavior, and follow pnpm dependency, TypeScript, and contract-first API/code-generation conventions without cross-importing artifacts.
2. **Persistent domain and workflow rules** — Define the API contract and persistent models for users/sessions, customers, products/material requirements, sales submissions and line items, separate official orders, inventory/reservations, procurement, production, traceable units/batches, quality issues/inspection attempts, shipments, and append-only audit events. Separate decision state from fulfillment state, enforce legal transitions on the server, and use atomic transactions and concurrency guards for critical state changes, stock allocation, and duplicate official-order/dispatch requests.
3. **Authentication and authorization** — Add actual server sessions and securely hashed credentials for seeded demo accounts, with appropriate cookie, request-validation, and cross-origin/CSRF protections. Enforce role and ownership rules for every read/write endpoint, including safe shared production/traceability views; never trust a client role selector or actor name supplied by the browser.
4. **Sales intake and manager review** — Build validated multi-line order entry, ownership-scoped tracking, Manager review queues/details, and clearly labeled sample advisory risk assessments with evidence, confidence, review notes, and decision history. Implement explicit approve/reject and subsequent official-order creation commands with durable rejection and no pre-approval factory access.
5. **Inventory and material fulfillment** — Implement the factory queue, finished-stock checks and reservations, material requirements/availability, procurement tasks, receipt recording, and production scheduling for shortages. Handle multi-line orders consistently, prevent double reservation and negative stock, and define one coherent no-split-shipment policy while retaining reservations and traceable quantity accounting across rechecks.
6. **Production and quality controls** — Build the preset sequential production timeline and operator/inspection entry screens, capturing quantities, identities, measurements/checklists, timestamps, and notes. Preserve failed inspection attempts and issue history; implement explicit resolution and re-inspection, and block stage completion or dispatch where prerequisites or quality release are missing.
7. **Dispatch, traceability, and tracking** — Allocate unique serials or explicit quantity-bearing batch IDs to inventory/production fulfillment, connect their complete histories to orders and customers, and provide searchable traceability detail. Add guarded dispatch with carrier and tracking, role-specific status dashboards and filters, estimated-versus-confirmed dates, and refreshed progress after committed changes.
8. **Demo scenarios and presentation** — Create repeatable realistic seed scenarios for all requested branches and a controlled, demo-only restoration mechanism that cannot silently delete unrelated records or run in normal production operation. Finish responsive desktop/mobile behavior, loading/error/empty states, and concise setup/presenter documentation explaining credentials, sample data, risk limitations, and workflow demonstrations.
9. **Integrity and regression verification** — Add backend/domain and UI coverage for happy paths and invalid/unauthorized transitions, including stale decisions, duplicate official orders, inventory concurrency, failed inspections, re-inspection history, and premature dispatch. Run workspace typechecks and appropriate tests, verify persistence across reload and sign-in changes, demonstrate the six scenarios through the managed preview, and confirm Northstar and API health remain unaffected.

## Relevant files
- `attached_assets/Pasted-Build-a-functional-demo-ready-web-application-for-a-fac_1792764477056.txt`
- `pnpm-workspace.yaml`
- `package.json`
- `tsconfig.base.json`
- `tsconfig.json`
- `replit.md`
- `artifacts/api-server/package.json`
- `artifacts/api-server/src/app.ts`
- `artifacts/api-server/src/routes/index.ts`
- `artifacts/api-server/src/routes/health.ts`
- `artifacts/api-server/.replit-artifact/artifact.toml`
- `lib/db/src/index.ts`
- `lib/db/src/schema/index.ts`
- `lib/db/drizzle.config.ts`
- `lib/api-spec/openapi.yaml`
- `lib/api-spec/orval.config.ts`
- `artifacts/html-css-js-starter/vite.config.ts`
- `artifacts/html-css-js-starter/.replit-artifact/artifact.toml`
- `scripts/post-merge.sh`
