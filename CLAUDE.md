# PracticeOS — Autonomous Healthcare Practice Management Platform

## 0. Mission

Build a million-dollar-worthy, AI-native Practice Management / Practice Operating System for healthcare organizations.

The product must NOT feel like a traditional EHR/PMS with a chatbot attached.
It must behave like an autonomous operating layer that sits above existing EHRs, practice-management systems, clearinghouses, payer portals, communication systems, and internal workflows.

Core philosophy:

> AI = intelligence
> Rules Engine = policy
> Security Plane = control
> Database = source of truth
> Workflow Engine = execution
> Audit Layer = accountability

Primary product promise:

> Observe → Understand → Predict → Decide → Execute → Verify → Learn

Secondary positioning:

> Keep your existing EHR. Make your practice intelligent.

---

# 1. Product Vision

Create an AI-native healthcare Practice Operating System that unifies:

- Practice management
- Scheduling
- Patient CRM
- Eligibility
- Prior authorization
- Claims
- Payment posting
- AR
- Denial management
- Revenue intelligence
- Provider operations
- Credentialing
- Communications
- Reporting
- Workflow automation
- AI agents
- EHR/PMS interoperability

The system should let a user describe a desired business outcome rather than manually execute dozens of steps.

Example:

User:
"Find tomorrow's appointments at risk because of insurance or authorization issues and resolve everything you can."

System should:
1. Analyze upcoming appointments.
2. Check eligibility.
3. Detect payer/coverage problems.
4. Check authorization/referral requirements.
5. Prioritize risk.
6. Create tasks/workqueues.
7. Execute permitted actions autonomously.
8. Escalate exceptions to humans.
9. Produce an audit trail.
10. Summarize expected business impact.

---

# 2. Non-Negotiable Design Principles

## 2.1 AI is not the source of truth

The database and external authoritative systems remain the source of truth.
AI may reason over retrieved data but must not silently invent or mutate authoritative facts.

## 2.2 AI does not bypass authorization

No agent may access data or perform actions outside its identity, tenant, role, purpose, or permission scope.

## 2.3 Deterministic rules beat LLM reasoning when deterministic logic exists

Use code/rules for:
- permissions
- tenant isolation
- billing validations
- compliance policies
- required fields
- hard workflow constraints
- approval requirements

Use AI for:
- classification
- summarization
- prediction
- reasoning
- extraction
- natural-language interaction
- workflow planning

## 2.4 Human-in-the-loop is configurable

Autonomy must be controlled per action, organization, agent, and workflow.

Recommended levels:

- Level 0 — Observe only
- Level 1 — Recommend
- Level 2 — Draft
- Level 3 — Execute with approval
- Level 4 — Autonomous execution

Default sensitive actions to a lower autonomy level.

## 2.5 Minimum necessary PHI

Agents should retrieve only the minimum data needed for the task.
Never expose an entire patient record to an agent when a few fields are sufficient.

## 2.6 Every meaningful AI action must be explainable

Every AI decision/action should expose where appropriate:
- reason
- source records
- confidence
- model/agent used
- policy applied
- human approval
- action taken
- outcome

---

# 3. Core UX

## 3.1 AI Command Center

The home screen should be an executive/operations command center, not a navigation-heavy legacy PMS dashboard.

Example sections:

### Practice Health
- Revenue
- Collections
- AR
- Denial rate
- No-show rate
- Schedule utilization
- Authorization risk
- Revenue leakage

### AI Findings
Examples:
- "$21,400 potentially recoverable revenue detected."
- "16 claims have elevated denial risk."
- "7 appointments require authorization before tomorrow."
- "Provider utilization decreased 9% this week."

### Recommended Actions
Each finding should support:
- Review
- Approve
- Execute
- Ignore
- Assign
- View evidence

## 3.2 Natural language control

Allow users to ask questions such as:

- "Why did revenue drop this month?"
- "Show Medicare claims over $1,000 older than 30 days with denial risk above 60%."
- "Which providers are losing the most revenue?"
- "Resolve everything you can automatically and show me exceptions."

Natural-language requests must compile into safe, permission-aware queries and workflows.

---

# 4. AI Agent Architecture

Build an Agent Orchestrator with specialized healthcare agents.

## 4.1 Revenue Agent

Responsibilities:
- monitor revenue
- analyze collections
- detect leakage
- identify underpayments
- identify abnormal payer behavior
- prioritize financial opportunities
- create RCM workqueues

