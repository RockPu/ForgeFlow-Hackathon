import { Router, type ErrorRequestHandler, type IRouter } from "express";
import cookieParser from "cookie-parser";
import {
  FactoryLoginBody, FactoryLoginResponse, FactorySessionResponse, FactoryLogoutResponse,
  FactoryCatalogResponse, FactoryOrdersQueryParams, FactoryOrdersResponse,
  FactorySubmitOrderBody, FactorySubmitOrderResponse, FactoryOrderParams, FactoryOrderResponse,
  FactoryCommandBody, FactoryCommandParams, FactoryCommandResponse, FactoryDashboardResponse,
  FactoryProductionResponse, FactoryInventoryResponse, FactoryTraceabilityQueryParams,
  FactoryTraceabilityResponse, FactoryAuditParams, FactoryAuditResponse,
} from "@workspace/api-zod";
import { sessionMiddleware, requireCsrf, requireAuth, newSession, login, logout } from "../factory/auth";
import { readState as readWorkspace, mutate as mutateWorkspace, auditFor, WORKSPACE } from "../factory/store";
import { DomainError, requireRule, requireRole, safeOrder, visibleOrders, canReadCommercial, submit, command, STAGES, POLICY, type Order } from "../factory/domain";

export function createFactoryRouter(workspace = WORKSPACE): IRouter {
const readState = () => readWorkspace(workspace);
const mutate: typeof mutateWorkspace = (actor, action, orderId, work, details) => mutateWorkspace(actor, action, orderId, work, details, workspace);
const router: IRouter = Router();
router.use(cookieParser(), sessionMiddleware, requireCsrf);
router.get("/session", async (req, res): Promise<void> => {
  const session = req.factorySession ?? await newSession(req, res);
  res.json(FactorySessionResponse.parse({ user: req.factoryUser ?? null, csrfToken: session.csrfToken }));
});
router.post("/login", async (req, res): Promise<void> => {
  const input = FactoryLoginBody.parse(req.body);
  res.json(FactoryLoginResponse.parse(await login(req, res, input.email, input.password)));
});
router.use(requireAuth);
router.post("/logout", async (req, res): Promise<void> => {
  await logout(req, res);
  res.json(FactoryLogoutResponse.parse({ message: "Signed out." }));
});
router.get("/catalog", async (req, res): Promise<void> => {
  const state = await readState();
  const products = req.factoryUser!.role === "Factory Operator" ? state.products.map(({ unitPrice, ...p }) => p) : state.products;
  res.json(FactoryCatalogResponse.parse({ products, stages: STAGES, policy: POLICY }));
});
router.get("/orders", async (req, res): Promise<void> => {
  const { search = "", status } = FactoryOrdersQueryParams.parse(req.query);
  const state = await readState();
  const items = visibleOrders(state, req.factoryUser!).filter(o => matches(o, search) && (!status || status === "All" || o.status === status || o.decision === status));
  res.json(FactoryOrdersResponse.parse(items.toReversed().map(o => safeOrder(o, canReadCommercial(req.factoryUser!, o)))));
});
router.post("/orders", async (req, res): Promise<void> => {
  const input = FactorySubmitOrderBody.parse(req.body);
  const order = await mutate(req.factoryUser!, "Order submitted", undefined, state => submit(state, input, req.factoryUser!));
  res.status(201).json(FactorySubmitOrderResponse.parse(safeOrder(order, true)));
});
router.get("/orders/:id", async (req, res): Promise<void> => {
  const { id } = FactoryOrderParams.parse(req.params);
  const state = await readState();
  const order = visibleOrders(state, req.factoryUser!).find(o => o.id === id);
  requireRule(order, "Order not found or not accessible.", 404);
  res.json(FactoryOrderResponse.parse(safeOrder(order, canReadCommercial(req.factoryUser!, order))));
});
router.post("/orders/:id/commands", async (req, res): Promise<void> => {
  const { id } = FactoryCommandParams.parse(req.params);
  const input = FactoryCommandBody.parse(req.body);
  const order = await mutate(req.factoryUser!, input.action, id, state => {
    const order = state.orders.find(o => o.id === id);
    requireRule(order, "Order not found.", 404);
    command(state, order, input, req.factoryUser!);
    return order;
  }, input);
  res.json(FactoryCommandResponse.parse(safeOrder(order, canReadCommercial(req.factoryUser!, order))));
});
router.get("/production", async (_req, res): Promise<void> => {
  const state = await readState();
  res.json(FactoryProductionResponse.parse(state.orders.filter(o => o.officialNumber).toReversed().map(o => safeOrder(o, false))));
});
router.get("/inventory", async (req, res): Promise<void> => {
  requireRole(req.factoryUser!, "Factory Operator");
  const state = await readState();
  res.json(FactoryInventoryResponse.parse({ materials: state.materials, stock: state.stock, policy: POLICY }));
});
router.get("/traceability", async (req, res): Promise<void> => {
  const { search = "" } = FactoryTraceabilityQueryParams.parse(req.query);
  const state = await readState();
  res.json(FactoryTraceabilityResponse.parse(state.orders.filter(o => o.officialNumber && matches(o, search)).toReversed().map(o => safeOrder(o, false))));
});
router.get("/dashboard", async (req, res): Promise<void> => {
  const items = visibleOrders(await readState(), req.factoryUser!);
  res.json(FactoryDashboardResponse.parse({
    total: items.length, pending: items.filter(o => o.decision === "Pending Manager Review").length,
    active: items.filter(o => o.officialNumber && !o.shipment).length,
    blocked: items.filter(o => ["Waiting for Materials", "Quality Hold"].includes(o.status)).length,
    dispatched: items.filter(o => o.shipment).length,
    recent: items.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6).map(o => ({ orderId: o.id, number: o.officialNumber ?? o.number, company: o.company, status: o.status, at: o.updatedAt })),
  }));
});
router.get("/orders/:id/audit", async (req, res): Promise<void> => {
  const { id } = FactoryAuditParams.parse(req.params);
  const order = (await readState()).orders.find(o => o.id === id);
  requireRule(order && canReadCommercial(req.factoryUser!, order), "Commercial audit history is restricted to the Manager and submitting Sales user.", 403);
  // Before/after snapshots preserve commercial decisions, never expose other orders.
  const events = (await auditFor(id)).map(e => {
    const before = e.before as { order?: Order };
    const after = e.after as { order?: Order; request?: unknown };
    return { ...e, before: { order: before.order ? safeOrder(before.order, true) : null }, after: { order: after.order ? safeOrder(after.order, true) : null, request: after.request } };
  });
  res.json(FactoryAuditResponse.parse(events));
});
const errors: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof DomainError) { res.status(error.status).json({ error: error.message }); return; }
  if (error?.name === "ZodError") {
    res.status(400).json({ error: "Please check the submitted fields.", details: error.issues?.map((i: { path: string[]; message: string }) => `${i.path.join(".")}: ${i.message}`) });
    return;
  }
  req.log.error({ err: error }, "Factory request failed");
  res.status(500).json({ error: "The factory request could not be completed. No partial workflow change was committed." });
};
router.use(errors);
function matches(order: Order, search: string) {
  const term = search.toLowerCase().trim();
  return [order.number, order.officialNumber, order.company, ...order.allocations.flatMap(a => [a.batchId, ...(a.serialNumbers ?? [])])].some(v => v?.toLowerCase().includes(term));
}
return router;
}
export default createFactoryRouter();
