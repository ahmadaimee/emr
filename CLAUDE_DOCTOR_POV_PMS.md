# CLAUDE — Doctor POV Practice Management System Specification

## Purpose

This document defines the Practice Management System (PMS) from the **doctor/provider point of view**.
It is a companion specification to the master `CLAUDE.md` for an AI-native, autonomous healthcare Practice Operating System.

The goal is not to build another billing-heavy PMS. The goal is to create a system that makes a doctor feel:

> **“I open this system and immediately know what matters for my patients, my schedule, my team, and my practice.”**

The doctor should spend less time navigating software and more time treating patients.

This document separates:
- **CURRENTLY ESSENTIAL** — required for a credible modern PMS MVP/product-market fit.
- **NEXT-GEN** — high-value features that differentiate the product.
- **FUTURISTIC / AUTONOMOUS** — features to build after the core workflow is stable.

---

# 1. Doctor POV: What the Product Must Solve

A physician normally cares about five things before anything else:

1. **Who am I seeing today?**
2. **What do I need to know before each patient enters?**
3. **What do I need to document and sign?**
4. **What requires my attention after the visit?**
5. **Is my practice running efficiently and getting paid correctly?**

The product should answer these without forcing the doctor to open multiple modules.

## Doctor Home Screen — “My Day”

The first screen should contain:

- Today's appointments
- Patients currently waiting
- Appointment status
- Visit type
- New vs established patient
- Telehealth vs in-person
- High-priority/risk flags
- Missing pre-visit information
- Pending results requiring review
- Unsigned notes
- Orders/referrals awaiting action
- Messages needing physician response
- Prior authorizations requiring physician input
- Coding/documentation issues needing provider review
- End-of-day completion status

The doctor should be able to reach any important action in 1–2 clicks.

---

# 2. CURRENTLY ESSENTIAL — Doctor Workflow

These capabilities should be considered core requirements for a modern US healthcare PMS/EHR-adjacent platform.

## 2.1 Schedule / Calendar

Must support:

- Daily / weekly / monthly calendar
- Provider-specific schedules
- Location-specific schedules
- Appointment types
- Visit duration
- Same-day appointments
- Cancellation
- Rescheduling
- No-show tracking
- Waitlist
- Recurring appointments
- Telehealth appointments
- Time-zone awareness for telehealth
- Appointment notes
- Room/resource assignment
- Provider availability
- Staff availability
- Schedule blocking
- Search patient from schedule
- Quick patient chart access
- One-click check-in / rooming status

### Doctor requirement
The calendar should answer:

> “What is my day going to look like?”

without requiring the physician to inspect multiple reports.

---

# 3. Pre-Visit Intelligence

This is one of the highest-value doctor-facing features.

Before each appointment, the system should generate a **Pre-Visit Brief**.

Example:

```text
PATIENT: Jane Doe
VISIT: Follow-up — Diabetes

Last visit: 04/14/2026

Key changes:
• HbA1c increased from 7.2 → 8.1
• Weight +5 lb
• Medication list changed
• Missed recommended lab

Open items:
• A1c follow-up
• Medication reconciliation
• Eye exam overdue

Administrative:
• Insurance verified
• Authorization valid
• Outstanding balance: $42

AI note:
“Review the elevated A1c and confirm whether the medication plan was followed.”
```

The AI must clearly distinguish:
- facts from source records
- inferred/predicted information
- recommendations

Never present an AI inference as a confirmed clinical fact.

---

# 4. Patient Chart — Doctor-Centered View

The chart should not look like a billing database.

The doctor needs a clinically useful longitudinal view.

## Patient header

Show:
- Name
- Age
- Preferred name
- DOB
- Pronouns where captured/appropriate
- Allergies
- Major alerts
- Contact information
- Insurance status
- Primary care provider
- Care team
- Preferred pharmacy

## Clinical timeline

Unified timeline of:
- Encounters
- Diagnoses/problems
- Medications
- Allergies
- Labs
- Imaging
- Procedures
- Referrals
- Hospitalizations
- ED events where available
- Documents
- Patient messages
- Care plans
- Relevant external records

The timeline should be filterable and summarized by AI.

---

# 5. Problem List

Must support:

- Active problems
- Resolved problems
- Historical conditions
- Onset date
- Status
- Notes
- ICD-10 mapping where appropriate
- Problem hierarchy / grouping
- Care-plan linkage

Doctor actions:
- Add
- Edit
- Resolve
- Reopen
- Mark as historical

AI may suggest updates, but clinical problem-list changes must follow configured clinical permissions and review policies.

---

# 6. Medication Management

Currently essential for clinical usability.

Support:
- Medication list
- Dose
- Route
- Frequency
- Start date
- Stop date
- Status
- Reconciliation
- Medication history
- Allergies/intolerances
- Pharmacy
- Refill requests
- Medication instructions

## Medication reconciliation workflow

Before a visit:

> “3 medications may need reconciliation.”

The doctor should be able to review changes quickly.

AI should assist with discrepancy detection but must not silently prescribe, discontinue, or alter medication.

---

# 7. Allergies and Safety Alerts

Highly visible and never buried.

Support:
- Drug allergies
- Food allergies
- Environmental allergies
- Reaction
- Severity
- Status
- Source
- Verification date

Warnings should be meaningful rather than overwhelming.

Avoid alert fatigue through configurable severity, deduplication, and clinically appropriate suppression rules.

---

# 8. Vitals

Support:
- Height
- Weight
- BMI
- Blood pressure
- Pulse
- Respiratory rate
- Temperature
- SpO2
- Pain score
- Specialty-specific vitals

Display trends rather than isolated values.

Example:

> BP trend: 142/88 → 138/86 → 151/92

AI may highlight trends but should not convert a trend into a diagnosis automatically.

---

# 9. Clinical Documentation

The documentation experience must be fast.

Support:
- Templates
- Specialty templates
- Smart phrases
- Macros
- Structured fields
- Free text
- Voice input
- Dictation
- Note sections
- Draft / signed / amended status
- Co-signing
- Copy-forward with safeguards

## AI Documentation Copilot

Potential capabilities:

- Ambient transcription
- Encounter summarization
- SOAP draft
- HPI draft
- Assessment/plan draft
- Patient instructions
- Documentation completeness checks
- Coding suggestions
- Missing-information alerts

The doctor must review and approve generated documentation before finalization.

The system must maintain clear provenance for generated text.

---

# 10. Orders

Currently essential where the product scope includes EHR-adjacent clinical workflows.

Support configurable order workflows for:

- Labs
- Imaging
- Procedures
- Referrals
- Medications where legally/technically supported
- Other specialty-specific orders

Order states:

```text
Draft → Signed → Sent → Acknowledged → Completed → Resulted → Reviewed
```

Every transition must be auditable.

---

# 11. Results Inbox

One of the most important doctor workflows.

The system should provide:

### Results requiring physician attention

- New lab results
- Imaging results
- Pathology
- External results
- Abnormal results
- Critical results

Each result should provide:
- Result
- Reference range where applicable
- Trend
- Previous comparison
- Source
- Date
- Related order
- Patient context
- Review status

Doctor actions:
- Review
- Add note
- Communicate to patient
- Create task
- Refer
- Order follow-up
- Mark complete

Critical result escalation must not depend solely on an LLM.

---

# 12. Inbox / Task Center

Doctor inbox should unify:

- Patient messages
- Staff questions
- Results
- Refill requests
- Referral requests
- Prior authorization requests
- Documents
- Forms requiring signature
- Clinical follow-ups
- Administrative requests

Use priority categories:

**Critical / Today / This Week / Later**

AI can prioritize, but the original source and reason must remain visible.

---

# 13. Patient Communication

Currently essential:

- Secure patient messaging
- SMS where permitted
- Email where appropriate
- Appointment reminders
- Results notification workflows
- Follow-up messages
- Educational materials
- Patient instructions

The platform should support communication templates and provider-approved automation.

AI should draft messages; high-impact clinical communications should remain within configured human-approval boundaries.

---

# 14. Patient Portal

A modern PMS should treat the patient portal as a core workflow, not an optional add-on.

Patient capabilities should include, as applicable:

- View appointments
- Request/schedule appointments
- View selected records
- Secure messages
- Complete forms
- Update demographics
- Insurance information
- View medications
- View results
- Access care plans
- View billing information
- Make payments
- Download documents
- Request records