## 4.2 Eligibility Agent

Responsibilities:
- verify coverage
- detect inactive coverage
- identify benefits
- identify copay/deductible/coinsurance when available
- identify referral requirements
- identify authorization requirements
- update appointment risk

## 4.3 Scheduling Agent

Responsibilities:
- schedule appointments
- reschedule
- optimize slots
- manage waitlist
- reduce no-shows
- consider provider capacity
- consider appointment duration/type
- enforce business rules

## 4.4 Prior Authorization Agent

Responsibilities:
- detect authorization requirements
- identify payer rules
- gather required information
- extract relevant data
- prepare authorization requests
- track status
- monitor expiration
- escalate missing information

## 4.5 Claims Agent

Responsibilities:
- pre-submit validation
- missing data detection
- coding checks
- modifier checks
- diagnosis linkage checks
- authorization checks
- duplicate detection
- timely filing risk
- payer-specific validations
- submission orchestration

## 4.6 Denial Agent

Responsibilities:
- classify denials
- identify root cause
- predict preventable denials
- recommend correction
- prepare appeal package
- prioritize by recoverability and value

## 4.7 AR Agent

Responsibilities:
- analyze aging
- prioritize claims/accounts
- estimate recoverability
- suggest next action
- prepare follow-up workflows
- monitor deadlines

## 4.8 Patient Agent

Responsibilities:
- appointment reminders
- patient communication
- registration assistance
- insurance information requests
- scheduling assistance
- payment reminders
- FAQ handling

Patient-facing actions must be governed by approved scripts, policies, safety rules, and permissions.

## 4.9 Operations Agent

Responsibilities:
- monitor KPIs
- identify staffing/workflow bottlenecks
- detect operational anomalies
- create tasks
- recommend process changes

## 4.10 Credentialing Agent

Responsibilities:
- track provider credentials
- monitor expiration dates
- monitor payer enrollment
- monitor recredentialing
- create renewal workflows
- escalate missing documentation

## 4.11 Executive Intelligence Agent

Responsibilities:
- generate daily practice brief
- explain KPI movements
- identify major risks
- identify growth opportunities
- estimate expected cash
- summarize AI actions

---

# 5. Autonomous RCM

RCM must be a first-class product pillar.

## 5.1 Revenue leakage detection

Continuously detect:
- missed charges
- underpayments
- coding issues
- unpaid claims
- delayed claims
- duplicate write-offs
- authorization failures
- eligibility failures
- untimely filing risks
- missed follow-ups
- no-show revenue
- incomplete documentation risks

Produce an estimated dollar impact.

## 5.2 Denial prediction

Before claim submission, calculate:
- denial risk
- confidence
- primary risk factors
- recommended remediation

Example:

"Denial risk: 73%"
"Primary factor: authorization not found"
"Recommended action: obtain/attach authorization before submission"

Models must store evidence/features used for prediction in an auditable manner.

## 5.3 AR prioritization

Rank work by a combination of:
- financial value
- probability of recovery
- deadline
- payer behavior
- age
- operational cost

---

# 6. Payer Intelligence

Build a proprietary Payer Intelligence layer.

Track, where legally and operationally appropriate:
- reimbursement patterns
- denial patterns
- authorization behavior
- turnaround time
- underpayment patterns
- appeal success rate
- common denial reasons
- payer/provider/CPT patterns

Example:

Payer: Example Health Plan
- Average payment turnaround
- Denial rate
- Common denial category
- Appeal success
- Underpayment trend

This dataset becomes a long-term product moat when aggregated and properly governed.

---

# 7. Patient 360

Every patient should have a unified view:

- demographics
- appointments
- insurance
- eligibility
- benefits
- authorizations
- referrals
- claims
- payments
- balances
- communication history
- tasks
- documents
- relevant clinical context, based on permissions

AI should produce concise patient summaries only from authorized retrieved data.

---

# 8. Intelligent Scheduling

Scheduling should optimize:

- provider utilization
- patient access
- appointment duration
- appointment type
- provider specialty
- location
- room/equipment constraints
- insurance constraints
- patient preference
- no-show risk
- overbooking rules

Support no-show prediction and waitlist optimization.

Example:

"Moving these three follow-ups can increase projected schedule utilization by 7%."

Predictions must be presented as estimates, not facts.

