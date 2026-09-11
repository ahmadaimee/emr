import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { resolveApiKey, resolveSession, type Actor } from '@grove/auth';
import type { TenantContext } from '@grove/db';
import { problem } from './problem';

declare module 'fastify' {
  interface FastifyRequest {
    tenant: TenantContext;
    actor: Actor;
    authKind: 'api_key' | 'session';
  }
}

/**
 * Bearer auth. API keys for machines, session tokens for the web app's own calls.
 * Unauthenticated requests get an identical 401 regardless of why.
 */
async function authPlugin(app: FastifyInstance) {
  app.decorateRequest('tenant', null, []);
  app.decorateRequest('actor', null, []);
  app.decorateRequest('authKind', null, []);

  app.addHook('onRequest', async (req, reply) => {
    if (isPublic(req)) return;
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return problem(reply, 401, 'unauthenticated', 'A bearer token is required');

    const requestId = req.id;
    const resolved = token.startsWith('grv_')
      ? await resolveApiKey(token, requestId, req.ip).then((r) => (r ? { ...r, kind: 'api_key' as const } : null))
      : await resolveSession(token, requestId).then((r) => (r ? { ...r, kind: 'session' as const } : null));
    if (!resolved) return problem(reply, 401, 'unauthenticated', 'Invalid or expired credentials');
    if (resolved.kind === 'session' && !resolved.mfaSatisfied) return problem(reply, 403, 'mfa_required', 'Complete multi-factor authentication');

    req.tenant = resolved.tenant;
    req.actor = resolved.actor;
    req.authKind = resolved.kind;
  });
}

function isPublic(req: FastifyRequest): boolean {
  // The Stedi webhook carries its own shared-secret check (see routes/v1/webhooks.ts)
  // instead of a Grove bearer token — the clearinghouse cannot hold one of ours.
  return req.url === '/health' || req.url.startsWith('/docs') || req.url === '/openapi.json' || req.url === '/v1/webhooks/stedi';
}

export default fp(authPlugin, { name: 'grove-auth' });
