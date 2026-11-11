import { z } from 'zod';
export const dollars = z.number().finite().min(0.01).max(1_000_000)
  .refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001, 'Use whole cents.');
export const percent = z.number().finite().int().min(0).max(100);
export const milestoneInput = z.object({
  title: z.string().trim().min(1).max(140), amount: dollars,
  criteria: z.array(z.string().trim().min(3).max(240)).min(1).max(6),
  dueInDays: z.number().int().min(1).max(365).optional(),
});
export const planInput = z.object({
  title: z.string().trim().min(1).max(120),
  milestones: z.array(milestoneInput).min(1).max(8),
}).passthrough();
export const verdictInput = z.object({
  met: z.array(z.string()).max(6), missing: z.array(z.string()).max(6),
  releasePct: percent, recommendation: z.enum(['release', 'partial', 'revise']),
  reasoning: z.string().trim().min(1).max(2000),
});
export const mediationInput = z.object({
  summary: z.string().min(1).max(1500), buyerPosition: z.string().max(2500), sellerPosition: z.string().max(2500),
  proposedReleasePct: percent, rationale: z.string().min(1).max(1500),
});
export function allocateCents(weights: number[], total: number): number[] {
  const cents = Math.round(dollars.parse(total) * 100);
  if (!weights.length || weights.some(w => !Number.isFinite(w) || w <= 0)) throw new Error('Invalid milestone allocation.');
  const sum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map(w => cents * w / sum);
  const amounts = exact.map(Math.floor); let remaining = cents - amounts.reduce((a, b) => a + b, 0);
  const priority = exact.map((n, i) => ({ i, remainder: n - amounts[i] })).sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (const p of priority) if (remaining-- > 0) amounts[p.i]++;
  if (amounts.some(n => n < 1)) throw new Error('Budget is too small for this many milestones.');
  return amounts.map(n => n / 100);
}