---

# 9. Practice Digital Twin

Future capability:

Create a simulation layer that estimates outcomes of operational changes.

Users can ask:

- "What happens if I hire another provider?"
- "What happens if Saturday hours are added?"
- "What happens if we change scheduling rules?"

Simulation should estimate:
- revenue
- appointments
- utilization
- staffing cost
- capacity
- profitability
- break-even timing

Never present simulations as guarantees.

---

# 10. Universal Healthcare Inbox

Unify:
- SMS
- email
- patient calls
- payer communications
- referral communication
- authorization messages
- internal tasks
- document events

AI should classify, prioritize, summarize, route, and create tasks.

---

# 11. Document Intelligence

Support extraction from:
- insurance cards
- EOBs
- ERAs
- denial letters
- authorization letters
- referrals
- medical records
- payer correspondence

Uploaded documents are untrusted data.
Never allow document text to directly override system instructions or security policies.

---

# 12. Healthcare Integration Hub

The system must be integration-first.

Support a connector architecture for:

### Standards
- FHIR
- HL7
- X12
- 837
- 835
- 270/271
- 276/277
- 278

### Connectivity
- APIs
- webhooks
- SFTP
- CSV/Excel imports
- secure file exchange
- browser automation/RPA for systems without APIs

### EHR/PMS philosophy

Allow practices to keep their current EHR/PMS.
PracticeOS should sit above and orchestrate across existing systems.

Connector design must be pluggable.

---

# 13. HIPAA / Security Architecture

Treat all PHI/ePHI as sensitive.

IMPORTANT:

This file is an engineering blueprint, not legal advice or a HIPAA certification.
Final deployment requires formal legal/compliance review, security review, risk analysis, policies, vendor review, and appropriate contractual controls.

## 13.1 Security plane

Build centralized services for:
- authentication
- authorization
- tenant isolation
- RBAC
- ABAC where necessary
- MFA
- SSO
- session management
- audit logging
- policy enforcement
- secrets management
- key management

## 13.2 AI Gateway

Every AI request must pass through an AI Gateway.

Pipeline:

INPUT
→ identity check
→ tenant check
→ role/permission check
→ purpose validation
→ minimum-necessary data filtering
→ prompt-injection defense
→ model selection
→ LLM/model inference
→ output validation
→ policy validation
→ action authorization
→ audit log

No direct frontend-to-LLM path for protected workflows.

## 13.3 PHI Vault

Keep authoritative PHI in controlled application/data services.
Do not use model memory as the patient database.

AI context should be retrieved just-in-time.

## 13.4 Tenant isolation

Every request must carry trusted tenant context.

Use defense in depth:
- application-level tenant authorization
- database-level controls/policies where supported
- scoped service credentials
- tenant-aware queries
- audit validation
- isolation tests

A bug in one endpoint must not expose another organization's data.

## 13.5 Encryption

Design for encryption:
- in transit
- at rest
- backups
- secrets
- keys

Use managed key-management infrastructure where appropriate.

## 13.6 AI provider governance

For every external AI vendor, maintain a vendor registry covering:
- BAA availability/requirements
- allowed PHI use
- retention
- training/data-use terms
- security controls
- subprocessors
- breach notification obligations
- data residency
- deletion behavior

Do not send PHI to a vendor unless the deployment and contractual/compliance model has been reviewed and approved.

## 13.7 AI memory

Do not create an uncontrolled long-term AI memory of PHI.

Store patient facts in authoritative systems.
Retrieve approved context when needed.

## 13.8 Conversation data

AI conversations may themselves contain PHI.
Treat them as sensitive records.
Support:
- retention policies
- deletion policies
- access control
- auditability
- tenant configuration

---

# 14. AI Safety

## 14.1 Prompt injection defense

Treat all external content as untrusted data, including:
- uploaded documents
- payer messages
- emails
- web content
- imported notes
- patient messages

Never allow external text to override:
- system instructions
- security rules
- user permissions
- tool policies

## 14.2 Tool permissions

Every agent/tool should define:

- allowed read resources
- allowed write resources
- allowed actions
- approval requirement
- data sensitivity
- allowed tenant scope

Example:

Revenue Agent:
- Read: claims, payments, AR, payer data
- Write: workqueues/tasks
- Submit claim: approval required by default

## 14.3 Action risk levels

