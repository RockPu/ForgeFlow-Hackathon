import { db, pool, factoryUsers, factoryWorkspaces, factoryAuditEvents } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";
import { createFixtures, restoredFixtures, DEMO_USERS, DEMO_PASSWORD } from "./fixtures";
import { WORKSPACE } from "./store";
import { id, serialsFor, type State } from "./domain";
import { logger } from "../lib/logger";

// Explicit developer command, never invoked by an HTTP route or server startup.
async function seed() {
  if (process.env.NODE_ENV === "production") throw new Error("Demo seeding/restoration is disabled in production.");
  const restore = process.argv.includes("--restore-demo");
  if (restore && (!process.argv.includes("--confirm=RESTORE-FORGEFLOW-FIXTURES") || process.env.FACTORY_ALLOW_DEMO_RESTORE !== "1"))
    throw new Error("Restoration requires FACTORY_ALLOW_DEMO_RESTORE=1 and --confirm=RESTORE-FORGEFLOW-FIXTURES. Read the presenter guide first.");
  const hashes = await Promise.all(DEMO_USERS.map(() => hashPassword(DEMO_PASSWORD)));
  await db.transaction(async tx => {
    // Seed and restore share the same lock as workflow commands, even before the
    // singleton aggregate exists. No other product's data is ever modified.
    await tx.execute("SELECT pg_advisory_xact_lock(735923)");
    for (const [i, user] of DEMO_USERS.entries()) await tx.insert(factoryUsers).values({ ...user, passwordHash: hashes[i] }).onConflictDoNothing();
    const [existing] = await tx.select().from(factoryWorkspaces).where(eq(factoryWorkspaces.id, WORKSPACE)).for("update");
    if (existing && !restore) {
      // Additive, idempotent data-shape upgrade; never reset workflow decisions,
      // allocation quantities, inventory, or any existing identity.
      const state = existing.state as State;
      let changed = false;
      state.officialOrders ??= [];
      for (const o of state.orders.filter(o => o.officialNumber)) {
        let official = state.officialOrders.find(record => record.submissionId === o.id);
        if (!official) {
          official = { id: id(), number: o.officialNumber!, submissionId: o.id, customerId: o.customerId, createdBy: o.officialCreatedBy!, createdAt: o.officialCreatedAt! };
          state.officialOrders.push(official);
          changed = true;
        }
        if (o.officialOrderId !== official.id) { o.officialOrderId = official.id; changed = true; }
      }
      for (const o of state.orders) for (const a of o.allocations) if (a.source === "Production" && !a.serialNumbers) {
        a.serialNumbers = serialsFor(a.id, a.quantity); changed = true;
      }
      for (const o of state.orders) if (o.status === "Ready for Dispatch" && o.progress !== 100) { o.progress = 100; changed = true; }
      if (changed) {
        await tx.update(factoryWorkspaces).set({ state, revision: existing.revision + 1 }).where(eq(factoryWorkspaces.id, WORKSPACE));
        await tx.insert(factoryAuditEvents).values({ id: id(), orderId: WORKSPACE, actorId: "demo-maintenance", actor: "Idempotent demo setup", action: "Added explicit official identities and small-run serials", at: new Date(), before: { revision: existing.revision }, after: { revision: existing.revision + 1 } });
      }
      return;
    }
    if (restore && existing) {
      const old = existing.state as State;
      restoredFixtures(old); // Validate scope before archiving or replacing anything.
      await tx.insert(factoryAuditEvents).values({ id: id(), orderId: WORKSPACE, actorId: "demo-maintenance", actor: "Explicit local demo restoration", action: "Archived complete pre-restoration demo snapshot", at: new Date(), before: old, after: { confirmation: "RESTORE-FORGEFLOW-FIXTURES" } });
    }
    const { state, events } = existing ? restoredFixtures(existing.state as State) : createFixtures();
    if (existing) {
      // Increase versions above the previous values so stale browser forms cannot
      // act on freshly restored records, even when fixture ids are reused.
      await tx.update(factoryWorkspaces).set({ state, revision: existing.revision + 1 }).where(eq(factoryWorkspaces.id, WORKSPACE));
    } else await tx.insert(factoryWorkspaces).values({ id: WORKSPACE, state });
    await tx.insert(factoryAuditEvents).values(events);
  });
  logger.info("ForgeFlow demo seed complete; existing data preserved unless explicitly restored.");
}
seed().catch(error => { logger.error({ err: error }, "Factory seed failed"); process.exitCode = 1; }).finally(() => pool.end());
