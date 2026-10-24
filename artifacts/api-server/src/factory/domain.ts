import { randomUUID, createHash } from "node:crypto";
import type {
  FactoryOrder, FactoryOrderInput, FactoryCommandInput, FactoryUser,
  FactoryProduct, FactoryMaterial, FactoryStock, FactoryAttempt,
} from "@workspace/api-zod";

export const STAGES = ["Material Preparation", "Processing", "Assembly", "Quality Inspection", "Packaging", "Ready for Dispatch"];
export const POLICY = "One complete shipment per order. Finished stock is reserved first and retained across material rechecks. Raw materials are consumed atomically only when every shortage can be produced. All batches require recorded quality release; production must pass all six stages.";
export type Actor = FactoryUser;
export type Order = FactoryOrder & { salesId: string; customerId: string; updatedAt: string; materialsConsumed: boolean; officialOrderId?: string };
export type OfficialOrder = { id: string; number: string; submissionId: string; customerId: string; createdBy: string; createdAt: string };
export type Stock = FactoryStock & { history: FactoryAttempt[] };
export type State = {
  products: (FactoryProduct & { unitPrice: number })[];
  materials: FactoryMaterial[];
  stock: Stock[];
  customers: { id: string; company: string; contact: string }[];
  orders: Order[];
  officialOrders?: OfficialOrder[];
  nextOrder: number;
};
export class DomainError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function requireRule(condition: unknown, message: string, status = 409): asserts condition {
  if (!condition) throw new DomainError(status, message);
}
export const now = () => new Date().toISOString();
export const id = () => randomUUID();
export function requireRole(actor: Actor, role: Actor["role"]) {
  requireRule(actor.role === role, `Only ${role} users can perform this action.`, 403);
}
export function canReadCommercial(actor: Actor, order: Order) {
  return actor.role === "Manager" || actor.role === "Sales" && order.salesId === actor.id;
}
export function visibleOrders(state: State, actor: Actor): Order[] {
  if (actor.role === "Manager") return state.orders;
  if (actor.role === "Sales") return state.orders.filter(o => o.salesId === actor.id);
  return state.orders.filter(o => o.officialNumber);
}
export function safeOrder(order: Order, commercial: boolean): FactoryOrder {
  const { salesId, customerId, updatedAt, materialsConsumed, officialOrderId, ...data } = structuredClone(order);
  if (!commercial) {
    delete data.contact; delete data.address; delete data.notes; delete data.salesName;
    delete data.total; delete data.risk; delete data.reviewNotes; delete data.decisionNote;
    delete data.decidedAt; delete data.decidedBy;
    data.lines = data.lines.map(({ id, productId, productName, quantity }) => ({ id, productId, productName, quantity }));
  }
  return data;
}
export function riskFor(company: string): NonNullable<Order["risk"]> {
  const n = createHash("sha256").update(company.toLowerCase()).digest()[0] % 3;
  return {
    level: (["Low", "Medium", "High"] as const)[n], confidence: [84, 68, 73][n],
    label: "Deterministic demo assessment · Sample / unverified · Not live AI or credit research",
    explanation: [
      "Sample scenario indicates routine payment terms. This is fictional and must not be treated as real creditworthiness.",
      "Sample scenario includes an unverified late-payment flag. A manager must independently review the request.",
      "Sample scenario includes fictional overdue balances and a disputed invoice. No external records were checked.",
    ][n],
    evidence: ["Sample / unverified: fictional customer payment ledger (demo fixture).", "Sample / unverified: synthetic business background note. No external source connected."],
  };
}
export function submit(state: State, input: FactoryOrderInput, actor: Actor): Order {
  requireRole(actor, "Sales");
  requireRule(input.company.trim().length >= 2 && input.contact.trim().length >= 5 && input.address.trim().length >= 5, "Company, contact and delivery address are required.", 400);
  const delivery = new Date(input.deliveryDate + "T00:00:00Z");
  requireRule(Number.isFinite(delivery.getTime()) && delivery.toISOString().slice(0, 10) === input.deliveryDate, "Enter a valid delivery date.", 400);
  requireRule(input.lines.length > 0 && input.lines.length <= 30, "Add at least one product.", 400);
  const productIds = new Set<string>();
  const lines = input.lines.map(line => {
    const product = state.products.find(p => p.id === line.productId);
    requireRule(product, "Choose a valid product.", 400);
    requireRule(!productIds.has(product.id), "Each product may appear once. Combine its quantities.", 400);
    productIds.add(product.id);
    requireRule(Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 10000 && Number.isFinite(line.unitPrice) && line.unitPrice >= 0.01 && line.unitPrice <= 1000000, "Enter a positive whole quantity and a positive unit price.", 400);
    requireRule(Math.abs(line.unitPrice * 100 - Math.round(line.unitPrice * 100)) < 0.000001, "Unit prices must have at most two decimal places.", 400);
    const unitPrice = Math.round(line.unitPrice * 100) / 100;
    return { id: id(), productId: product.id, productName: product.name, quantity: line.quantity, unitPrice, total: Math.round(unitPrice * 100) * line.quantity / 100 };
  });
  let customer = state.customers.find(c => c.company.toLowerCase() === input.company.trim().toLowerCase() && c.contact === input.contact.trim());
  if (!customer) {
    customer = { id: id(), company: input.company.trim(), contact: input.contact.trim() };
    state.customers.push(customer);
  }
  const order: Order = {
    id: id(), number: `SO-${String(state.nextOrder++).padStart(5, "0")}`, company: customer.company,
    customerId: customer.id, contact: customer.contact, address: input.address.trim(), notes: input.notes?.trim() ?? "",
    salesId: actor.id, salesName: actor.name, deliveryDate: input.deliveryDate,
    decision: "Pending Manager Review", status: "Pending Manager Review", version: 0,
    createdAt: now(), updatedAt: now(), lines, total: lines.reduce((sum, l) => sum + Math.round(l.total * 100), 0) / 100,
    risk: riskFor(customer.company), stages: [], issues: [], allocations: [], procurement: [],
    progress: 0, materialsConsumed: false,
  };
  state.orders.push(order);
  return order;
}
function reserved(order: Order, lineId: string) {
  return order.allocations.filter(a => a.lineId === lineId).reduce((sum, a) => sum + a.quantity, 0);
}
export function productionQuantity(order: Order) {
  return order.allocations.filter(a => a.source === "Production").reduce((sum, a) => sum + a.quantity, 0);
}
export function serialsFor(allocationId: string, quantity: number): string[] {
  return quantity <= 10 ? Array.from({ length: quantity }, (_, i) => `FF-SN-${allocationId}-${String(i + 1).padStart(2, "0")}`) : [];
}
function blocking(order: Order) { return order.issues.some(i => !i.resolvedAt); }
function allAllocated(order: Order) { return order.lines.every(l => reserved(order, l.id) === l.quantity); }
function isReady(order: Order) {
  return allAllocated(order) && order.allocations.every(a => a.released) && !blocking(order)
    && (!productionQuantity(order) || order.stages.length === 6 && order.stages.every(s => s.status === "Passed"));
}
function refreshStatus(order: Order) {
  order.progress = order.stages.length ? Math.round(order.stages.filter(s => s.status === "Passed").length / 6 * 100) : 0;
  if (isReady(order)) { order.status = "Ready for Dispatch"; order.progress = 100; }
}
function checkInventory(state: State, order: Order, actor: Actor) {
  requireRule(["Factory Queue", "Waiting for Materials"].includes(order.status), "Inventory has already been checked or production scheduled.");
  for (const line of order.lines) {
    let needed = line.quantity - reserved(order, line.id);
    for (const stock of state.stock.filter(s => s.productId === line.productId && s.quality === "Passed")) {
      const take = Math.min(needed, stock.available);
      if (take <= 0) continue;
      stock.available -= take;
      order.allocations.push({
        id: id(), lineId: line.id, productId: line.productId, productName: line.productName,
        batchId: stock.batchId, quantity: take, source: "Finished Stock", released: false,
        history: [...structuredClone(stock.history), { id: id(), status: "Reserved", actor: actor.name, startedAt: now(), completedAt: now(), quantity: take, measurements: "Quantity and batch identity verified", notes: `Reserved for ${order.officialNumber}` }],
      });
      needed -= take;
    }
  }
  const needs = new Map<string, number>();
  for (const line of order.lines) {
    const shortage = line.quantity - reserved(order, line.id);
    for (const req of state.products.find(p => p.id === line.productId)!.requirements) {
      needs.set(req.materialId, (needs.get(req.materialId) ?? 0) + shortage * req.quantity);
    }
  }
  const insufficient = [...needs].filter(([materialId, qty]) => qty > state.materials.find(m => m.id === materialId)!.available);
  if (insufficient.length) {
    for (const [materialId, qty] of insufficient) {
      const material = state.materials.find(m => m.id === materialId)!;
      const shortage = qty - material.available;
      const task = order.procurement.find(p => p.materialId === materialId && p.status === "Open");
      if (task) task.quantity = Math.max(task.quantity, task.received + shortage);
      else order.procurement.push({ id: id(), materialId, materialName: material.name, quantity: shortage, received: 0, status: "Open" });
    }
    order.status = "Waiting for Materials";
    return;
  }
  // Materials are decremented only once and only after the complete BOM fits.
  for (const [materialId, qty] of needs) state.materials.find(m => m.id === materialId)!.available -= qty;
  for (const line of order.lines) {
    const shortage = line.quantity - reserved(order, line.id);
    const allocationId = id();
    if (shortage > 0) order.allocations.push({
      id: allocationId, lineId: line.id, productId: line.productId, productName: line.productName,
      batchId: `FF-${order.officialNumber}-${line.productId}-${id().slice(0, 8)}`,
      serialNumbers: serialsFor(allocationId, shortage),
      quantity: shortage, source: "Production", released: false, history: [],
    });
  }
  order.materialsConsumed = productionQuantity(order) > 0;
  order.expectedDispatch = new Date(Date.now() + (order.materialsConsumed ? 7 : 2) * 86400000).toISOString().slice(0, 10);
  if (order.materialsConsumed) {
    order.stages = STAGES.map((name, index) => ({ name, index, status: "Not Started", attempts: [] }));
    order.status = "Scheduled for Production";
  } else order.status = "Awaiting Stock Release";
  for (const task of order.procurement) if (task.status === "Open") task.status = "No longer required";
}
function recordStage(order: Order, input: FactoryCommandInput, actor: Actor) {
  requireRule(productionQuantity(order) > 0 && ["Scheduled for Production", "In Production", "Quality Hold"].includes(order.status), "Production is not scheduled or is already complete.");
  const stage = order.stages[input.stageIndex ?? -1];
  requireRule(stage && input.status, "Choose a production stage and status.", 400);
  requireRule(order.stages.slice(0, stage.index).every(s => s.status === "Passed"), "Complete every preceding stage first.");
  requireRule(stage.status !== "Passed", "A passed stage cannot be overwritten.");
  requireRule(!blocking(order), "Resolve all blocking issues before continuing or re-inspecting.");
  requireRule(input.quantity === productionQuantity(order), `Process the complete production quantity: ${productionQuantity(order)} units.`, 400);
  requireRule(input.measurements?.trim(), "Record measurements or completed checklist results.", 400);
  requireRule(input.status !== "Failed" || input.notes?.trim(), "A failed stage requires issue details.", 400);
  requireRule(input.status !== "In Progress" || stage.status !== "In Progress", "This stage is already in progress.");
  const last = stage.attempts.at(-1);
  const open = last?.status === "In Progress" ? last : undefined;
  stage.attempts.push({
    id: id(), status: input.status, actor: actor.name, startedAt: open?.startedAt ?? now(),
    ...(input.status !== "In Progress" ? { completedAt: now() } : {}),
    quantity: input.quantity, measurements: input.measurements!.trim(), notes: input.notes?.trim() ?? "",
  });
  stage.status = input.status;
  if (input.status === "Failed") {
    order.issues.push({ id: id(), stageIndex: stage.index, notes: input.notes!.trim(), createdAt: now(), actor: actor.name });
    order.status = "Quality Hold";
  } else order.status = "In Production";
  if (order.stages.every(s => s.status === "Passed")) {
    for (const a of order.allocations.filter(a => a.source === "Production")) {
      a.released = true;
      a.history = order.stages.flatMap(s => structuredClone(s.attempts));
    }
    order.status = "Awaiting Stock Release";
  }
  refreshStatus(order);
}
export function command(state: State, order: Order, input: FactoryCommandInput, actor: Actor) {
  requireRole(actor, ["approve", "reject", "official"].includes(input.action) ? "Manager" : "Factory Operator");
  requireRule(order.version === input.version, "This order changed. Refresh it before trying again.");
  if (["approve", "reject", "official"].includes(input.action)) {
    requireRole(actor, "Manager");
    if (input.action === "official") {
      requireRule(order.decision === "Approved", "Only approved submissions can become official orders.");
      requireRule(!order.officialNumber, "An official order already exists.");
      order.officialNumber = `FO-${order.number.slice(3)}`;
      order.officialCreatedBy = actor.name; order.officialCreatedAt = now();
      order.officialOrderId = id();
      (state.officialOrders ??= []).push({
        id: order.officialOrderId, number: order.officialNumber, submissionId: order.id,
        customerId: order.customerId, createdBy: actor.name, createdAt: order.officialCreatedAt,
      });
      order.status = "Factory Queue";
    } else {
      requireRule(order.decision === "Pending Manager Review", "This decision is final. Rejected or approved submissions cannot be re-decided.");
      requireRule(input.notes?.trim(), "A decision note is required.", 400);
      order.decision = input.action === "approve" ? "Approved" : "Rejected";
      order.status = input.action === "approve" ? "Approved · Awaiting Official Order" : "Rejected";
      order.decisionNote = input.notes!.trim(); order.reviewNotes = input.reviewNotes?.trim() ?? "";
      order.decidedBy = actor.name; order.decidedAt = now();
    }
  } else {
    requireRole(actor, "Factory Operator");
    requireRule(order.officialNumber && order.decision === "Approved", "Factory processing requires an approved, separately created official order.");
    requireRule(!order.shipment, "Dispatched orders are immutable.");
    switch (input.action) {
      case "check-inventory": checkInventory(state, order, actor); break;
      case "receive-material": {
        const task = order.procurement.find(p => p.id === input.procurementId);
        requireRule(task && task.status === "Open", "Select an open procurement task.", 400);
        requireRule(input.quantity && Number.isInteger(input.quantity) && input.quantity > 0 && input.quantity <= task.quantity - task.received, "Receipt quantity must not exceed the outstanding procurement quantity.", 400);
        requireRule(input.notes?.trim(), "Record a receipt reference or note.", 400);
        state.materials.find(m => m.id === task.materialId)!.available += input.quantity;
        task.received += input.quantity;
        if (task.received === task.quantity) task.status = "Received";
        break;
      }
      case "stage": recordStage(order, input, actor); break;
      case "resolve-issue": {
        const issue = order.issues.find(i => i.id === input.issueId);
        requireRule(issue && !issue.resolvedAt, "Select an unresolved issue.", 400);
        requireRule(input.notes?.trim(), "Record how the issue was resolved.", 400);
        issue.resolution = input.notes!.trim(); issue.resolvedAt = now(); issue.resolvedBy = actor.name;
        // The failed stage intentionally remains Failed until a recorded pass.
        break;
      }
      case "release-stock": {
        const allocations = order.allocations.filter(a => a.source === "Finished Stock" && !a.released);
        requireRule(allocations.length && !blocking(order), "There is no releasable stock or a blocking issue remains.");
        requireRule(input.measurements?.trim() && input.notes?.trim(), "Record the stock-readiness checklist and release notes.", 400);
        for (const a of allocations) {
          a.released = true;
          a.history.push({ id: id(), status: "Passed", actor: actor.name, startedAt: now(), completedAt: now(), quantity: a.quantity, measurements: input.measurements!.trim(), notes: input.notes!.trim() });
        }
        refreshStatus(order);
        break;
      }
      case "dispatch":
        requireRule(isReady(order), "Dispatch requires all quantities allocated, released batches, six passed production stages, and no unresolved issues.");
        requireRule(input.carrier?.trim() && input.tracking?.trim(), "Carrier and tracking number are required.", 400);
        order.shipment = { carrier: input.carrier!.trim(), tracking: input.tracking!.trim(), dispatchedAt: now(), actor: actor.name };
        order.status = "Dispatched"; order.progress = 100;
        break;
      default: throw new DomainError(400, "Unknown workflow action.");
    }
  }
  order.version++; order.updatedAt = now();
}