### Green
Autonomous by default when policy allows.
Examples:
- reminders
- internal task creation
- report generation
- low-risk routing

### Yellow
Prepare + approval.
Examples:
- claim correction
- appeal submission
- refunds
- sensitive patient communication

### Red
Recommendation only unless explicitly designed, validated, and approved under applicable governance.
Examples:
- clinical diagnosis
- treatment changes
- medication changes
- high-impact clinical decisions

---

# 15. Explainability and Provenance

AI outputs should include structured metadata:

- confidence
- source record IDs
- retrieval timestamp
- model/agent
- policy/rules used
- action status
- human approver

User-facing explanations should be understandable and concise.

Example:

"Claim denial risk: 81%"

Evidence:
- similar payer/CPT history
- authorization missing
- recent denial pattern

Action:
"Request authorization"

---

# 16. Audit Center

Build a complete audit interface.

Example event:

Timestamp: 09:13
Agent: Revenue Agent
Tenant: Practice A
Patient: masked in default UI
Claim: masked in default UI
Purpose: denial investigation
Data accessed: claim, ERA, payer response, AR history
Recommendation: corrected claim
Human approval: required/approved
Action: submitted
Result: accepted

Audit records must be tamper-resistant according to system security requirements.

---

# 17. Executive Intelligence

Generate a daily AI brief.

Example:

PRACTICE PERFORMANCE: 92/100

Revenue: +6%
AR: -$84K
High-risk claims: 12
Authorization expirations: 4
Utilization: -3%
Estimated recoverable revenue: $21,400
AI actions completed: 73
Exceptions requiring human attention: 9

Every metric must link back to source data.

---

# 18. Benchmarking

Support anonymized benchmarking where legally, contractually, and technically appropriate.

Examples:
- denial rate vs benchmark
- AR >90 days vs benchmark
- provider utilization vs benchmark
- no-show rate vs benchmark
- payment turnaround vs benchmark

Benchmark datasets require strong privacy, aggregation, governance and contractual review.

---

# 19. Credentialing

Track:
- provider licenses
- NPI
- CAQH-related data where applicable
- payer enrollment
- contracts
- malpractice coverage
- DEA/state credentials where applicable
- expiration
- recredentialing

Create proactive alerts and workflows.

---

# 20. Multi-Practice / MSO Architecture

Support one organization managing multiple practices/locations.

Hierarchy:

Organization
→ Practice
→ Location
→ Department
→ Provider
→ Team/User

Support:
- role-based access
- centralized billing
- centralized analytics
- location comparisons
- provider comparisons
- organization-level AI governance

---

# 21. Role Model

Initial roles:

- Super Admin
- Organization Admin
- Practice Admin
- Medical Director
- Provider
- Billing Manager
- Biller
- AR Specialist
- Scheduler
- Front Desk
- Credentialing Specialist
- Authorization Specialist
- Read Only Executive
- AI Agent Service Account

Do not assume a human role and an AI agent role are equivalent.
AI agents must have explicit machine identities and tool scopes.

---

# 22. Data Model — Initial Core Entities

At minimum design entities for:

- Organization
- Practice
- Location
- User
- Role
- Permission
- AI Agent
- Agent Tool
- Patient
- PatientIdentifier
- InsurancePlan
- Coverage
- Provider
- Appointment
- AppointmentType
- Schedule
- Authorization
- Referral
- Encounter
- Charge
- Claim
- ClaimLine
- ClaimStatus
- Remittance
- Payment
- ARAccount
- Denial
- WorkItem
- Task
- Communication
- Document
- AuditEvent
- AIInteraction
- AIAction
- AIApproval
- Integration
- Payer
- PayerRule
- Credential
- KPI
- Metric
- Benchmark

Use immutable identifiers and timestamps.

---

# 23. Workflow Engine

Build a first-class workflow engine instead of hardcoding every process.

Workflow structure:

Trigger
→ Conditions
→ Retrieve data
→ AI/rule evaluation
→ Action
→ Approval if required
→ Verification
→ Escalation
→ Audit

Example:

Trigger: Appointment created
Conditions: insurance is inactive
Action: patient notification
Action: staff task
Escalation: if not resolved within configured period

Workflows must be versioned.

---

# 24. Rules Engine

Create a deterministic rules framework supporting:

- payer rules
- appointment rules
- authorization rules
- routing rules
- approval rules
- patient communication rules
- organization-specific policies
- AI autonomy limits

