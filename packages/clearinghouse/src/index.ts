export * from './adapter';
export { MockClearinghouse } from './mock';
export { StediClearinghouse } from './stedi';
export type { StediConfig } from './stedi';

import type { ClearinghouseAdapter, ConnectorName } from './adapter';
import { MockClearinghouse } from './mock';
import { StediClearinghouse } from './stedi';

/**
 * Resolve the configured connector. Claim.MD is registered here once its adapter
 * lands; the interface is identical, which is the point.
 */
export function createClearinghouse(env: Record<string, string | undefined> = process.env): ClearinghouseAdapter {
  const name = (env.CLEARINGHOUSE_PROVIDER ?? 'mock') as ConnectorName;
  switch (name) {
    case 'stedi': {
      if (!env.STEDI_API_KEY) throw new Error('STEDI_API_KEY is required when CLEARINGHOUSE_PROVIDER=stedi');
      return new StediClearinghouse({ apiKey: env.STEDI_API_KEY, baseUrl: env.STEDI_BASE_URL });
    }
    case 'mock':
      return new MockClearinghouse();
    default:
      throw new Error(`Unknown clearinghouse connector: ${name}`);
  }
}