HIPAA's Privacy Rule generally provides individuals a right to access PHI in designated record sets, which includes broad categories such as medical, billing, payment and claims records. Product workflows should be designed to support appropriate access processes rather than treating the patient portal as merely a messaging tool. citeturn792763search4turn792763search7

---

# 15. Check-In / Rooming

The doctor should see rooming status immediately:

```text
Checked in
   ↓
Registration complete
   ↓
Forms complete
   ↓
Vitals complete
   ↓
Medication reconciliation complete
   ↓
Ready for provider
```

Missing items should be visible before the doctor starts the encounter.

---

# 16. Telehealth

Currently important for modern practices.

Support:
- Secure video workflow
- Appointment link
- Waiting room
- Patient identity verification workflow
- Consent workflow
- Documentation
- Connection status
- Provider controls
- Follow-up scheduling

The architecture must allow telehealth to be embedded into the normal patient/appointment workflow rather than operating as a disconnected video app.

---

# 17. Referrals

Doctor experience:

> “I referred the patient. What happened next?”

Support:

- Referral creation
- Destination/provider
- Reason
- Priority
- Supporting records
- Authorization linkage
- Status
- Appointment status where available
- Results/consult note
- Follow-up reminder

Referral tracking should close the loop.

---

# 18. Care Plans

Support structured care plans with:

- Goals
- Interventions
- Responsibilities
- Follow-up dates
- Patient preferences
- Care team
- Status
- Outcomes

CMS's current Advanced Primary Care Management framework emphasizes electronic patient-centered comprehensive care plans, access to updated patient information, coordination of referrals/transitions, secure/asynchronous communication, population management, and care-gap identification. Design the PMS so these workflows can be supported rather than bolted on later. citeturn792763search0

---

# 19. Population / Panel View

A doctor should be able to see their patient panel, not only one patient at a time.

Examples:

- Patients overdue for follow-up
- Preventive care gaps
- Uncontrolled chronic conditions
- Recent ED/hospital activity
- Patients with no upcoming appointment
- Patients overdue for labs
- Patients with expiring authorization
- Patients at high no-show risk

AI should summarize population patterns.

Example:

> “28 diabetic patients have no A1c recorded within the configured interval.”

This type of population/risk-management capability aligns with current CMS advanced primary-care workflows. citeturn792763search0

---

# 20. Clinical Decision Support — Carefully Controlled

A next-generation PMS may provide:

- Guideline reminders
- Care-gap alerts
- Drug interaction support through appropriate clinical data sources
- Risk calculators
- Screening reminders
- Trend alerts
- Suggested questions for visit preparation

But:

> **AI should support clinical judgment, not impersonate the clinician.**

Any predictive/algorithmic decision-support feature should maintain documentation about its intended use, inputs, performance/evaluation and limitations. ONC's HTI-1 final rule establishes transparency requirements for AI and other predictive algorithms used in certified health IT, including information intended to help users assess fairness, appropriateness, validity, effectiveness and safety. citeturn792763search2

---

# 21. Doctor-Friendly Coding Support

The doctor should not have to become a billing specialist.

Provide:

- Suggested ICD-10 codes
- Suggested CPT/HCPCS codes where appropriate
- Documentation completeness warnings
- Modifier suggestions
- Medical-necessity warnings where supported
- Missing documentation alerts
- Charge capture assistance

Example:

> “Based on today's documented encounter, these codes appear supportable. Review before signing.”

Never silently alter provider documentation.

---

# 22. Documentation-to-Revenue Feedback

This is an important differentiator.

Instead of telling doctors:

> “Your claim denied.”

System should explain at the workflow point:

> “This documentation is missing information commonly required for this billing scenario.”

Goal:

**Fix documentation upstream rather than correcting claims downstream.**

This can connect the doctor workflow directly to the autonomous RCM engine described in the master specification.

---

# 23. Appointment Intelligence

Every appointment can have a status/risk layer:

```text
Clinical readiness: Green
Insurance readiness: Green
Authorization: Green
Forms: Yellow
No-show risk: 71%
```

Doctor should not necessarily see every operational detail; the UI should surface only information that affects clinical workflow.

---