Rules need:
- version
- effective date
- owner
- status
- test cases
- audit history

---

# 25. Model Router

Do not force every task through one model.

Support model routing by:
- sensitivity
- complexity
- latency
- cost
- availability
- accuracy requirements
- tenant policy

Examples:
- small/private model for classification
- specialist model for extraction/transcription
- strong reasoning model for complex analysis
- deterministic rules for hard constraints

---

# 26. RAG / Knowledge Architecture

Use retrieval rather than dumping entire datasets into prompts.

Retrieval sources may include:
- payer policies
- organization policies
- authorized patient records
- claims history
- operational data
- approved internal knowledge

Each retrieved item should maintain source identity and access constraints.

Do not allow retrieval to cross tenant boundaries.

---

# 27. Reporting and Analytics

Provide:
- KPI cards
- trend charts
- drill-down tables
- saved reports
- natural-language query
- scheduled reports
- export
- role-based dashboards

AI should explain changes, not merely visualize them.

Example:

"Collections decreased 5%. 62% of the decline is explained by a rise in payer X denials."

Every explanation must be evidence-backed.

---

# 28. API Strategy

Build an API-first architecture.

Required categories:

- Auth API
- Patient API
- Scheduling API
- Eligibility API
- Authorization API
- Claims API
- AR API
- Communication API
- Document API
- Workflow API
- Agent API
- Audit API
- Reporting API
- Integration API

Use versioned APIs.

Never expose internal service credentials to the browser.

---

# 29. Event-Driven Architecture

Prefer event-driven workflows where useful.

Example events:

- patient.created
- appointment.created
- appointment.cancelled
- eligibility.failed
- authorization.expiring
- claim.created
- claim.denied
- payment.posted
- ar.threshold_reached
- credential.expiring
- ai.action.completed
- ai.action.failed
- approval.required

Use idempotent consumers.

Every autonomous action must be safe against duplicate execution.

---

# 30. Observability

Monitor:
- application health
- workflow failures
- agent failures
- model latency
- model cost
- retrieval errors
- connector health
- action success rate
- AI hallucination/validation failures
- permission denials
- security events

Create separate business and technical observability dashboards.

---

# 31. AI Evaluation Framework

Never ship an AI workflow without evaluation.

For each agent maintain:
- golden test set
- expected outputs
- forbidden behaviors
- precision/recall where appropriate
- tool-call accuracy
- authorization tests
- prompt-injection tests
- tenant-isolation tests
- regression tests
- latency/cost thresholds

Agent changes should trigger regression evaluation.

---

# 32. MVP Scope

Do not attempt to build every feature at once.

Phase 1 should deliver a commercially demonstrable core.

## MVP Pillar 1 — AI Command Center

Build:
- KPI dashboard
- AI findings
- natural-language assistant
- evidence links
- task/workqueue creation

## MVP Pillar 2 — Autonomous RCM

Build:
- claims ingestion
- AR dashboard
- denial classification
- denial risk prototype
- revenue leakage detection
- prioritized workqueue

## MVP Pillar 3 — Eligibility / Authorization

Build:
- eligibility workflow
- appointment risk
- authorization tracking
- expiration alerts

## MVP Pillar 4 — Scheduling

Build:
- provider schedules
- appointment types
- waitlist
- reminders
- no-show risk prototype

## MVP Pillar 5 — Integration Hub

Start with:
- CSV/Excel import
- REST API connector
- FHIR-ready architecture
- SFTP
- one EHR/PMS integration
- one clearinghouse integration

Add RPA/browser automation adapter for legacy systems where APIs are unavailable.

## MVP Pillar 6 — Security / Governance

Must include:
- tenant isolation
- RBAC
- MFA-ready architecture
- audit logging
- AI gateway
- action approvals
- encrypted secrets
- retention controls
- secure configuration

---

# 33. Suggested Technology Direction

Technology choices are implementation decisions, not fixed requirements. Prefer maintainable, scalable, healthcare-friendly technologies.

Possible baseline:

Frontend:
- Next.js / React
- TypeScript

Backend:
- Python + FastAPI OR TypeScript/NestJS
- modular services

Database:
- PostgreSQL
- row-level tenant controls where appropriate

Cache/queues:
- Redis

Async/event processing:
- Celery/RQ/Temporal/Kafka depending on scale

