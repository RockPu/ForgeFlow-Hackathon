import { test } from "node:test";
import assert from "node:assert/strict";
import { createFixtures, restoredFixtures, DEMO_USERS } from "./fixtures";
import { command, submit, safeOrder, visibleOrders, productionQuantity, type Order } from "./domain";

const [sales, sales2, manager, operator] = DEMO_USERS;
function setup() { return createFixtures().state; }
test("six persistent fixture branches and complete dispatched batch history", () => {
  const s = setup();
  assert.equal(s.orders.length, 6);
  assert.deepEqual(s.orders.map(o => o.status), ["Pending Manager Review", "Rejected", "Ready for Dispatch", "Waiting for Materials", "Quality Hold", "Dispatched"]);
  const shipped = s.orders[5];
  assert.equal(shipped.stages.length, 6);
  assert.ok(shipped.stages.every(stage => stage.status === "Passed" && stage.attempts[0].actor && stage.attempts[0].completedAt));
  assert.ok(shipped.allocations.every(a => a.batchId && a.quantity && a.released));
  assert.ok(shipped.allocations.every(a => a.serialNumbers?.length === a.quantity));
  assert.equal(s.officialOrders?.length, 4);
  assert.ok(shipped.shipment?.tracking);
});
test("rejection is final at old and fresh versions; explicit official-order gate", () => {
  const s = setup(), rejected = s.orders[1], pending = s.orders[0];
  assert.throws(() => command(s, rejected, { action: "approve", version: 0, notes: "stale" }, manager), /changed/);
  assert.throws(() => command(s, rejected, { action: "approve", version: rejected.version, notes: "try again" }, manager), /decision is final/);
  assert.throws(() => command(s, rejected, { action: "official", version: rejected.version }, manager), /Only approved/);
  assert.throws(() => command(s, pending, { action: "official", version: 0 }, manager), /Only approved/);
  command(s, pending, { action: "approve", version: 0, notes: "Manually approved" }, manager);
  assert.equal(pending.officialNumber, undefined);
  assert.throws(() => command(s, pending, { action: "check-inventory", version: pending.version }, operator), /separately created/);
  command(s, pending, { action: "official", version: pending.version }, manager);
  assert.equal(s.officialOrders?.find(o => o.submissionId === pending.id)?.id, pending.officialOrderId);
  assert.throws(() => command(s, pending, { action: "official", version: pending.version }, manager), /already exists/);
  assert.equal(rejected.decision, "Rejected");
});
test("ownership and shared projections never disclose commercial details", () => {
  const s = setup();
  assert.equal(visibleOrders(s, sales2).length, 1);
  assert.equal(visibleOrders(s, sales).length, 5);
  for (const o of s.orders) {
    const shared = safeOrder(o, false);
    for (const key of ["contact", "address", "notes", "salesName", "total", "risk", "reviewNotes", "decisionNote"] as const) assert.equal(shared[key], undefined);
    assert.ok(shared.lines.every(l => l.unitPrice === undefined && l.total === undefined));
  }
  assert.equal(visibleOrders(s, operator).length, 4);
});
test("multi-product totals, numeric validation, and server roles", () => {
  const s = setup();
  const input = { company: "Test Industries", contact: "Purchasing team", address: "Demo loading bay", deliveryDate: "2027-02-21", lines: [{ productId: "housing", quantity: 2, unitPrice: 10.15 }, { productId: "actuator", quantity: 3, unitPrice: 50 }] };
  assert.equal(submit(s, input, sales).total, 170.3);
  assert.throws(() => submit(s, input, manager), /Only Sales/);
  assert.throws(() => submit(s, { ...input, lines: [{ ...input.lines[0], quantity: 1.5 }] }, sales), /whole quantity/);
  assert.throws(() => submit(s, { ...input, lines: [{ ...input.lines[0], unitPrice: -2 }] }, sales), /positive unit/);
  assert.throws(() => submit(s, { ...input, lines: [{ ...input.lines[0], unitPrice: 10.155 }] }, sales), /two decimal/);
  assert.throws(() => submit(s, { ...input, deliveryDate: "2027-02-30" }, sales), /valid delivery/);
  assert.throws(() => submit(s, { ...input, lines: [input.lines[0], input.lines[0]] }, sales), /once/);
  assert.throws(() => command(s, s.orders[0], { action: "approve", version: 0, notes: "Forged" }, operator), /Only Manager/);
});
test("material receipts recheck cleanly, retain stock and cannot double consume", () => {
  const s = setup(), o = s.orders[3];
  const task = o.procurement[0];
  const aluminumBefore = s.materials[0].available;
  command(s, o, { action: "check-inventory", version: o.version }, operator);
  assert.equal(o.procurement.length, 1);
  assert.throws(() => command(s, o, { action: "receive-material", version: o.version, procurementId: task.id, quantity: 11, notes: "Too many" }, operator), /outstanding/);
  command(s, o, { action: "receive-material", version: o.version, procurementId: task.id, quantity: 10, notes: "Delivery note SAMPLE-1" }, operator);
  assert.equal(o.status, "Waiting for Materials");
  command(s, o, { action: "check-inventory", version: o.version }, operator);
  assert.equal(o.status, "Scheduled for Production");
  assert.equal(s.materials.find(m => m.id === "motor")!.available, 0);
  assert.equal(s.materials[0].available, aluminumBefore - 30);
  assert.throws(() => command(s, o, { action: "check-inventory", version: o.version }, operator), /already been checked/);
  assert.equal(s.materials[0].available, aluminumBefore - 30);
});
test("failed inspection remains visible through resolution, re-inspection and dispatch", () => {
  const s = setup(), o = s.orders[4], qty = productionQuantity(o);
  const stage = (stageIndex: number) => command(s, o, { action: "stage", version: o.version, stageIndex, status: "Passed", quantity: qty, measurements: "All sample dimensional and visual checks pass" }, operator);
  assert.throws(() => stage(4), /preceding/);
  assert.throws(() => stage(3), /Resolve all/);
  assert.throws(() => command(s, o, { action: "dispatch", version: o.version, carrier: "Demo", tracking: "T" }, operator), /Dispatch requires/);
  command(s, o, { action: "resolve-issue", version: o.version, issueId: o.issues[0].id, notes: "Replaced seal and corrected alignment" }, operator);
  assert.equal(o.stages[3].status, "Failed");
  assert.throws(() => command(s, o, { action: "dispatch", version: o.version, carrier: "Demo", tracking: "T" }, operator), /Dispatch requires/);
  stage(3); stage(4); stage(5);
  assert.equal(o.stages[3].attempts.filter(a => a.status === "Failed").length, 1);
  assert.equal(o.stages[3].attempts.filter(a => a.status === "Passed").length, 1);
  assert.equal(o.status, "Awaiting Stock Release");
  assert.throws(() => command(s, o, { action: "dispatch", version: o.version, carrier: "Demo", tracking: "T" }, operator), /Dispatch requires/);
  command(s, o, { action: "release-stock", version: o.version, measurements: "Four stock units inspected", notes: "Release approved" }, operator);
  assert.equal(o.status, "Ready for Dispatch");
  command(s, o, { action: "dispatch", version: o.version, carrier: "Demo Logistics", tracking: "DEMO-X" }, operator);
  assert.equal(o.status, "Dispatched");
  assert.ok(o.issues[0].resolution);
  assert.throws(() => command(s, o, { action: "dispatch", version: o.version, carrier: "Duplicate", tracking: "D" }, operator), /immutable/);
});
test("finished stock dispatch still requires explicit quality release", () => {
  const s = setup(), o = s.orders[0];
  command(s, o, { action: "approve", version: 0, notes: "Reviewed" }, manager);
  command(s, o, { action: "official", version: o.version }, manager);
  command(s, o, { action: "check-inventory", version: o.version }, operator);
  assert.equal(o.status, "Awaiting Stock Release");
  assert.throws(() => command(s, o, { action: "dispatch", version: o.version, carrier: "Demo", tracking: "D" }, operator), /Dispatch requires/);
  command(s, o, { action: "release-stock", version: o.version, measurements: "Identity and packaging passed", notes: "Released" }, operator);
  assert.equal(o.status, "Ready for Dispatch");
  assert.equal(o.progress, 100);
  assert.ok(o.allocations.every(a => a.history.some(h => h.status === "Passed")));
});
test("one-shipment multi-line order retains partial reservations while waiting", () => {
  const s = setup();
  const o = submit(s, { company: "Mixed Order Demo", contact: "Demo purchasing", address: "Sample receiving address", deliveryDate: "2027-02-21", lines: [{ productId: "housing", quantity: 5, unitPrice: 85 }, { productId: "actuator", quantity: 10, unitPrice: 320 }] }, sales);
  command(s, o, { action: "approve", version: 0, notes: "Approved" }, manager);
  command(s, o, { action: "official", version: o.version }, manager);
  command(s, o, { action: "check-inventory", version: o.version }, operator);
  const batch = o.allocations[0], stockQty = s.stock[0].available;
  assert.equal(batch.quantity, 5);
  assert.equal(o.status, "Waiting for Materials");
  command(s, o, { action: "check-inventory", version: o.version }, operator);
  assert.equal(s.stock[0].available, stockQty);
  assert.equal(o.allocations.length, 1);
  assert.throws(() => command(s, o, { action: "dispatch", version: o.version, carrier: "Demo", tracking: "partial" }, operator), /Dispatch requires/);
});
test("safe restoration refuses unrelated orders and invalidates every stale fixture version", () => {
  const s = setup();
  s.orders[0].version = 100;
  const fresh = restoredFixtures(s);
  assert.ok(fresh.state.orders.every(o => o.version > 100));
  assert.equal(s.orders[0].version, 100);
  assert.equal(fresh.state.orders[1].decision, "Rejected");
  submit(s, { company: "Unrelated user order", contact: "Demo buyer", address: "Sample address", deliveryDate: "2027-02-21", lines: [{ productId: "housing", quantity: 1, unitPrice: 85 }] }, sales);
  assert.throws(() => restoredFixtures(s), /user-created orders exist/);
});
