import { db, factoryWorkspaces, factoryAuditEvents } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { DomainError, id, now, type State, type Actor, type Order } from "./domain";

export const WORKSPACE = "forgeflow-demo";
export async function readState(workspace = WORKSPACE): Promise<State> {
  const [row] = await db.select().from(factoryWorkspaces).where(eq(factoryWorkspaces.id, workspace));
  if (!row) throw new DomainError(503, "Factory demo data is not initialized. Run the documented factory seed command.");
  return row.state as State;
}
export async function mutate(
  actor: Actor, action: string, orderId: string | undefined,
  work: (state: State) => Order,
  details: Record<string, unknown> = {},
  workspace = WORKSPACE,
): Promise<Order> {
  return db.transaction(async tx => {
    const [row] = await tx.select().from(factoryWorkspaces).where(eq(factoryWorkspaces.id, workspace)).for("update");
    if (!row) throw new DomainError(503, "Factory demo data has not been initialized.");
    const state = structuredClone(row.state) as State;
    const beforeOrder = orderId ? structuredClone(state.orders.find(o => o.id === orderId)) : undefined;
    const beforeInventory = { stock: structuredClone(state.stock), materials: structuredClone(state.materials) };
    const order = work(state);
    await tx.update(factoryWorkspaces).set({ state, revision: row.revision + 1 }).where(eq(factoryWorkspaces.id, workspace));
    await tx.insert(factoryAuditEvents).values({
      id: id(), orderId: order.id, actorId: actor.id, actor: actor.name, action, at: new Date(now()),
      before: { order: beforeOrder ?? null, inventory: beforeInventory },
      after: { order: structuredClone(order), inventory: { stock: state.stock, materials: state.materials }, request: details },
    });
    return order;
  });
}
export async function auditFor(orderId: string) {
  const events = await db.select().from(factoryAuditEvents).where(eq(factoryAuditEvents.orderId, orderId)).orderBy(desc(factoryAuditEvents.at));
  return events.map(({ actorId, ...e }) => ({ ...e, at: e.at.toISOString() }));
}
