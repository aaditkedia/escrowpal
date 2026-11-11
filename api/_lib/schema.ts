import { pgTable, text, integer, numeric, jsonb, timestamp, serial, customType } from 'drizzle-orm/pg-core';
const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });
export const deals = pgTable('deals', {
  id: text('id').primaryKey(), title: text('title').notNull(), description: text('description').notNull(),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(), currency: text('currency').notNull().default('USD'),
  status: text('status').notNull().default('awaiting_seller'), // awaiting_seller | active | completed | cancelled
  buyerName: text('buyer_name').notNull(), buyerEmail: text('buyer_email'), sellerName: text('seller_name').notNull(), sellerEmail: text('seller_email'),
  buyerToken: text('buyer_token').notNull(), sellerToken: text('seller_token').notNull(),
  buyerSignedAt: timestamp('buyer_signed_at'), sellerSignedAt: timestamp('seller_signed_at'),
  inspectionDays: integer('inspection_days').notNull().default(3), riskScore: integer('risk_score').notNull().default(0),
  risk: jsonb('risk').$type<string[]>().notNull().default([]), engine: text('engine').notNull().default('local'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const milestones = pgTable('milestones', {
  id: text('id').primaryKey(), dealId: text('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }), idx: integer('idx').notNull(),
  title: text('title').notNull(), amount: numeric('amount', { precision: 12, scale: 2 }).notNull(), criteria: jsonb('criteria').$type<string[]>().notNull(),
  dueDate: text('due_date'), status: text('status').notNull().default('pending'), // pending|funded|submitted|released|disputed|refunded|resolved
  authId: text('auth_id'), orderId: text('order_id'), captureId: text('capture_id'), releasedAmount: numeric('released_amount', { precision: 12, scale: 2 }),
  submittedAt: timestamp('submitted_at'), verdict: jsonb('verdict'),
});
export const evidence = pgTable('evidence', {
  id: text('id').primaryKey(), milestoneId: text('milestone_id').notNull().references(() => milestones.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), note: text('note').notNull(), fileName: text('file_name'), fileType: text('file_type'), fileSize: integer('file_size'),
  fileData: bytea('file_data'), createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const disputes = pgTable('disputes', {
  id: text('id').primaryKey(), milestoneId: text('milestone_id').notNull().references(() => milestones.id, { onDelete: 'cascade' }),
  openedBy: text('opened_by').notNull(), reason: text('reason').notNull(), sellerResponse: text('seller_response'), buyerResponse: text('buyer_response'),
  mediator: jsonb('mediator'), resolution: text('resolution'), buyerAccepts: integer('buyer_accepts'), sellerAccepts: integer('seller_accepts'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const events = pgTable('events', {
  id: serial('id').primaryKey(), dealId: text('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), kind: text('kind').notNull(), message: text('message').notNull(), createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const marketAnalyses = pgTable('market_analyses', {
  id: text('id').primaryKey(), accessToken: text('access_token').notNull(),
  input: jsonb('input').notNull(), result: jsonb('result').notNull(), digest: text('digest').notNull(),
  selectedId: text('selected_option_id'), status: text('status').notNull().default('ready'), dealId: text('deal_id').references(() => deals.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