Object storage:
- S3-compatible secure object storage

Search/vector:
- PostgreSQL + pgvector initially

Auth:
- OAuth2/OIDC compatible identity provider

Secrets:
- cloud secret manager

KMS:
- managed key management

AI:
- model-provider abstraction
- model router
- RAG service
- AI gateway

Observability:
- OpenTelemetry-compatible instrumentation

Deployment:
- containerized
- CI/CD
- infrastructure as code

Choose simplicity for MVP and avoid premature microservice fragmentation.

---

# 34. Product UI Principles

The UI should feel:

- modern
- premium
- calm
- professional
- data-dense but readable
- enterprise-grade
- AI-native

Avoid:
- dated hospital software aesthetic
- excessive nested menus
- unnecessary popups
- huge walls of text
- confusing AI chat as the only interface

Prefer:
- command center
- cards
- workqueues
- prioritized actions
- progressive disclosure
- evidence drawers
- explainability panels
- action approval dialogs
- keyboard shortcuts

Dark mode should be supported.

---

# 35. UX Example — Autonomous Morning Brief

At the beginning of the day:

"Good morning. PracticeOS found 47 items requiring attention."

Then:

1. $21,400 estimated recoverable revenue
2. 12 high-risk claims
3. 7 appointments with insurance/authorization risk
4. 4 credentials expiring soon
5. 3 providers below target utilization
6. 9 patient messages needing escalation

Button:

"Resolve everything I am authorized to resolve"

System executes approved low-risk workflows and presents an exception report.

---

# 36. Example — Natural Language RCM Workflow

User:

"Find claims older than 30 days where recovery probability is above 70%, prioritize them by expected recovery, and prepare the next action for each."

System:

1. Parse intent.
2. Check user permission.
3. Query authorized claims.
4. Calculate/retrieve recovery probability.
5. Rank by expected recovery.
6. Create recommended actions.
7. Generate evidence.
8. Offer execution according to autonomy policy.

Do not let natural-language requests bypass authorization.

---

# 37. Example — AI Action Contract

Every agent action should internally follow a structured contract similar to:

{
  "tenant_id": "...",
  "agent_id": "...",
  "user_id": "...",
  "purpose": "denial_investigation",
  "resource_type": "claim",
  "resource_id": "...",
  "action": "prepare_corrected_claim",
  "risk_level": "yellow",
  "autonomy_level_required": 3,
  "evidence": [],
  "confidence": 0.91,
  "requires_approval": true,
  "status": "pending"
}

Never execute an action solely because the LLM returned a textual instruction.
The policy/action engine must validate the action.

---

# 38. Marketplace / Ecosystem — Future

Later provide a PracticeOS marketplace for:
- specialty agents
- payer connectors
- reporting packs
- workflow packs
- AI skills
- communication integrations
- RCM automations

Third-party components must operate within the same security, permission and audit model.

---

# 39. Business Model Direction

Potential SaaS tiers:

Starter — approximately $499/month
Professional — approximately $1,499/month
Growth — approximately $3,000–$5,000/month
Enterprise — approximately $10,000+/month

Potential value-based/RCM pricing can be considered carefully.

Pricing is a business experiment, not a fixed implementation requirement.

The goal is recurring revenue through measurable ROI.

Primary sales narrative:

- reduce administrative labor
- reduce avoidable denials
- improve collections
- reduce leakage
- improve schedule utilization
- improve patient responsiveness
- provide executive visibility

---

# 40. Product Moat

The long-term moat should be created from the combination of:

- healthcare workflow data
- payer intelligence
- proprietary operational patterns
- AI agents
- workflow automation
- integration ecosystem
- outcome data
- domain-specific evaluations

Do not build a moat by secretly retaining customer PHI for generalized model training.
Build the moat through product intelligence, system design, workflows, integrations and properly governed aggregate insights.

---

# 41. Engineering Rules for Claude Code

Claude Code must follow these rules while implementing this repository.

## 41.1 Before coding

1. Inspect existing repository structure.
2. Identify framework and package manager.
3. Check environment/configuration.
4. Never overwrite working functionality without understanding it.
5. Prefer incremental changes.

## 41.2 Before adding a feature

1. Define data model.
2. Define permission boundary.
3. Define API contract.
4. Define audit implications.
5. Define failure states.
6. Define tests.

## 41.3 For AI features

