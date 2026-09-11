import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { triggerSweep } from '../../jobs';

/** Queue names owned by apps/worker (see apps/worker/src/queues.ts) — kept as literals here since the two apps don't share a package. */
const ERA_FETCH_QUEUE = 'era.fetch';
const ACK_FETCH_SWEEP_QUEUE = 'claim.ack.fetch.sweep';

/**
 * Inbound webhook from the clearinghouse — what makes ERA and claim-status retrieval
 * "real-time" instead of poll-only. Stedi's webhook auth model is a credential
 * (API key / Basic Auth) YOU configure on the event destination in their dashboard,
 * not an HMAC body signature — so verification here is a constant-time compare
 * against a shared secret, not signature math. See [[Clearinghouse Setup]].
 *
 * Deliberately does no parsing of the event body: Stedi's event shape has moved
 * before and does not need to be trusted here. The handler's only job is "wake up the
 * poller now" — `fetchAcknowledgments` / `fetchRemittances` remain the single place
 * that actually reads clearinghouse data, so a changed payload shape breaks nothing
 * this route does.
 */
export async function webhookRoutes(app: FastifyInstance) {
  app.post('/v1/webhooks/stedi', { schema: { hide: true } }, async (req, reply) => {
    const secret = process.env.STEDI_WEBHOOK_SECRET;
    if (!secret) {
      req.log.error('STEDI_WEBHOOK_SECRET is not configured; rejecting inbound webhook');
      return reply.status(503).send({ ok: false });
    }

    const provided = extractSecret(req.headers.authorization);
    if (!provided || !secretsMatch(provided, secret)) {
      return reply.status(401).send({ ok: false });
    }

    try {
      await Promise.all([triggerSweep(ERA_FETCH_QUEUE), triggerSweep(ACK_FETCH_SWEEP_QUEUE)]);
    } catch (err) {
      req.log.error({ err }, 'failed to enqueue post-webhook sweep');
      // Still 200: the scheduled polling cron covers this event within its normal
      // cadence even if the accelerator failed to enqueue, so there's nothing Stedi
      // should retry over.
    }

    return reply.status(200).send({ ok: true });
  });
}

function extractSecret(header: string | undefined): string | null {
  if (!header) return null;
  return header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();
}

function secretsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
