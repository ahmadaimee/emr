import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { randomUUID } from 'node:crypto';
import authPlugin from './plugins/auth';
import problemPlugin from './plugins/problem';
import tenantPlugin from './plugins/tenant';
import { claimRoutes } from './routes/v1/claims';
import { eligibilityRoutes } from './routes/v1/eligibility';
import { remittanceRoutes } from './routes/v1/remittances';
import { taskRoutes } from './routes/v1/tasks';

/**
 * The public API. A separate service from the web app because it is a product surface
 * with its own auth model, versioning, rate limits and SLA — the web app is merely its
 * first consumer.
 */
export async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      // Never log PHI. Allowlist the request fields we keep; everything else is dropped.
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: redactUrl(req.url), ip: req.ip }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
      redact: { paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.ssn', '*.member_id'], censor: '[redacted]' },
    },
    genReqId: () => `req_${randomUUID().replace(/-/g, '').slice(0, 20)}`,
    trustProxy: true,
    bodyLimit: 8 * 1024 * 1024, // 835 files can be large
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'Grove API', version: '2026-09-01', description: 'Revenue cycle automation. All money is integer cents. All writes require an Idempotency-Key header. Errors are RFC 9457 problem+json.' },
      servers: [{ url: 'https://api.grove.health' }],
      components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', description: 'API key (grv_live_…) or session token' } } },
      security: [{ bearer: [] }],
      tags: [{ name: 'Eligibility' }, { name: 'Claims' }, { name: 'Remittances' }, { name: 'Work queues' }],
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });
  await app.register(cors, { origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','), credentials: true });
  await app.register(rateLimit, {
    max: (req) => (req.method === 'GET' ? 100 : 20),
    timeWindow: '1 second',
    keyGenerator: (req) => (req.headers.authorization ? `k:${req.headers.authorization.slice(-16)}` : req.ip),
    addHeadersOnExceeding: { 'x-ratelimit-limit': true, 'x-ratelimit-remaining': true, 'x-ratelimit-reset': true },
  });

  await app.register(problemPlugin);
  await app.register(authPlugin);
  await app.register(tenantPlugin);

  app.get('/health', { schema: { hide: true } }, async () => ({ ok: true, service: 'grove-api', version: '2026-09-01' }));
  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());

  app.addHook('onSend', async (_req, reply) => {
    reply.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Cache-Control', 'no-store');
    reply.header('Grove-Version', '2026-09-01');
  });

  await app.register(eligibilityRoutes);
  await app.register(claimRoutes);
  await app.register(remittanceRoutes);
  await app.register(taskRoutes);

  return app;
}

function redactUrl(url: string): string {
  // Query strings may carry member IDs or names in search endpoints.
  return url.split('?')[0] ?? url;
}

if (process.argv[1]?.endsWith('server.ts')) {
  buildServer()
    .then((app) => app.listen({ port: Number(process.env.API_PORT ?? 3001), host: '0.0.0.0' }))
    .then((addr) => console.log(`[api] listening on ${addr}`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
