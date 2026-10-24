import { submit, command, id, now, productionQuantity, requireRule, type State, type Actor, type Order } from "./domain";
import type { FactoryCommandInput } from "@workspace/api-zod";

export const DEMO_PASSWORD = "ForgeDemo!2026"; // Public demo credentials, never a real-user secret.
export const DEMO_USERS: Actor[] = [
  { id: "ff-sales", name: "Alex Morgan", email: "sales@forgeflow.demo", role: "Sales" },
  { id: "ff-sales2", name: "Jordan Lee", email: "sales2@forgeflow.demo", role: "Sales" },
  { id: "ff-manager", name: "Morgan Chen", email: "manager@forgeflow.demo", role: "Manager" },
  { id: "ff-operator", name: "Sam Rivera", email: "operator@forgeflow.demo", role: "Factory Operator" },
];
export const FIXTURE_IDS = ["demo-awaiting", "demo-rejected", "demo-stock", "demo-materials", "demo-production", "demo-dispatched"];
export type SeedEvent = { id: string; orderId: string; actorId: string; actor: string; action: string; at: Date; before: unknown; after: unknown };
export function createFixtures() {
  const state: State = {
    nextOrder: 1001, customers: [], orders: [], officialOrders: [],
    products: [
      { id: "housing", name: "Precision Servo Housing", sku: "PSH-240", unitPrice: 85, requirements: [{ materialId: "aluminum", quantity: 2 }, { materialId: "fastener", quantity: 4 }] },
      { id: "enclosure", name: "Industrial Control Enclosure", sku: "ICE-110", unitPrice: 145, requirements: [{ materialId: "sheet", quantity: 2 }, { materialId: "fastener", quantity: 6 }] },
      { id: "actuator", name: "Linear Actuator Assembly", sku: "LAA-500", unitPrice: 320, requirements: [{ materialId: "motor", quantity: 1 }, { materialId: "aluminum", quantity: 3 }] },
    ],
    materials: [
      { id: "aluminum", name: "Aluminum billet", unit: "pieces", available: 250 },
      { id: "fastener", name: "M6 fastener set", unit: "sets", available: 1000 },
      { id: "sheet", name: "Powder-coated steel sheet", unit: "sheets", available: 140 },
      { id: "motor", name: "24V drive motor", unit: "units", available: 0 },
    ],
    stock: [],
  };
  for (const [productId, quantity, batchId] of [["housing", 60, "FG-PSH-2026-101"], ["enclosure", 4, "FG-ICE-2026-102"]] as const) {
    state.stock.push({
      batchId, productId, productName: state.products.find(p => p.id === productId)!.name, available: quantity, quality: "Passed",
      history: [{ id: id(), status: "Passed", actor: "Sam Rivera", startedAt: now(), completedAt: now(), quantity, measurements: "Incoming stock inspection: dimensions within ±0.2 mm; appearance and packaging passed.", notes: "Sample opening-stock batch accepted by quality control." }],
    });
  }
  const [sales, sales2, manager, operator] = DEMO_USERS;
  const events: SeedEvent[] = [];
  function event(order: Order, action: string, actor: Actor, before: unknown, input?: unknown) {
    events.push({ id: id(), orderId: order.id, actorId: actor.id, actor: actor.name, action, at: new Date(), before, after: { order: structuredClone(order), inventory: { stock: structuredClone(state.stock), materials: structuredClone(state.materials) }, request: input } });
  }
  function order(index: number, company: string, productId: string, quantity: number, owner = sales) {
    const o = submit(state, {
      company, contact: `Sample Purchasing Team · purchasing@${company.toLowerCase().replace(/[^a-z]/g, "")}.example`,
      address: "Sample Industrial Park, Building 12, Receiving Bay A",
      deliveryDate: new Date(Date.now() + (10 + index) * 86400000).toISOString().slice(0, 10),
      notes: "Fictional demo customer and delivery details. No real order will be sent.",
      lines: [{ productId, quantity, unitPrice: state.products.find(p => p.id === productId)!.unitPrice }],
    }, owner);
    o.id = FIXTURE_IDS[index];
    event(o, "Order submitted", owner, { order: null });
    return o;
  }
  function act(o: Order, action: FactoryCommandInput["action"], extras: Partial<FactoryCommandInput> = {}) {
    const actor = ["approve", "reject", "official"].includes(action) ? manager : operator;
    const before = { order: structuredClone(o), inventory: { stock: structuredClone(state.stock), materials: structuredClone(state.materials) } };
    const input = { action, version: o.version, ...extras };
    command(state, o, input, actor);
    event(o, action, actor, before, input);
  }
  function official(o: Order) {
    act(o, "approve", { notes: "Approved after manual review of the fictional demonstration scenario.", reviewNotes: "Sample / unverified advisory assessment reviewed; no external credit research used." });
    act(o, "official");
    act(o, "check-inventory");
  }
  order(0, "Atlas Motion Systems", "housing", 20);
  const rejected = order(1, "Cobalt Industrial Supply", "actuator", 15);
  act(rejected, "reject", { notes: "Demo rejection: payment terms could not be agreed. Decision is final.", reviewNotes: "Sample risk flags only; fictional manager review." });
  const stock = order(2, "Meridian Automation", "housing", 12);
  official(stock);
  act(stock, "release-stock", { measurements: "Batch identity, 12 units, packaging integrity and quality certificate checked.", notes: "Finished goods released for one complete shipment." });
  official(order(3, "Summit Robotics", "actuator", 10, sales2));
  const production = order(4, "Vector Engineering", "enclosure", 18);
  official(production);
  for (let stageIndex = 0; stageIndex < 3; stageIndex++) act(production, "stage", {
    stageIndex, status: "Passed", quantity: productionQuantity(production),
    measurements: "Checklist complete. Dimensions and torque meet sample specification.", notes: "Sample production record.",
  });
  act(production, "stage", { stageIndex: 3, status: "Failed", quantity: productionQuantity(production), measurements: "Seal gap measured 0.8 mm; sample maximum is 0.3 mm.", notes: "Seal alignment failed. Rework and passing re-inspection required before packaging." });
  const dispatched = order(5, "Harbor Controls", "enclosure", 6);
  official(dispatched);
  for (let stageIndex = 0; stageIndex < 6; stageIndex++) act(dispatched, "stage", {
    stageIndex, status: "Passed", quantity: productionQuantity(dispatched),
    measurements: "Sample checklist passed: dimensions ±0.2 mm, torque 4 Nm, visual and functional checks complete.", notes: "Recorded by demo factory operator.",
  });
  act(dispatched, "dispatch", { carrier: "Demo Freight Logistics", tracking: "DEMO-FF-1006-2026" });
  return { state, events };
}

export function restoredFixtures(previous: State) {
  requireRule(!previous.orders.some(o => !FIXTURE_IDS.includes(o.id)),
    "Restoration refused: user-created orders exist. Preserve them; use a separate development database for a fresh presentation.");
  const fresh = createFixtures();
  const highestVersion = Math.max(0, ...previous.orders.map(o => o.version));
  for (const order of fresh.state.orders) order.version += highestVersion + 1;
  return fresh;
}
