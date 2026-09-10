import type { FastifyInstance, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { ForbiddenError } from '@grove/auth';
import { DomainError } from '@grove/domain';

/**
 * RFC 9457 problem+json for every error, with a stable `type` URI and the request ID
 * — the join key to the audit log when a customer emails support.
 */
export function problem(reply: FastifyReply, status: number, type: string, detail: string, extra: Record<string, unknown> = {}) {
  return reply
    .status(status)
    .type('application/problem+json')
    .send({ type: `https://docs.grove.health/errors/${type}`, title: titleFor(status), status, detail, instance: reply.request.url, request_id: reply.request.id, ...extra });
}

function titleFor(status: number): string {
  return { 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict', 422: 'Unprocessable Content', 429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway' }[status] ?? 'Error';
}

async function problemPlugin(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof DomainError) return problem(reply, err.status, err.code, err.message, err.detail ? { errors: err.detail } : {});
    if (err instanceof ForbiddenError) return problem(reply, 403, 'forbidden', `Missing permission ${err.permission}`, { reason: err.decision.reason });
    if ((err as { validation?: unknown }).validation) return problem(reply, 400, 'validation_error', err.message, { errors: (err as { validation: unknown }).validation });
    if ((err as { statusCode?: number }).statusCode === 429) return problem(reply, 429, 'rate_limited', 'Rate limit exceeded');
    req.log.error({ err, requestId: req.id }, 'unhandled error');
    return problem(reply, 500, 'internal_error', 'An unexpected error occurred');
  });
  app.setNotFoundHandler((_req, reply) => problem(reply, 404, 'not_found', 'No such route'));
}

export default fp(problemPlugin, { name: 'grove-problem' });
