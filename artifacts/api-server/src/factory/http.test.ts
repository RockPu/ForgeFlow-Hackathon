import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { db, pool, factoryWorkspaces, factorySessions } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { createFactoryRouter } from "../routes/factory";
import { createFixtures, DEMO_PASSWORD } from "./fixtures";
import { logger } from "../lib/logger";

test("HTTP sessions, role isolation, persistence, atomic stock allocation and audit", async t => {
  const workspace = `factory-test-${randomUUID()}`;
  const state = createFixtures().state;
  for (const order of state.orders) order.id = `${workspace}-${order.id}`;
  await db.insert(factoryWorkspaces).values({ id: workspace, state });
  const app = express();
  app.use(express.json(), (req, _res, next) => { Object.assign(req, { log: logger }); next(); });
  app.use("/api/factory", createFactoryRouter(workspace));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}/api/factory`;
  const tokens = new Set<string>();
  function client() {
    let cookie = "", csrf = "";
    return {
      async req(path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) {
        const r = await fetch(base + path, { method, headers: { "content-type": "application/json", cookie, "x-factory-csrf": csrf, ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
        const set = r.headers.get("set-cookie");
        if (set) { cookie = set.split(";")[0]; const token = cookie.split("=")[1]; if (token) tokens.add(token); }
        const data = await r.json() as any;
        if (data.csrfToken) csrf = data.csrfToken;
        return { status: r.status, data };
      },
      async signIn(email: string) {
        assert.equal((await this.req("/session")).status, 200);
        const result = await this.req("/login", "POST", { email, password: DEMO_PASSWORD, role: "Manager" });
        assert.equal(result.status, 200);
        return result.data;
      },
    };
  }
  const sales = client(), sales2 = client(), manager = client(), operator = client(), anon = client();
  const oid = (suffix: string) => `${workspace}-demo-${suffix}`;
  try {
    await t.test("anonymous access, login CSRF and actual server-side identities", async () => {
      assert.equal((await anon.req("/orders")).status, 401);
      assert.equal((await anon.req("/login", "POST", { email: "manager@forgeflow.demo", password: DEMO_PASSWORD })).status, 403);
      await anon.req("/session");
      assert.equal((await anon.req("/login", "POST", { email: "manager@forgeflow.demo", password: "wrong" })).status, 401);
      assert.equal((await anon.req("/login", "POST", { email: "manager@forgeflow.demo", password: DEMO_PASSWORD }, { "sec-fetch-site": "cross-site" })).status, 403);
      const s = await sales.signIn("sales@forgeflow.demo");
      assert.equal(s.user.role, "Sales");
      await sales2.signIn("sales2@forgeflow.demo");
      await manager.signIn("manager@forgeflow.demo");
      await operator.signIn("operator@forgeflow.demo");
    });
    await t.test("commercial ownership and sanitized shared progress/traceability", async () => {
      const a = await sales.req("/orders"), b = await sales2.req("/orders");
      assert.equal(a.data.length, 5); assert.equal(b.data.length, 1);
      assert.equal((await sales.req(`/orders/${oid("materials")}`)).status, 404);
      assert.equal((await sales2.req(`/orders/${oid("production")}`)).status, 404);
      assert.equal((await sales.req("/inventory")).status, 403);
      assert.equal((await operator.req(`/orders/${oid("production")}/audit`)).status, 403);
      assert.equal((await sales2.req(`/orders/${oid("production")}/audit`)).status, 403);
      const floor = await sales2.req("/production");
      assert.equal(floor.data.length, 4);
      for (const o of floor.data) {
        assert.equal(o.risk, undefined); assert.equal(o.contact, undefined); assert.equal(o.total, undefined);
        assert.equal(o.decisionNote, undefined); assert.ok(o.lines.every((l: any) => l.unitPrice === undefined));
      }
      const cat = await operator.req("/catalog");
      assert.ok(cat.data.products.every((p: any) => p.unitPrice === undefined));
      const serial = state.orders[5].allocations[0].serialNumbers![0];
      assert.equal((await sales.req(`/traceability?search=${encodeURIComponent(serial)}`)).data[0].officialNumber, "FO-01006");
      const operatorOrders = await operator.req("/orders");
      assert.ok(operatorOrders.data.every((o: any) => !o.total && !o.risk));
    });
    await t.test("forged roles, missing CSRF, immutable rejection and pre-official gate", async () => {
      const pending = oid("awaiting"), rejected = oid("rejected");
      assert.equal((await sales.req(`/orders/${pending}/commands`, "POST", { action: "approve", version: 0, notes: "forged", role: "Manager" })).status, 403);
      assert.equal((await manager.req(`/orders/${pending}/commands`, "POST", { action: "approve", version: 0, notes: "missing token" }, { "x-factory-csrf": "" })).status, 403);
      assert.equal((await operator.req(`/orders/${pending}/commands`, "POST", { action: "check-inventory", version: 0 })).status, 409);
      const r = (await manager.req(`/orders/${rejected}`)).data;
      assert.equal((await manager.req(`/orders/${rejected}/commands`, "POST", { action: "approve", version: r.version, notes: "change rejected" })).status, 409);
      assert.equal((await manager.req(`/orders/${rejected}/commands`, "POST", { action: "approve", version: 0, notes: "stale" })).status, 409);
      assert.equal((await manager.req(`/orders/${rejected}`)).data.decision, "Rejected");
      assert.equal((await sales.req(`/orders/${rejected}`)).data.decision, "Rejected");
    });
    const freshOrders: string[] = [];
    await t.test("multi-line submission validation and durable read after account switch", async () => {
      const input = { company: "Integration Mixed Sample", contact: "Demo purchasing office", deliveryDate: "2027-02-21", address: "Sample receiving address", lines: [{ productId: "housing", quantity: 50, unitPrice: 85 }, { productId: "actuator", quantity: 1, unitPrice: 320 }] };
      assert.equal((await manager.req("/orders", "POST", input)).status, 403);
      assert.equal((await sales.req("/orders", "POST", { ...input, lines: [{ ...input.lines[0], quantity: -1 }] })).status, 400);
      for (let i = 0; i < 2; i++) {
        const created = await sales.req("/orders", "POST", { ...input, company: `Concurrent Sample ${i}`, lines: i === 0 ? input.lines : [input.lines[0]] });
        assert.equal(created.status, 201);
        const o = created.data;
        freshOrders.push(o.id);
        assert.equal(o.decision, "Pending Manager Review");
        assert.equal((await manager.req(`/orders/${o.id}`)).data.total, i === 0 ? 4570 : 4250);
        assert.equal((await sales2.req(`/orders/${o.id}`)).status, 404);
        assert.equal((await manager.req(`/orders/${o.id}/commands`, "POST", { action: "approve", version: 0, notes: "Manual test decision" })).status, 200);
        assert.equal((await operator.req(`/orders/${o.id}/commands`, "POST", { action: "check-inventory", version: 1 })).status, 409);
        const duplicate = await Promise.all([1, 2].map(() => manager.req(`/orders/${o.id}/commands`, "POST", { action: "official", version: 1 })));
        assert.deepEqual(duplicate.map(r => r.status).sort(), [200, 409]);
      }
    });
    await t.test("concurrent distinct-order and duplicate reservations never over-allocate", async () => {
      const checked = await Promise.all(freshOrders.map(id => operator.req(`/orders/${id}/commands`, "POST", { action: "check-inventory", version: 2 })));
      assert.ok(checked.every(r => r.status === 200));
      const inventory = await operator.req("/inventory");
      assert.ok(inventory.data.stock.every((s: any) => s.available >= 0));
      assert.ok(inventory.data.materials.every((m: any) => m.available >= 0));
      assert.equal(inventory.data.stock.find((s: any) => s.productId === "housing").available, 0);
      const allocated = checked.reduce((n, r) => n + r.data.allocations.filter((a: any) => a.source === "Finished Stock").reduce((sum: number, a: any) => sum + a.quantity, 0), 0);
      assert.equal(allocated, 48);
      // First order is waiting for a motor. Rechecks are allowed but must not reserve again.
      const before = JSON.stringify(inventory.data.stock);
      const dup = await Promise.all([1, 2].map(() => operator.req(`/orders/${freshOrders[0]}/commands`, "POST", { action: "check-inventory", version: 3 })));
      assert.deepEqual(dup.map(r => r.status).sort(), [200, 409]);
      assert.equal(JSON.stringify((await operator.req("/inventory")).data.stock), before);
    });
    await t.test("failed quality -> resolution -> re-inspection -> release -> unique dispatch", async () => {
      const orderId = oid("production");
      let o = (await operator.req(`/orders/${orderId}`)).data;
      const action = async (data: any) => {
        const r = await operator.req(`/orders/${orderId}/commands`, "POST", { ...data, version: o.version });
        if (r.status === 200) o = r.data;
        return r;
      };
      assert.equal((await action({ action: "dispatch", carrier: "Demo", tracking: "early" })).status, 409);
      assert.equal((await action({ action: "resolve-issue", issueId: o.issues[0].id, notes: "Seal replaced, alignment corrected" })).status, 200);
      assert.equal((await action({ action: "dispatch", carrier: "Demo", tracking: "still early" })).status, 409);
      const quantity = o.allocations.filter((a: any) => a.source === "Production").reduce((n: number, a: any) => n + a.quantity, 0);
      for (const stageIndex of [3, 4, 5]) assert.equal((await action({ action: "stage", stageIndex, status: "Passed", quantity, measurements: "Measured seal gap 0.2mm; checklist passes" })).status, 200);
      assert.equal((await action({ action: "dispatch", carrier: "Demo", tracking: "unreleased" })).status, 409);
      assert.equal((await action({ action: "release-stock", measurements: "Stock identity and packaging confirmed", notes: "Passed all checks" })).status, 200);
      const dispatches = await Promise.all([1, 2].map(() => operator.req(`/orders/${orderId}/commands`, "POST", { action: "dispatch", version: o.version, carrier: "Test Demo Freight", tracking: "DEMO-INTEGRATION" })));
      assert.deepEqual(dispatches.map(r => r.status).sort(), [200, 409]);
      o = (await sales.req(`/orders/${orderId}`)).data;
      assert.equal(o.status, "Dispatched");
      assert.deepEqual(o.stages[3].attempts.map((a: any) => a.status), ["Failed", "Passed"]);
      const search = await sales2.req(`/traceability?search=${encodeURIComponent(o.allocations[0].batchId)}`);
      assert.equal(search.data[0].shipment.tracking, "DEMO-INTEGRATION");
      const audit = await manager.req(`/orders/${orderId}/audit`);
      assert.ok(audit.data.some((e: any) => e.action === "resolve-issue" && e.actor === "Sam Rivera" && e.before.order && e.after.order));
      assert.equal(audit.data.filter((e: any) => e.action === "dispatch").length, 1);
    });
    await t.test("logout revokes the session and data survives another login", async () => {
      assert.equal((await sales.req("/logout", "POST")).status, 200);
      assert.equal((await sales.req("/orders")).status, 401);
      await sales.signIn("sales@forgeflow.demo");
      assert.equal((await sales.req(`/orders/${freshOrders[0]}`)).data.id, freshOrders[0]);
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
    // Delete only the isolated test aggregate and this test's opaque sessions.
    // Append-only audit records remain as evidence, never modifying demo records.
    await db.delete(factoryWorkspaces).where(eq(factoryWorkspaces.id, workspace));
    const { createHash } = await import("node:crypto");
    const hashes = [...tokens].map(token => createHash("sha256").update(token).digest("hex"));
    if (hashes.length) await db.delete(factorySessions).where(inArray(factorySessions.tokenHash, hashes));
    await pool.end();
  }
});
