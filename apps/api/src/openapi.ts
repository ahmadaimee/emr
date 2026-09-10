/**
 * Emit the OpenAPI document as a build artifact. CI regenerates it and fails on drift,
 * so the docs and the SDK can never disagree with the running code.
 */
import { writeFileSync } from 'node:fs';
import { buildServer } from './server';

const app = await buildServer();
await app.ready();
writeFileSync(new URL('./openapi.json', import.meta.url), JSON.stringify(app.swagger(), null, 2) + '\n');
await app.close();
console.log('wrote openapi.json');
