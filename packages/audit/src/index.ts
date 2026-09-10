export { canonicalize, CHAIN_VERSION } from './canonical';
export { appendAuditEvent, computeHash, verifyChain } from './chain';
export type { AuditAction, AuditEventInput, ChainVerification } from './chain';
export { recordActivity } from './activity';
export type { ActivityInput, ActivityVerb } from './activity';
export { PhiAccessCollector } from './phi-access';
export type { FieldClass } from './phi-access';
