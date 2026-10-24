import { pgTable, text, jsonb, timestamp, integer, index } from "drizzle-orm/pg-core";

// An aggregate boundary deliberately serializes this small demo's inventory and
// workflow mutations. PostgreSQL row locks span every read/validate/write cycle.
export const factoryWorkspaces = pgTable("factory_workspaces", {
  id: text("id").primaryKey(),
  state: jsonb("state").notNull(),
  revision: integer("revision").notNull().default(0),
});

export const factoryUsers = pgTable("factory_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  passwordHash: text("password_hash").notNull(),
});

export const factorySessions = pgTable("factory_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").references(() => factoryUsers.id),
  csrfToken: text("csrf_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [index("factory_sessions_expiry_idx").on(t.expiresAt)]);

export const factoryAuditEvents = pgTable("factory_audit_events", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  actor: text("actor").notNull(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull(),
  before: jsonb("before").notNull(),
  after: jsonb("after").notNull(),
}, (t) => [index("factory_audit_order_idx").on(t.orderId)]);