# 24. Doctor Dashboard / Practice Performance

Doctors generally need a different dashboard from billing managers.

Doctor-facing metrics:

- Patient volume
- Completed visits
- No-shows
- Cancellations
- Average visit duration
- Documentation completion
- Open results
- Open tasks
- Referral closure
- Patient satisfaction where captured
- Panel health
- Care gaps
- Revenue overview only at the level appropriate to role

The system should avoid turning physicians into spreadsheet managers.

---

# 25. AI “End of Day” Doctor Brief

At the end of the day:

```text
Your day is complete.

18 visits completed
2 visits rescheduled
3 results awaiting review
4 patient messages need attention
2 unsigned notes
1 referral has not been scheduled

Estimated documentation time remaining: 14 minutes
```

Then provide direct actions.

---

# 26. AI “Before First Patient” Brief

At the start of the day:

```text
Good morning.

You have 19 appointments today.

3 patients have important pre-visit items.
2 charts contain unresolved follow-ups.
1 patient has an expiring authorization.
4 patients have abnormal recent results requiring attention.

Your highest-priority chart is Jane Doe at 9:30 AM.
```

The physician should be able to open the relevant chart from each item.

---

# 27. NEXT-GEN — Autonomous Doctor Assistant

Build a physician-specific agent with strictly bounded permissions.

The agent can answer:

> “What changed since my patient's last visit?”

> “Which results from this week require my attention?”

> “Show me patients I haven't seen in 12 months who have an overdue follow-up.”

> “Prepare today's chart briefs.”

> “Draft patient follow-up messages for my review.”

> “Which referrals are still open?”

The agent should answer using source-grounded data with links to the source records.

---

# 28. NEXT-GEN — Longitudinal Patient Summary

One click:

> **“Summarize this patient's last 2 years.”**

Output structure:

- Major conditions
- Timeline
- Major events
- Medication changes
- Important labs/trends
- Imaging highlights
- Hospitalizations
- Referrals
- Current open issues
- Outstanding follow-ups
- Preventive gaps

Every important statement should be traceable to underlying records.

---

# 29. NEXT-GEN — Visit Preparation Agent

The system should prepare a visit workspace automatically:

1. Review history.
2. Identify changes.
3. Identify open care gaps.
4. Identify pending results.
5. Identify recent external encounters.
6. Identify medication changes.
7. Prepare questions/checklist.
8. Prepare a documentation skeleton.

The provider reviews rather than starting from a blank screen.

---

# 30. NEXT-GEN — Ambient Visit Copilot

Workflow:

```text
Patient + Provider conversation
             ↓
      Secure capture
             ↓
       Transcription
             ↓
    Clinical extraction
             ↓
     Draft documentation
             ↓
      Provider review
             ↓
           Sign
```

Never auto-sign notes.

Important requirements:
- clear recording/consent workflow where required
- secure processing
- provenance
- correction tools
- no fabricated clinical facts
- clinician approval

---

# 31. NEXT-GEN — “Explain the Patient”

Doctor can ask:

> “Why is this patient's A1c getting worse?”

The system should not jump to a diagnosis.
It should summarize potentially relevant evidence:

- lab trend
- medication changes
- documented adherence concerns
- missed follow-ups
- weight trend
- recent encounters
- other documented factors

Then explicitly state:

> “Possible contributing factors based on available records; clinical judgment required.”

---

# 32. NEXT-GEN — Smart Follow-Up

After a visit, the system should generate a follow-up plan:

- labs due
- imaging due
- referral follow-up
- return visit
- patient communication
- care-plan tasks

The doctor can approve all or selectively edit.

---

# 33. NEXT-GEN — Closed-Loop Referrals

Example:

Doctor orders cardiology referral.

System:

1. Creates referral.
2. Checks authorization requirement.
3. Sends required records.
4. Tracks referral status.
5. Detects no appointment after configured period.
6. Reminds staff/patient.
7. Receives consult documentation when available.
8. Adds relevant update to timeline.
9. Creates physician review task.

This should become a closed-loop workflow rather than a one-time referral order.

---

# 34. NEXT-GEN — Patient-Generated Data

Support, where clinically and technically appropriate:

- Home BP
- Glucose
- Weight
- Pulse oximetry
- Wearables
- Questionnaires
- Patient-reported outcomes

The system should distinguish:

**patient-generated data**

from

**clinician-verified clinical data**.

CMS's 2026 ACCESS model and interoperability initiatives demonstrate increasing emphasis on technology-supported chronic care, structured updates, patient-reported outcomes, medication data, and electronic care coordination. citeturn792763search6turn792763search3

---

# 35. NEXT-GEN — Shared Care Team Workspace

A doctor should be able to see which team member owns what.

Example:

```text
Authorization → Sarah
Referral → Ali
Lab follow-up → Nurse Team
Patient message → Front Desk
Billing issue → RCM
```

Doctor only gets escalations that genuinely require physician involvement.

---

# 36. CURRENTLY ESSENTIAL — Doctor Security & Privacy Experience

Security should be strong without destroying usability.

Required:

- MFA
- SSO where appropriate
- RBAC
- session controls
- device/session visibility
- audit history
- minimum necessary access
- patient-context verification
- secure messaging
- encryption

Doctor should be able to understand:

> “Who accessed this chart?”

> “What was changed?”

> “When?”

> “By whom?”

---

# 37. Doctor-Specific AI Permissions

Never give the physician-facing AI unlimited access just because the user is a doctor.

Permission should consider:

- organization
- practice
- location
- role
- specialty
- patient relationship
- workflow purpose
- data sensitivity
- action risk

Example:

```text
Doctor AI
├── Read assigned patient chart      ✓
├── Summarize record                 ✓
├── Draft note                       ✓
├── Draft patient message            ✓
├── Recommend follow-up              ✓
├── Sign clinical note               ✗
├── Change medication automatically  ✗
├── Order high-impact clinical action ✗
└── Access unrelated patient         ✗
```

Exact permissions must be configurable by organization and applicable law/policy.

---

# 38. Doctor UX Principle: “Zero Search”

The doctor should rarely need to search through menus.

When the doctor opens the application, the system should know:

- which patients are next
- which charts are important
- which results need attention
- which tasks are due
- what changed since yesterday

The interface should surface work instead of making clinicians hunt for it.

---

# 39. Doctor UX Principle: “One Patient, One Timeline”

Avoid forcing users to jump among:

- appointments
- messages
- labs
- referrals
- medications
- documents
- billing

Whenever possible, show relevant events in one chronological patient timeline.

---

# 40. Doctor UX Principle: “One Action, One Decision”

Important workflows should be simple.

Example:

Instead of:

```text
Open result
→ find patient
→ find order
→ open task
→ write message
→ find communication module
→ send
```

Provide:

> **Review Result → Notify Patient → Create Follow-up**

within one workspace.

---

# 41. CURRENTLY ESSENTIAL — Interoperability

The PMS should not be isolated.

Support a standards-based integration strategy around:

- FHIR
- HL7
- X12 where relevant
- APIs
- Direct Secure Messaging where appropriate
- secure file exchange
- existing EHR connectors

CMS's current interoperability framework emphasizes FHIR-based exchange, US Core, USCDI v3+, appointment/encounter notifications, patient access, provider access, and additional use cases such as real-time benefits and modern scheduling. citeturn792763search3

The platform should therefore be designed as an interoperability layer from day one.

---

# 42. CURRENTLY ESSENTIAL — Patient Access / Data Export

Provide practical mechanisms for:

- patient access
- record export
- document downloads
- structured-data export where applicable
- data portability
- access request workflows

The architecture should support both human-readable and structured representations where appropriate.

---

# 43. CURRENTLY ESSENTIAL — Prior Authorization Visibility

Doctor should see:

```text
Authorization:
MRI Brain
Status: Pending
Submitted: 09/09/2026
Payer: Example Health Plan
Missing: Clinical documentation
Action: Review
```

CMS's interoperability/prior authorization rule establishes an ongoing direction toward electronic prior authorization and FHIR-based payer APIs, with major API requirements extending through 2026–2027 depending on payer and requirement. citeturn792763search5

The product should make authorization status visible inside the normal appointment/clinical workflow.

---

# 44. Doctor Billing View — Keep It Simple

Doctors may need financial visibility but generally should not be forced into a billing workbench.

Provide:

- charges generated
- coding status
- claim status
- major denial reason where doctor action is needed
- documentation-related billing issues
- patient balance visibility where appropriate

Example:

> “2 encounters need documentation review before claims can be finalized.”

The RCM team receives the detailed operational workqueue.

---

# 45. CURRENTLY ESSENTIAL — Offline / Resilience Thinking

The product should gracefully handle:

- network interruption
- temporary external API failure
- clearinghouse outage
- EHR integration failure
- AI provider outage
- transcription provider outage

AI availability must not make core clinical workflows unusable.

Core record access, documentation and safety-critical workflows should have appropriate fallback behavior.

---

# 46. AI Failure Philosophy

When AI cannot confidently answer:

> **“I don't have enough verified information to answer this safely.”**

It should then show:
- source records
- missing information
- suggested next step

Never fabricate.

---

# 47. CURRENTLY ESSENTIAL — Auditability

For every important AI-assisted workflow, retain appropriate audit metadata:

- user
- provider
- patient/context
- agent
- action
- source data references
- policy decision
- approval
- timestamp
- outcome

The audit trail should be accessible to authorized administrators and compliance/security personnel.

---

# 48. FUTURISTIC — Autonomous “Practice Physician Assistant”

Eventually the doctor can set goals such as:

> “Make sure all my unresolved results older than 3 days are handled.”

The agent:

1. Finds outstanding results.
2. Classifies urgency.
3. Drafts communications.
4. Creates follow-ups.
5. Escalates clinically sensitive cases.
6. Reports completion.

The agent must not silently make clinical decisions beyond its configured scope.

---

# 49. FUTURISTIC — Predictive Patient Deterioration / Risk Signals

Potential future capability:

> “These 12 patients show a combination of documented risk signals that may justify clinician review.”

The system should:

- explain contributing data
- state confidence/limitations
- avoid unsupported diagnoses
- avoid discriminatory or opaque decisions
- support clinician review
- record model version and relevant evaluation information

This feature requires significantly stronger validation than simple scheduling or administrative prediction.

---

# 50. FUTURISTIC — Voice-First PMS

Doctor could say:

> “Open my next patient's chart.”

> “Summarize what changed since last visit.”

> “Draft the follow-up plan.”

> “Show me today's abnormal results.”

> “Prepare the notes for review.”

Voice should be an interface layer over the same permissioned command/action engine, not a shortcut around security controls.

---

# 51. FUTURISTIC — Ambient Practice Intelligence

The system observes operational patterns and tells the doctor:

> “Your 8 AM appointments have a 31% higher late-arrival rate than your daily average.”

> “Thursday afternoon has unused capacity.”

> “Patients with this appointment type frequently need an authorization check.”

These are operational insights, not clinical judgments.

---

# 52. FUTURISTIC — Personalized Physician AI

Each physician may configure:

- preferred note structure
- preferred communication style
- common templates
- specialty workflows
- preferred appointment lengths
- preferred follow-up patterns
- frequently used order sets

But personal preferences must never override organization-wide security, clinical policy, payer rules, or regulatory constraints.

---

# 53. CURRENTLY ESSENTIAL — Doctor Notification Strategy

Do not create notification overload.

Use a priority engine.

### Critical
Immediate action.

### High
Today.

### Routine
This week.

### Informational
No immediate action.

AI can consolidate repetitive notifications into one digest.

---

# 54. Doctor Experience Metrics

Product analytics should measure whether the PMS is actually reducing physician burden.

Track:

- clicks per completed encounter
- time to open chart
- time to complete documentation
- time spent on inbox
- result-review turnaround
- referral closure rate
- unsigned-note backlog
- patient-message response time
- percentage of AI drafts accepted/edited heavily
- workflow abandonment
- alert dismissal/override patterns

Do not optimize merely for screen time. The goal is less administrative friction.

---

# 55. MVP — What Must Exist First

For a doctor-centric initial product, prioritize:

## Tier 1 — Absolutely Essential

1. Physician dashboard / My Day
2. Calendar & scheduling
3. Patient search
4. Patient 360 chart
5. Clinical timeline
6. Problem list
7. Medication list
8. Allergies
9. Vitals
10. Documentation/notes
11. Tasks/inbox
12. Results review
13. Referrals
14. Patient messaging
15. Patient portal basics
16. Role-based access
17. Audit trail
18. Interoperability foundation

