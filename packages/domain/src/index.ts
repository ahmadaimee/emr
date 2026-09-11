export { DomainError, NotFoundError, todayIso } from './context';
export type { CommandContext } from './context';
export { emit } from './outbox';
export type { DomainEventType } from './outbox';

export { postLedger } from './ledger/post';
export type { LedgerPost } from './ledger/post';

export { createClaimCommand, addDays } from './claims/create';
export { scrubClaimCommand, loadReferenceData, loadTenantRules } from './claims/scrub';
export type { ScrubOutcome } from './claims/scrub';
export { submitClaimCommand } from './claims/submit';
export type { SubmitClaimResult, SubmitClaimOptions } from './claims/submit';
export { transitionClaim } from './claims/lifecycle';
export type { ClaimStatus } from './claims/lifecycle';
export { createCustomStatusCommand, retireCustomStatusCommand, setClaimCustomStatusCommand } from './claims/custom-status';
export type { CustomStatusInput } from './claims/custom-status';

export { requestAuthorizationCommand, recordAuthorizationDecisionCommand, linkAuthorizationToClaimCommand } from './authorizations/request';
export type { RequestAuthorizationInput, RequestAuthorizationResult, RecordAuthorizationDecisionInput } from './authorizations/request';

export { generateStatementRunCommand, sendStatementsCommand } from './statements/generate-run';
export type { GenerateStatementRunInput, GenerateStatementRunResult } from './statements/generate-run';
export { loadClaimAssembly, assembleProfessionalClaim, assembleClaimFacts, yearsBetween } from './claims/assembly';
export type { ClaimAssembly } from './claims/assembly';

export { postRemittanceCommand } from './remittance/post';
export type { PostRemittanceResult } from './remittance/post';
export { classifyAdjustment, isAutoPostable } from './denials/classify';
export type { Classification, DenialCategory, SuggestedAction } from './denials/classify';

export { generateSecondaryClaimCommand } from './cob/generate-secondary';
export type { GenerateSecondaryInput, GenerateSecondaryResult } from './cob/generate-secondary';

export { runEligibilityCheckCommand } from './eligibility/run-check';
export type { RunEligibilityInput, RunEligibilityResult, EligibilityTrigger } from './eligibility/run-check';
export { createEligibilityBatchCommand, recordBatchOutcome } from './eligibility/batch';
export type { BatchSource, CreateBatchInput, CreateBatchResult } from './eligibility/batch';
export { diffBenefits } from './eligibility/diff';
export type { BenefitChange, Materiality } from './eligibility/diff';

export { createTask } from './tasks/create';
export type { CreateTaskInput } from './tasks/create';