Every AI feature must document:
- purpose
- inputs
- allowed data
- model
- prompt/context strategy
- tools
- output schema
- guardrails
- permissions
- human approval requirements
- audit fields
- evaluation tests

## 41.4 Structured outputs

Prefer JSON/schema-constrained model output for machine actions.
Do not execute arbitrary natural-language model output.

## 41.5 External side effects

All side effects must pass through an action/service layer with:
- permission checking
- policy checking
- idempotency
- audit logging
- error handling

## 41.6 Secrets

Never hardcode:
- API keys
- credentials
- tokens
- database passwords
- PHI

Use environment variables or a proper secrets manager.

## 41.7 Logging

Never write unnecessary PHI to application logs.
Use masked identifiers and structured security-aware logging.

## 41.8 Tests

Every important feature requires tests for:
- happy path
- permission denial
- cross-tenant access attempt
- invalid input
- tool failure
- duplicate execution
- AI malformed output
- prompt injection
- audit event generation

---

# 42. Repository Structure Direction

A sensible initial structure:

apps/
  web/
  api/

packages/
  ui/
  auth/
  database/
  ai-gateway/
  agents/
  workflows/
  rules/
  integrations/
  audit/
  analytics/
  shared/

services/
  worker/
  scheduler/

infra/
  migrations/
  deployment/
  observability/

No need to force this exact structure if the existing repository has a better architecture.

---

# 43. Definition of Done

A feature is not complete until:

- UI works
- API works
- persistence works
- permissions are enforced
- tenant isolation is tested
- audit events exist where needed
- errors are handled
- loading/empty states exist
- tests pass
- AI outputs are schema-validated where applicable
- external actions are policy-gated
- documentation is updated

---

# 44. First Build Order

When starting from an empty repository, implement in this order:

1. Application shell + authentication
2. Multi-tenant organization/practice model
3. Core RBAC/permissions
4. PostgreSQL schema + migrations
5. Audit subsystem
6. AI Gateway abstraction
7. Model-provider abstraction
8. AI Command Center
9. Patient / appointment / claim / AR core entities
10. RCM workqueue
11. Eligibility/authorization workflow engine
12. Integration framework
13. Autonomous agent framework
14. Revenue + Denial agents
15. Scheduling + Eligibility agents
16. Approval center
17. Executive intelligence
18. Evaluation framework
19. Security hardening
20. Deployment/observability

Do not jump directly to autonomous execution before permissions, auditability and action controls exist.

---

# 45. First Demo Scenario

The first investor/client demo should show one end-to-end autonomous workflow.

Scenario:

1. Import today's appointments and claims.
2. System analyzes them.
3. AI identifies eligibility/authorization risks.
4. AI identifies high-value denial risks.
5. Dashboard shows estimated financial impact.
6. User clicks "Resolve authorized issues".
7. System executes safe actions.
8. Yellow actions are presented for approval.
9. Dashboard shows actions completed.
10. Audit Center shows complete activity history.

This is more important for the MVP than building dozens of disconnected CRUD screens.

---

# 46. Long-Term Product North Star

PracticeOS should eventually be able to receive a high-level goal such as:

> "Keep my practice above 90% schedule utilization, reduce avoidable denials below 5%, minimize unresolved authorization cases, and protect next week's expected cash."

The system then continuously:

- observes the practice
- identifies problems
- prioritizes actions
- executes authorized workflows
- requests approvals when required
- measures outcomes
- learns from verified outcomes
- reports what changed

That is the core definition of an autonomous healthcare Practice Operating System.

---

# 47. Critical Safety Boundary

The system must never pretend that AI output is inherently correct.

For healthcare, financial, privacy, compliance, or patient-impacting decisions:

- ground outputs in source data
- enforce permissions outside the model
- use deterministic controls where possible
- require human approval for appropriate high-risk actions
- maintain auditable records
- test continuously
- clearly distinguish predictions/recommendations from confirmed facts

Do not claim HIPAA certification, legal compliance, clinical safety, or regulatory approval without verified external assessment and appropriate professional review.

---

# 48. Final Product Definition

Build:

# PracticeOS
### The Autonomous Operating System for Healthcare Practices

Not:
"A better PMS."

Instead:

> "The intelligent execution layer that makes an existing healthcare practice run itself — safely, measurably, and with humans in control."

Every implementation decision should move the product toward this north star.