## Tier 2 — Strong Product-Market Fit Features

19. AI pre-visit summary
20. AI longitudinal summary
21. AI documentation copilot
22. Coding/documentation assistance
23. No-show intelligence
24. Authorization visibility
25. Closed-loop referral tracking
26. Care-gap dashboard
27. Practice/patient panel view
28. Telehealth workflow

## Tier 3 — Differentiation

29. Autonomous inbox triage
30. Visit preparation agent
31. AI result triage
32. Autonomous administrative task completion
33. Patient communication agent
34. Schedule optimization
35. RCM/documentation feedback loop
36. Natural-language analytics

## Tier 4 — Futuristic Moat

37. Physician voice agent
38. Autonomous care-workflow orchestration
39. Practice digital twin
40. Personalized physician AI
41. Advanced population intelligence
42. Multi-system healthcare agent network

---

# 56. Doctor POV — Ideal Daily Workflow

## Before clinic

```text
Open PracticeOS
      ↓
“My Day”
      ↓
AI pre-visit brief
      ↓
Review today's high-priority patients
      ↓
Clinic starts
```

## During visit

```text
Open chart
   ↓
Patient timeline
   ↓
Ambient/documentation assistance
   ↓
Review/edit
   ↓
Orders/referrals
   ↓
Follow-up plan
   ↓
Sign
```

## After visit

```text
AI checks unresolved items
      ↓
Results / referrals / messages / documentation
      ↓
Doctor reviews only exceptions
      ↓
Everything else routed to appropriate staff/agent
```

## End of day

```text
AI Daily Brief
      ↓
Open clinical items
Open administrative items
Unsigned documentation
Pending results
Referral gaps
Tomorrow's risks
```

---

# 57. What NOT to Build

Avoid turning the doctor experience into:

- a billing dashboard
- an AI chat window with no workflow actions
- dozens of popups
- excessive alerts
- generic templates for every specialty
- hidden automation with no audit trail
- black-box clinical predictions
- a system that requires replacing every existing EHR on day one

The doctor-facing product must feel **calm, fast, trustworthy and clinically useful**.

---

# 58. Strategic Positioning

Do not position the product simply as:

> “Practice Management Software.”

Better positioning:

# **AI-Native Practice Operating System for Physicians**

Core message:

> **Your practice software should prepare the work, not create more work.**

The doctor should open the system and immediately understand:

- what is happening today
- which patients need attention
- which clinical items are unresolved
- which administrative issues require physician input
- what the system already handled

---

# 59. Product North Star — Doctor POV

The ultimate product experience should become:

> **“I treat patients. The system handles the operational complexity around me.”**

PracticeOS should therefore optimize for:

**Less clicking**

**Less searching**

**Less documentation burden**

**Less inbox noise**

**Less follow-up leakage**

**More patient context**

**More closed-loop care**

**More time for patients**

The platform should continuously move toward:

> **Prepare → Assist → Execute → Verify → Escalate only when necessary.**

---

# 60. Official Reference Material Used for Current-State Requirements

The following official sources were consulted when defining the current-state priorities in this document:

- CMS — Advanced Primary Care Management Services: https://www.cms.gov/medicare/payment/fee-schedules/physician-fee-schedule/advanced-primary-care-management-services
- CMS — Interoperability Framework: https://www.cms.gov/initiatives/health-technology-ecosystem/overview/interoperability-framework
- CMS — Interoperability and Prior Authorization Final Rule: https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-prior-authorization-final-rule-cms-0057-f
- CMS — ACCESS for Primary Care Providers and Referring Clinicians: https://www.cms.gov/priorities/innovation/access-primary-care-providers-referring-clinicians
- ONC — HTI-1 Final Rule: https://healthit.gov/regulations/hti-rules/hti-1-final-rule/
- HHS — Individuals' Right under HIPAA to Access their Health Information: https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/access/index.html

These references describe regulatory/program directions and interoperability priorities; they are not legal advice. Product requirements must be validated against applicable federal/state laws, payer contracts, specialty requirements, and formal compliance/security review.
