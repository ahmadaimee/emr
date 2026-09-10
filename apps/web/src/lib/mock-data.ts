/**
 * Grove Demo / Synthetic Data Provider
 *
 * Provides realistic, Synthea-derived synthetic healthcare and RCM data
 * for interactive exploration of all web operator UI routes when PostgreSQL
 * is not running locally.
 *
 * RULE 1: Zero real patient data. All names, MRNs, and values are purely synthetic.
 * RULE 5: Money is integer cents.
 */

export const MOCK_ORG_ID = '00000000-0000-4000-8000-000000000001';
export const MOCK_USER_ID = '00000000-0000-4000-8000-000000000002';

export const DEMO_SESSION = {
  tenant: {
    orgId: MOCK_ORG_ID,
    actorType: 'user' as const,
    actorId: MOCK_USER_ID,
    sessionId: 'demo_session_live',
    requestId: 'demo_req_live',
    accessContext: 'normal',
  },
  actor: {
    userId: MOCK_USER_ID,
    email: 'operator@grove.internal',
    roles: ['admin', 'biller', 'operator'],
    practiceIds: null,
    scopes: ['*'],
    elevation: null,
  },
  sessionId: 'demo_session_live',
  mfaSatisfied: true,
};

export function getMockDashboardData() {
  return {
    ar: {
      total: '4825000',
      over90: '820000',
      patient: '124000',
      open_claims: '142',
      denied_30: '12',
      adjudicated_30: '168',
      clean: '152',
      submitted_30: '175',
      charges_90: '15400000',
    },
    queues: [
      { key: 'denials', name: 'Denials requiring appeal', category: 'denial', open: '18', urgent: '4', amount: '845000' },
      { key: 'rejections', name: 'Clearinghouse 277CA rejections', category: 'rejection', open: '6', urgent: '2', amount: '230000' },
      { key: 'underpayments', name: 'Underpayments vs Fee Schedule', category: 'underpayment', open: '9', urgent: '1', amount: '410000' },
      { key: 'timely_filing', name: 'Timely filing within 14 days', category: 'timely_filing', open: '5', urgent: '5', amount: '320000' },
    ],
    activity: [
      { id: 'act-1', actorType: 'system', actorLabel: 'Grove Autopilot', summary: 're-submitted Claim #CLM-2026-0101 with corrected billing provider NPI', occurredAt: new Date(Date.now() - 1000 * 60 * 12), verb: 'claim.resubmitted', subjectType: 'claim', subjectId: 'clm-demo-1' },
      { id: 'act-2', actorType: 'user', actorLabel: 'Sarah Jenkins', summary: 'appealed denial PR-204 on Claim #CLM-2026-0098', occurredAt: new Date(Date.now() - 1000 * 60 * 35), verb: 'claim.appealed', subjectType: 'claim', subjectId: 'clm-demo-1' },
      { id: 'act-3', actorType: 'system', actorLabel: 'ERA Ingestion', summary: 'balanced 835 check #CHK-88912 ($14,250.00 from Aetna)', occurredAt: new Date(Date.now() - 1000 * 60 * 80), verb: 'remittance.balanced', subjectType: 'remittance', subjectId: 'remit-demo-1' },
      { id: 'act-4', actorType: 'user', actorLabel: 'Alex Morgan', summary: 'verified eligibility for Eleanor Miller (BCBS)', occurredAt: new Date(Date.now() - 1000 * 60 * 110), verb: 'patient.verified', subjectType: 'patient', subjectId: 'pat-1' },
      { id: 'act-5', actorType: 'system', actorLabel: 'Rules Engine', summary: 'identified NCCI PTP edit on encounter #ENC-4401', occurredAt: new Date(Date.now() - 1000 * 60 * 180), verb: 'claim.scrubbed', subjectType: 'claim', subjectId: 'clm-demo-1' },
    ],
    auto: {
      globalPaused: false,
      dryRun: false,
      pausedReason: null,
    },
    spend: {
      cents: 1420,
      calls: 38,
    },
    risk: {
      n: 5,
      cents: 320000,
    },
  };
}

export function getMockClaimsData() {
  const practices = [
    { id: 'prac-1', name: 'Orchard Family Practice' },
    { id: 'prac-2', name: 'Valley Internal Medicine' },
  ];

  const counts = [
    { status: 'needs_review', n: 8 },
    { status: 'ready', n: 14 },
    { status: 'submitted', n: 42 },
    { status: 'acknowledged', n: 26 },
    { status: 'rejected', n: 6 },
    { status: 'in_process', n: 15 },
    { status: 'denied', n: 18 },
    { status: 'partially_paid', n: 12 },
    { status: 'secondary_ready', n: 7 },
    { status: 'paid', n: 86 },
    { status: 'patient_responsibility', n: 11 },
  ];

  const rows = [
    {
      c: {
        id: 'clm-demo-1',
        claimNumber: 'CLM-2026-0101',
        payerClaimControlNumber: 'PAY-8849201',
        status: 'denied',
        totalChargeCents: 45000,
        paidCents: 0,
        balanceCents: 45000,
        patientResponsibilityCents: 0,
        serviceDateFrom: '2026-03-01',
        serviceDateTo: '2026-03-01',
        timelyFilingDeadline: '2026-06-01',
        createdAt: new Date(Date.now() - 86400000 * 2),
        patientId: 'pat-1',
        practiceId: 'prac-1',
        payerId: 'pyr-1',
        coverageRank: 'primary',
      },
      patientLast: 'Miller',
      patientFirst: 'Eleanor',
      payer: 'Blue Cross Blue Shield',
      practice: 'Orchard Family Practice',
      errors: 1,
    },
    {
      c: {
        id: 'clm-demo-2',
        claimNumber: 'CLM-2026-0102',
        payerClaimControlNumber: 'PAY-8849202',
        status: 'ready',
        totalChargeCents: 28500,
        paidCents: 0,
        balanceCents: 28500,
        patientResponsibilityCents: 0,
        serviceDateFrom: '2026-03-02',
        serviceDateTo: '2026-03-02',
        timelyFilingDeadline: '2026-06-02',
        createdAt: new Date(Date.now() - 86400000 * 1),
        patientId: 'pat-2',
        practiceId: 'prac-1',
        payerId: 'pyr-2',
        coverageRank: 'primary',
      },
      patientLast: 'Johnson',
      patientFirst: 'Robert',
      payer: 'Aetna Health',
      practice: 'Orchard Family Practice',
      errors: 0,
    },
    {
      c: {
        id: 'clm-demo-3',
        claimNumber: 'CLM-2026-0103',
        payerClaimControlNumber: 'PAY-8849203',
        status: 'submitted',
        totalChargeCents: 62000,
        paidCents: 0,
        balanceCents: 62000,
        patientResponsibilityCents: 0,
        serviceDateFrom: '2026-02-28',
        serviceDateTo: '2026-02-28',
        timelyFilingDeadline: '2026-05-28',
        createdAt: new Date(Date.now() - 86400000 * 4),
        patientId: 'pat-3',
        practiceId: 'prac-2',
        payerId: 'pyr-3',
        coverageRank: 'primary',
      },
      patientLast: 'Davis',
      patientFirst: 'Sophia',
      payer: 'UnitedHealthcare',
      practice: 'Valley Internal Medicine',
      errors: 0,
    },
    {
      c: {
        id: 'clm-demo-4',
        claimNumber: 'CLM-2026-0104',
        payerClaimControlNumber: 'PAY-8849204',
        status: 'paid',
        totalChargeCents: 35000,
        paidCents: 28000,
        balanceCents: 0,
        patientResponsibilityCents: 7000,
        serviceDateFrom: '2026-02-20',
        serviceDateTo: '2026-02-20',
        timelyFilingDeadline: '2026-05-20',
        createdAt: new Date(Date.now() - 86400000 * 12),
        patientId: 'pat-4',
        practiceId: 'prac-1',
        payerId: 'pyr-1',
        coverageRank: 'primary',
      },
      patientLast: 'Chen',
      patientFirst: 'Michael',
      payer: 'Blue Cross Blue Shield',
      practice: 'Orchard Family Practice',
      errors: 0,
    },
    {
      c: {
        id: 'clm-demo-5',
        claimNumber: 'CLM-2026-0105',
        payerClaimControlNumber: 'PAY-8849205',
        status: 'secondary_ready',
        totalChargeCents: 51000,
        paidCents: 38000,
        balanceCents: 13000,
        patientResponsibilityCents: 0,
        serviceDateFrom: '2026-02-22',
        serviceDateTo: '2026-02-22',
        timelyFilingDeadline: '2026-05-22',
        createdAt: new Date(Date.now() - 86400000 * 10),
        patientId: 'pat-5',
        practiceId: 'prac-2',
        payerId: 'pyr-4',
        coverageRank: 'secondary',
      },
      patientLast: 'Martinez',
      patientFirst: 'Carlos',
      payer: 'Cigna',
      practice: 'Valley Internal Medicine',
      errors: 0,
    },
  ];

  return { rows, counts, practices };
}

export function getMockClaimDetail(id: string) {
  const overrides = GLOBAL_CLAIM_OVERRIDES[id] ?? {};
  return {
    a: {
      claim: {
        id,
        claimNumber: 'CLM-2026-0101',
        payerClaimControlNumber: 'PAY-8849201',
        claimType: overrides.claimType ?? '837P',
        claimFrequencyCode: overrides.claimFrequencyCode ?? '1',
        originalPayerControlNumber: overrides.originalPayerControlNumber ?? 'PAY-8849201',
        priorAuthNumber: overrides.priorAuthNumber ?? '',
        status: overrides.status ?? 'denied',
        coverageRank: overrides.coverageRank ?? 'primary',
        serviceDateFrom: '2026-03-01',
        serviceDateTo: '2026-03-01',
        totalChargeCents: 45000,
        paidCents: 0,
        balanceCents: 45000,
        patientResponsibilityCents: 0,
        billingProviderNpi: '1487654321',
        renderingProviderNpi: '1487654321',
        facilityName: 'Orchard Medical Clinic',
        facilityNpi: '1992837465',
        diagnosisCodes: ['M54.5', 'M25.561'],
        createdAt: new Date(Date.now() - 86400000 * 2),
        ...overrides,
      },
      encounter: {
        id: 'enc-1',
        placeOfService: '11',
        serviceDateFrom: '2026-03-01',
        serviceDateTo: '2026-03-01',
        diagnosisCodes: ['M54.5', 'M25.561'],
      },
      renderingProvider: {
        firstName: 'Marcus',
        lastName: 'Vance',
        npi: '1487654321',
      },
      patient: {
        id: 'pat-1',
        firstName: 'Eleanor',
        lastName: 'Miller',
        dob: '1982-05-14',
        gender: 'F',
        mrn: 'MRN-44910',
        memberId: 'BCBS-992812',
      },
      coverage: {
        id: 'cov-1',
        memberId: 'BCBS-992812',
        lastVerifiedAt: new Date(Date.now() - 86400000 * 3),
        lastVerifiedStatus: 'active',
        groupNumber: 'GRP-10492',
        planName: 'Blue Choice PPO',
      },
      payer: {
        id: 'pyr-1',
        name: 'Blue Cross Blue Shield',
        payerId: '00010',
      },
      practice: {
        id: 'prac-1',
        name: 'Orchard Family Practice',
        npi: '1487654321',
        taxId: 'XX-XXX1234',
      },
      lines: [
        {
          id: 'line-1',
          lineNumber: 1,
          cptCode: '99214',
          description: 'Office or other outpatient visit, 30-39 min',
          modifier1: null,
          modifier2: null,
          modifier3: null,
          modifier4: null,
          placeOfService: '11',
          chargeCents: 25000,
          allowedCents: 21000,
          units: 1,
          diagnosisPointers: [1],
        },
        {
          id: 'line-2',
          lineNumber: 2,
          cptCode: '73030',
          description: 'Radiologic examination, shoulder; complete',
          modifier1: null,
          modifier2: null,
          modifier3: null,
          modifier4: null,
          placeOfService: '11',
          chargeCents: 20000,
          allowedCents: 16000,
          units: 1,
          diagnosisPointers: [2],
        },
      ],
    },
    findings: [
      {
        id: 'find-1',
        claimId: id,
        ruleCode: 'NCCI-PTP-01',
        severity: 'error',
        status: 'open',
        message: 'CPT 73030 and CPT 99214 require modifier -25 on E/M service when billed concurrently.',
        evidence: { editType: 'PTP', column1: '73030', column2: '99214', modifierAllowed: '1' },
        suggestedFix: {
          action: 'add_modifier',
          explanation: 'Append modifier 25 to procedure 99214 to document significant, separately identifiable evaluation.',
          value: '25',
        },
      },
    ],
    versions: [
      {
        id: 'ver-2',
        versionNumber: 2,
        contentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        createdAt: new Date(Date.now() - 86400000 * 1),
        hasX12: true,
      },
      {
        id: 'ver-1',
        versionNumber: 1,
        contentHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        createdAt: new Date(Date.now() - 86400000 * 3),
        hasX12: true,
      },
    ],
    submissions: [
      {
        id: 'sub-1',
        attemptNumber: 1,
        clearinghouseClaimId: 'STEDI-CLM-991204',
        status: 'accepted',
        submittedAt: new Date(Date.now() - 86400000 * 2),
      },
    ],
    acks: [
      {
        id: 'ack-1',
        type: '277ca',
        resultCode: 'A',
        status: 'accepted',
        receivedAt: new Date(Date.now() - 86400000 * 2 + 3600000),
        detail: '277CA Acceptance by BCBS: Claim received and in adjudication',
      },
    ],
    transitions: [
      { id: 'tr-1', fromStatus: 'draft', toStatus: 'ready', occurredAt: new Date(Date.now() - 86400000 * 3) },
      { id: 'tr-2', fromStatus: 'ready', toStatus: 'submitted', occurredAt: new Date(Date.now() - 86400000 * 2) },
      { id: 'tr-3', fromStatus: 'submitted', toStatus: 'denied', occurredAt: new Date(Date.now() - 86400000 * 1) },
    ],
    remits: [
      {
        rc: {
          id: 'rc-1',
          claimId: id,
          paidCents: 0,
          totalAdjustmentCents: 45000,
        },
        r: {
          id: 'remit-demo-1',
          traceNumber: 'TRC-991823',
          payerName: 'Blue Cross Blue Shield',
          checkDate: '2026-03-05',
          status: 'balanced',
        },
      },
    ],
    denials: [
      {
        id: 'den-1',
        groupCode: 'CO',
        reasonCode: '96',
        category: 'coding',
        remarkCodes: ['N382'],
        suggestedAction: 'add_modifier',
        deniedAmountCents: 45000,
        status: 'open',
      },
    ],
    activity: [
      { id: 'ca-1', actorType: 'system', actorLabel: 'Clearinghouse 277CA', summary: 'received 277CA acknowledgement: Accepted', occurredAt: new Date(Date.now() - 86400000 * 2) },
      { id: 'ca-2', actorType: 'system', actorLabel: 'ERA Ingestion', summary: 'parsed 835 ERA with CO-96 denial', occurredAt: new Date(Date.now() - 86400000 * 1) },
    ],
    ledger: [
      { id: 'led-1', entryType: 'charge', amountCents: 45000, balanceAfterCents: 45000, createdAt: new Date(Date.now() - 86400000 * 3) },
      { id: 'led-2', entryType: 'contractual_adjustment', amountCents: -45000, balanceAfterCents: 0, createdAt: new Date(Date.now() - 86400000 * 1) },
    ],
    notes: getMockClaimNotes(id),
    patientAlert: getMockPatientAlert('pat-1'),
    insuranceAlert: getMockInsuranceAlert('pyr-1'),
    claimAlert: getMockClaimAlert(id),
    auditLogs: [
      {
        id: 'aud-1',
        action: 'claim.submit',
        actorType: 'user',
        actorName: 'Alex Rivera',
        ipAddress: '192.168.1.45',
        sessionId: 'sess_889201a',
        occurredAt: new Date(Date.now() - 86400000 * 2),
        summary: 'Submitted claim to Stedi Clearinghouse (Attempt 1)',
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        verified: true,
      },
      {
        id: 'aud-2',
        action: 'claim.override',
        actorType: 'user',
        actorName: 'Sarah Jenkins',
        ipAddress: '192.168.1.88',
        sessionId: 'sess_771922c',
        occurredAt: new Date(Date.now() - 86400000 * 2 + 1800000),
        summary: 'Approved NCCI rule override for initial billing batch',
        hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        verified: true,
      },
      {
        id: 'aud-3',
        action: 'claim.export_hcfa',
        actorType: 'user',
        actorName: 'Alex Rivera',
        ipAddress: '192.168.1.45',
        sessionId: 'sess_889201a',
        occurredAt: new Date(Date.now() - 86400000 * 1),
        summary: 'Generated and exported CMS-1500 (HCFA-1500 02/12) PDF document',
        hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
        verified: true,
      },
      {
        id: 'aud-4',
        action: 'phi.access',
        actorType: 'system',
        actorName: 'Grove Autopilot',
        ipAddress: '127.0.0.1',
        sessionId: 'sys_autopilot_daemon',
        occurredAt: new Date(Date.now() - 1000 * 60 * 45),
        summary: 'Touched patient financial and demographic records for 835 remittance reconciliation',
        hash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
        verified: true,
      },
    ],
    submissionLogs: [
      {
        id: 'sub-1',
        attemptNumber: 1,
        connector: 'Stedi Healthcare Gateway',
        isaControlNumber: '000010042',
        stControlNumber: '0001',
        clearinghouseClaimId: 'STEDI-CLM-991204',
        status: 'sent',
        submittedAt: new Date(Date.now() - 86400000 * 2),
        batchNumber: 'BATCH-837P-2026-0089',
        responseSummary: '999 Implementation Ack: Accepted (1 Syntax, 0 Semantic Errors)',
      },
    ],
    changesLogs: [
      {
        id: 'chg-1',
        field: 'claimFrequencyCode',
        label: 'Claim Frequency / Filing Type',
        oldValue: '1 (Original)',
        newValue: '7 (Replacement / Corrected Claim)',
        author: 'Alex Rivera',
        authorRole: 'Senior Biller',
        changedAt: new Date(Date.now() - 86400000 * 1),
        reason: 'Prepared corrected filing to append missing modifier 25.',
      },
      {
        id: 'chg-2',
        field: 'modifier1 (Line 1 CPT 99214)',
        label: 'Service Line 1 Procedure Modifier',
        oldValue: 'None',
        newValue: '25 (Significant, Separately Identifiable E/M)',
        author: 'Grove Autopilot',
        authorRole: 'Autonomous Rules Engine',
        changedAt: new Date(Date.now() - 86400000 * 1 + 600000),
        reason: 'Auto-applied recommended NCCI modifier fix.',
      },
      {
        id: 'chg-3',
        field: 'priorAuthNumber',
        label: 'Prior Authorization Number',
        oldValue: 'None',
        newValue: 'AUTH-99214-BCBS',
        author: 'Sarah Jenkins',
        authorRole: 'Authorization Specialist',
        changedAt: new Date(Date.now() - 86400000 * 2),
        reason: 'Retrieved payer authorization confirmation from portal.',
      },
    ],
    rejectionLogs: [
      {
        id: 'rej-1',
        type: '277ca',
        stcCode: 'A7:21:40',
        category: 'Clearinghouse 277CA Rejection',
        status: 'rejection_corrected',
        message: 'Claim level rejection on secondary loop: Missing member ID qualifier on Box 9a.',
        receivedAt: new Date(Date.now() - 86400000 * 2),
        clearinghouseTrace: 'STEDI-277-991204',
        suggestedResolution: 'Resolved in Version 2. Resubmitted.',
      },
    ],
  };
}

const GLOBAL_WORK_QUEUE_TASKS: any[] = [
  {
    t: {
      id: 'tsk-1',
      workQueueId: 'q-1',
      claimId: 'clm-demo-1',
      priority: 'high',
      status: 'open',
      title: 'Appeal Denial CO-96 for Eleanor Miller',
      detail: { deniedCents: 45000, reason: 'Non-covered service / Missing modifier 25', payer: 'Blue Cross Blue Shield' },
      suggestedAction: 'Append Modifier 25 & Resubmit (Frequency 7)',
      createdAt: new Date(Date.now() - 3600000 * 5),
      dueAt: new Date(Date.now() + 86400000 * 5),
    },
    patientFirst: 'Eleanor',
    patientLast: 'Miller',
    category: 'denial',
    queueName: 'Denials Requiring Appeal',
  },
  {
    t: {
      id: 'tsk-2',
      workQueueId: 'q-2',
      claimId: 'clm-demo-2',
      priority: 'urgent',
      status: 'open',
      title: 'Fix 277CA Rejection: Missing subscriber group number',
      detail: { reason: 'Missing Loop 2000B SBR03 group #', payer: 'Aetna Health' },
      suggestedAction: 'Populate Group Number GRP-10492',
      createdAt: new Date(Date.now() - 3600000 * 2),
      dueAt: new Date(Date.now() + 86400000 * 1),
    },
    patientFirst: 'Robert',
    patientLast: 'Johnson',
    category: 'rejection',
    queueName: 'Clearinghouse 277CA Rejections',
  },
  {
    t: {
      id: 'tsk-3',
      workQueueId: 'q-3',
      claimId: 'clm-demo-4',
      priority: 'medium',
      status: 'open',
      title: 'Underpayment discrepancy: Paid $280 vs Contracted $320',
      detail: { underpaymentCents: 4000, payer: 'UnitedHealthcare' },
      suggestedAction: 'Post Contractual Adjustment Reversal',
      createdAt: new Date(Date.now() - 3600000 * 18),
      dueAt: new Date(Date.now() + 86400000 * 8),
    },
    patientFirst: 'Michael',
    patientLast: 'Chen',
    category: 'underpayment',
    queueName: 'Underpayments vs Fee Schedule',
  },
  {
    t: {
      id: 'tsk-4',
      workQueueId: 'q-4',
      claimId: 'clm-demo-3',
      priority: 'urgent',
      status: 'open',
      title: 'Timely filing deadline in 4 days: UnitedHealthcare',
      detail: { remainingCents: 62000, daysRemaining: 4, payer: 'UnitedHealthcare' },
      suggestedAction: 'Expedited Electronic Submission Batch',
      createdAt: new Date(Date.now() - 3600000 * 24),
      dueAt: new Date(Date.now() + 86400000 * 4),
    },
    patientFirst: 'Sophia',
    patientLast: 'Davis',
    category: 'timely_filing',
    queueName: 'Timely Filing Within 14 Days',
  },
  {
    t: {
      id: 'tsk-5',
      workQueueId: 'q-1',
      claimId: 'clm-demo-1',
      priority: 'high',
      status: 'in_progress',
      title: 'Medical Records requested from Dr. Vance for Appeal #CLM-2026-0101',
      detail: { reason: 'Operative report needed for level 2 payer review', payer: 'Blue Cross Blue Shield' },
      suggestedAction: 'Upload Signed SOAP Note PDF',
      createdAt: new Date(Date.now() - 3600000 * 12),
      dueAt: new Date(Date.now() + 86400000 * 2),
    },
    patientFirst: 'Eleanor',
    patientLast: 'Miller',
    category: 'denial',
    queueName: 'Denials Requiring Appeal',
  },
  {
    t: {
      id: 'tsk-6',
      workQueueId: 'q-5',
      claimId: 'clm-demo-5',
      priority: 'medium',
      status: 'in_progress',
      title: 'Verifying secondary crossover payer enrollment with Cigna',
      detail: { reason: 'Payer crossover coordination of benefits check', payer: 'Cigna' },
      suggestedAction: 'Run Real-time 270 Eligibility Check',
      createdAt: new Date(Date.now() - 3600000 * 8),
      dueAt: new Date(Date.now() + 86400000 * 3),
    },
    patientFirst: 'Carlos',
    patientLast: 'Martinez',
    category: 'eligibility',
    queueName: 'Eligibility Inactive Exceptions',
  },
  {
    t: {
      id: 'tsk-7',
      workQueueId: 'q-2',
      claimId: 'clm-demo-2',
      priority: 'urgent',
      status: 'in_progress',
      title: 'Investigating 277CA syntax error on Loop 2300 CLM05-3',
      detail: { reason: 'Clearinghouse reported invalid frequency sub-element', payer: 'Aetna Health' },
      suggestedAction: 'Regenerate ANSI 837P Segment',
      createdAt: new Date(Date.now() - 3600000 * 4),
      dueAt: new Date(Date.now() + 86400000 * 1),
    },
    patientFirst: 'Robert',
    patientLast: 'Johnson',
    category: 'rejection',
    queueName: 'Clearinghouse 277CA Rejections',
  },
  {
    t: {
      id: 'tsk-8',
      workQueueId: 'q-3',
      claimId: 'clm-demo-4',
      priority: 'low',
      status: 'snoozed',
      title: 'Awaiting Payer Phone Follow-up regarding check trace #88912',
      detail: { reason: 'Follow-up scheduled with UnitedHealthcare claims supervisor', payer: 'UnitedHealthcare' },
      suggestedAction: 'Call Provider Relations (800) 842-1234',
      createdAt: new Date(Date.now() - 86400000 * 2),
      dueAt: new Date(Date.now() + 86400000 * 3),
    },
    patientFirst: 'Michael',
    patientLast: 'Chen',
    category: 'underpayment',
    queueName: 'Underpayments vs Fee Schedule',
  },
  {
    t: {
      id: 'tsk-9',
      workQueueId: 'q-5',
      claimId: 'clm-demo-1',
      priority: 'medium',
      status: 'snoozed',
      title: 'Awaiting patient updated insurance card copy (Eleanor Miller)',
      detail: { reason: 'Patient contacted by SMS to upload front/back card image', payer: 'Blue Cross Blue Shield' },
      suggestedAction: 'Review Uploaded Card in Patient Chart',
      createdAt: new Date(Date.now() - 86400000 * 3),
      dueAt: new Date(Date.now() + 86400000 * 5),
    },
    patientFirst: 'Eleanor',
    patientLast: 'Miller',
    category: 'eligibility',
    queueName: 'Eligibility Inactive Exceptions',
  },
  {
    t: {
      id: 'tsk-10',
      workQueueId: 'q-1',
      claimId: 'clm-demo-1',
      priority: 'high',
      status: 'resolved',
      title: 'Appended modifier 25 to CPT 99214 and re-filed claim #CLM-2026-0098',
      detail: { reason: 'Corrected claim accepted by BCBS with ICN #8891204', payer: 'Blue Cross Blue Shield' },
      suggestedAction: 'Completed by Grove Autopilot',
      createdAt: new Date(Date.now() - 86400000 * 1),
      dueAt: null,
    },
    patientFirst: 'Eleanor',
    patientLast: 'Miller',
    category: 'denial',
    queueName: 'Denials Requiring Appeal',
  },
  {
    t: {
      id: 'tsk-11',
      workQueueId: 'q-2',
      claimId: 'clm-demo-2',
      priority: 'urgent',
      status: 'resolved',
      title: 'Corrected subscriber ID prefix on Aetna Claim #CLM-2026-0099',
      detail: { reason: 'Prefix updated from W to WA; 277CA Acceptance confirmed', payer: 'Aetna Health' },
      suggestedAction: 'Completed by Sarah Jenkins',
      createdAt: new Date(Date.now() - 86400000 * 1),
      dueAt: null,
    },
    patientFirst: 'Robert',
    patientLast: 'Johnson',
    category: 'rejection',
    queueName: 'Clearinghouse 277CA Rejections',
  },
  {
    t: {
      id: 'tsk-12',
      workQueueId: 'q-3',
      claimId: 'clm-demo-4',
      priority: 'medium',
      status: 'resolved',
      title: 'Posted contractual adjustment of $40.00 for underpaid line',
      detail: { reason: 'Payer fee schedule matched 2026 rate agreement', payer: 'UnitedHealthcare' },
      suggestedAction: 'Reconciled in Ledger',
      createdAt: new Date(Date.now() - 86400000 * 1),
      dueAt: null,
    },
    patientFirst: 'Michael',
    patientLast: 'Chen',
    category: 'underpayment',
    queueName: 'Underpayments vs Fee Schedule',
  },
  {
    t: {
      id: 'tsk-13',
      workQueueId: 'q-5',
      claimId: 'clm-demo-3',
      priority: 'low',
      status: 'resolved',
      title: 'Re-verified Medicaid eligibility active status via 270/271',
      detail: { reason: 'Electronic 271 verified active coverage through 12/31/2026', payer: 'UnitedHealthcare' },
      suggestedAction: 'Eligible for Direct Billing',
      createdAt: new Date(Date.now() - 86400000 * 1),
      dueAt: null,
    },
    patientFirst: 'Sophia',
    patientLast: 'Davis',
    category: 'eligibility',
    queueName: 'Eligibility Inactive Exceptions',
  },
];

export function getMockQueuesData({
  category = 'all',
  status = 'open',
  priority,
}: {
  category?: string;
  status?: string;
  priority?: string;
} = {}) {
  const queueList = [
    { id: 'q-1', key: 'denials', name: 'Denials Requiring Appeal', category: 'denial' },
    { id: 'q-2', key: 'rejections', name: 'Clearinghouse 277CA Rejections', category: 'rejection' },
    { id: 'q-3', key: 'underpayments', name: 'Underpayments vs Fee Schedule', category: 'underpayment' },
    { id: 'q-4', key: 'timely_filing', name: 'Timely Filing Within 14 Days', category: 'timely_filing' },
    { id: 'q-5', key: 'eligibility', name: 'Eligibility Inactive Exceptions', category: 'eligibility' },
  ];

  // Filter tasks by status, category, and priority
  const taskRows = GLOBAL_WORK_QUEUE_TASKS.filter((item) => {
    // 1. Status filter
    if (status !== 'all' && item.t.status !== status) {
      return false;
    }
    // 2. Category filter
    if (category !== 'all' && item.category !== category) {
      return false;
    }
    // 3. Priority filter
    if (priority && item.t.priority !== priority) {
      return false;
    }
    return true;
  });

  const openTasks = GLOBAL_WORK_QUEUE_TASKS.filter((i) => i.t.status === 'open' || i.t.status === 'in_progress');
  const urgentTasks = openTasks.filter((i) => i.t.priority === 'urgent' || i.t.priority === 'high');
  const overdueTasks = openTasks.filter((i) => i.t.dueAt && new Date(i.t.dueAt) < new Date());
  const resolvedTasks = GLOBAL_WORK_QUEUE_TASKS.filter((i) => i.t.status === 'resolved');

  const stats = {
    open_count: String(openTasks.length),
    urgent_count: String(urgentTasks.length),
    overdue_count: String(overdueTasks.length),
    resolvedToday: resolvedTasks.length,
    resolved_today: String(resolvedTasks.length),
  };

  return { queueList, taskRows, stats };
}

export function resolveMockTask(taskId: string) {
  const t = GLOBAL_WORK_QUEUE_TASKS.find((item) => item.t.id === taskId);
  if (t) {
    t.t.status = 'resolved';
    t.t.resolvedAt = new Date();
  }
}

export function snoozeMockTask(taskId: string, days: number = 3) {
  const t = GLOBAL_WORK_QUEUE_TASKS.find((item) => item.t.id === taskId);
  if (t) {
    t.t.status = 'snoozed';
    t.t.dueAt = new Date(Date.now() + days * 86400000);
  }
}

export function getMockRemittancesData() {
  const rows = [
    {
      r: {
        id: 'remit-demo-1',
        traceNumber: 'TRC-991823',
        payerName: 'Blue Cross Blue Shield',
        payerId: '00010',
        checkNumber: 'CHK-88912',
        checkDate: '2026-03-05',
        totalPaidCents: 1425000,
        status: 'balanced',
        receivedAt: new Date(Date.now() - 86400000 * 1),
      },
      claimsCount: 8,
    },
    {
      r: {
        id: 'remit-demo-2',
        traceNumber: 'TRC-991824',
        payerName: 'Aetna Health',
        payerId: '60054',
        checkNumber: 'EFT-449102',
        checkDate: '2026-03-04',
        totalPaidCents: 890000,
        status: 'posted',
        receivedAt: new Date(Date.now() - 86400000 * 2),
      },
      claimsCount: 5,
    },
    {
      r: {
        id: 'remit-demo-3',
        traceNumber: 'TRC-991825',
        payerName: 'UnitedHealthcare',
        payerId: '87726',
        checkNumber: 'EFT-118274',
        checkDate: '2026-03-03',
        totalPaidCents: 2150000,
        status: 'balanced',
        receivedAt: new Date(Date.now() - 86400000 * 3),
      },
      claimsCount: 14,
    },
  ];

  const counts = [
    { status: 'received', n: 2 },
    { status: 'parsed', n: 3 },
    { status: 'balanced', n: 12 },
    { status: 'out_of_balance', n: 1 },
    { status: 'posted', n: 24 },
    { status: 'partially_posted', n: 2 },
  ];

  const totals = {
    total_paid: '4465000',
    out_of_balance_count: '1',
  };

  return { rows, counts, totals };
}

export function getMockRemittanceDetail(id: string) {
  return {
    remit: {
      id,
      traceNumber: 'TRC-991823',
      payerName: 'Blue Cross Blue Shield',
      payerId: '00010',
      checkNumber: 'CHK-88912',
      paymentDate: '2026-03-05',
      paymentMethod: 'ACH',
      totalPaidCents: 1425000,
      computedClaimTotalCents: 1425000,
      providerAdjustmentTotalCents: 0,
      balanceVarianceCents: 0,
      status: 'balanced',
      receivedAt: new Date(Date.now() - 86400000 * 1),
    },
    claims: [
      {
        rc: {
          id: 'rc-1',
          claimId: 'clm-demo-1',
          patientControlNumber: 'CLM-2026-0101',
          payerClaimControlNumber: 'CCN-BCBS-88910',
          totalChargeCents: 45000,
          totalPaidCents: 38000,
          patientResponsibilityCents: 7000,
          claimStatusCode: '1',
        },
        claimNumber: 'CLM-2026-0101',
        patientId: 'pat-1',
        patientFirst: 'Eleanor',
        patientLast: 'Miller',
      },
      {
        rc: {
          id: 'rc-2',
          claimId: 'clm-demo-4',
          patientControlNumber: 'CLM-2026-0104',
          payerClaimControlNumber: 'CCN-BCBS-88914',
          totalChargeCents: 35000,
          totalPaidCents: 28000,
          patientResponsibilityCents: 7000,
          claimStatusCode: '1',
        },
        claimNumber: 'CLM-2026-0104',
        patientId: 'pat-4',
        patientFirst: 'Michael',
        patientLast: 'Chen',
      },
    ],
    adjustments: [
      {
        id: 'adj-1',
        remittanceClaimId: 'rc-1',
        groupCode: 'PR',
        reasonCode: '1',
        reasonDescription: 'Deductible Amount',
        amountCents: 7000,
      },
      {
        id: 'adj-2',
        remittanceClaimId: 'rc-2',
        groupCode: 'PR',
        reasonCode: '2',
        reasonDescription: 'Coinsurance Amount',
        amountCents: 7000,
      },
    ],
    plb: [],
  };
}

export function getMockEligibilityData() {
  const checks = [
    {
      c: {
        id: 'chk-1',
        patientId: 'pat-1',
        serviceTypeCodes: ['30'],
        status: 'active',
        trigger: 'realtime_ui',
        respondedAt: new Date(Date.now() - 3600000 * 2),
        createdAt: new Date(Date.now() - 3600000 * 2),
      },
      patientFirst: 'Eleanor',
      patientLast: 'Miller',
      payerName: 'Blue Cross Blue Shield',
      mrn: 'MRN-44910',
    },
    {
      c: {
        id: 'chk-2',
        patientId: 'pat-2',
        serviceTypeCodes: ['30'],
        status: 'active',
        trigger: 'scheduler',
        respondedAt: new Date(Date.now() - 3600000 * 6),
        createdAt: new Date(Date.now() - 3600000 * 6),
      },
      patientFirst: 'Robert',
      patientLast: 'Johnson',
      payerName: 'Aetna Health',
      mrn: 'MRN-44911',
    },
    {
      c: {
        id: 'chk-3',
        patientId: 'pat-3',
        serviceTypeCodes: ['30'],
        status: 'inactive',
        trigger: 'realtime_ui',
        respondedAt: new Date(Date.now() - 3600000 * 12),
        createdAt: new Date(Date.now() - 3600000 * 12),
      },
      patientFirst: 'Sophia',
      patientLast: 'Davis',
      payerName: 'UnitedHealthcare',
      mrn: 'MRN-44912',
    },
  ];

  const batches = [
    {
      id: 'bat-1',
      name: 'Morning Schedule Batch #1',
      sourceType: 'schedule',
      totalRequests: 45,
      activeCount: 42,
      inactiveCount: 3,
      status: 'completed',
      createdAt: new Date(Date.now() - 86400000 * 1),
    },
  ];

  const stats = {
    total_checks: '45',
    active_count: '42',
    inactive_count: '3',
  };

  return { checks, batches, stats };
}

export function getMockPatientsData() {
  const rows = [
    {
      p: {
        id: 'pat-1',
        mrn: 'MRN-44910',
        firstName: 'Eleanor',
        lastName: 'Miller',
        dateOfBirth: '1982-05-14',
        dob: '1982-05-14',
        sex: 'F',
        gender: 'F',
        phoneMobile: '(555) 234-8901',
        email: 'eleanor.miller@example.org',
        status: 'active',
        createdAt: new Date(Date.now() - 86400000 * 90),
      },
      practiceName: 'Orchard Family Practice',
      primaryPayer: 'Blue Cross Blue Shield',
      openClaims: 1,
    },
    {
      p: {
        id: 'pat-2',
        mrn: 'MRN-44911',
        firstName: 'Robert',
        lastName: 'Johnson',
        dateOfBirth: '1975-11-20',
        dob: '1975-11-20',
        sex: 'M',
        gender: 'M',
        phoneMobile: '(555) 345-1290',
        email: 'robert.j@example.org',
        status: 'active',
        createdAt: new Date(Date.now() - 86400000 * 60),
      },
      practiceName: 'Orchard Family Practice',
      primaryPayer: 'Aetna Health',
      openClaims: 1,
    },
    {
      p: {
        id: 'pat-3',
        mrn: 'MRN-44912',
        firstName: 'Sophia',
        lastName: 'Davis',
        dateOfBirth: '1990-03-08',
        dob: '1990-03-08',
        sex: 'F',
        gender: 'F',
        phoneMobile: '(555) 456-7812',
        email: 'sophia.d@example.org',
        status: 'active',
        createdAt: new Date(Date.now() - 86400000 * 30),
      },
      practiceName: 'Valley Internal Medicine',
      primaryPayer: 'UnitedHealthcare',
      openClaims: 1,
    },
    {
      p: {
        id: 'pat-4',
        mrn: 'MRN-44913',
        firstName: 'Michael',
        lastName: 'Chen',
        dateOfBirth: '1968-09-24',
        dob: '1968-09-24',
        sex: 'M',
        gender: 'M',
        phoneMobile: '(555) 567-3401',
        email: 'm.chen@example.org',
        status: 'active',
        createdAt: new Date(Date.now() - 86400000 * 120),
      },
      practiceName: 'Orchard Family Practice',
      primaryPayer: 'Blue Cross Blue Shield',
      openClaims: 0,
    },
    {
      p: {
        id: 'pat-5',
        mrn: 'MRN-44914',
        firstName: 'Carlos',
        lastName: 'Martinez',
        dateOfBirth: '1985-12-03',
        dob: '1985-12-03',
        sex: 'M',
        gender: 'M',
        phoneMobile: '(555) 678-9012',
        email: 'carlos.m@example.org',
        status: 'active',
        createdAt: new Date(Date.now() - 86400000 * 45),
      },
      practiceName: 'Valley Internal Medicine',
      primaryPayer: 'Cigna',
      openClaims: 1,
    },
  ];

  const practices = [
    { id: 'prac-1', name: 'Orchard Family Practice' },
    { id: 'prac-2', name: 'Valley Internal Medicine' },
  ];

  return { rows, practices };
}

export function getMockPatientDetail(id: string) {
  return {
    patient: {
      p: {
        id,
        mrn: 'MRN-44910',
        firstName: 'Eleanor',
        lastName: 'Miller',
        dob: '1982-05-14',
        gender: 'F',
        addressLine1: '742 Evergreen Terrace',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62704',
        phoneMobile: '(555) 234-8901',
        email: 'eleanor.miller@example.org',
        status: 'active',
        createdAt: new Date(Date.now() - 86400000 * 90),
      },
      practiceName: 'Orchard Family Practice',
    },
    coverages: [
      {
        c: {
          id: 'cov-1',
          rank: 'primary',
          memberId: 'BCBS-992812',
          groupNumber: 'GRP-10492',
          status: 'active',
          startDate: '2025-01-01',
        },
        payerName: 'Blue Cross Blue Shield',
      },
      {
        c: {
          id: 'cov-2',
          rank: 'secondary',
          memberId: 'AET-883921',
          groupNumber: 'GRP-55102',
          status: 'active',
          startDate: '2025-01-01',
        },
        payerName: 'Aetna Health',
      },
    ],
    claims: [
      {
        c: {
          id: 'clm-demo-1',
          claimNumber: 'CLM-2026-0101',
          serviceDateFrom: '2026-03-01',
          totalChargeCents: 45000,
          paidCents: 0,
          patientResponsibilityCents: 0,
          status: 'denied',
          createdAt: new Date(Date.now() - 86400000 * 2),
        },
        payerName: 'Blue Cross Blue Shield',
      },
    ],
    ledger: [
      {
        id: 'led-1',
        entryType: 'charge',
        amountCents: 45000,
        balanceAfterCents: 45000,
        description: 'Encounter #ENC-4401 charges',
        createdAt: new Date(Date.now() - 86400000 * 2),
      },
      {
        id: 'led-2',
        entryType: 'patient_payment',
        amountCents: -5000,
        balanceAfterCents: 40000,
        description: 'Copay payment via Card •••• 4242',
        createdAt: new Date(Date.now() - 86400000 * 2 + 1800000),
      },
    ],
    payers: [
      { id: 'pyr-1', name: 'Blue Cross Blue Shield' },
      { id: 'pyr-2', name: 'Aetna Health' },
      { id: 'pyr-3', name: 'UnitedHealthcare' },
      { id: 'pyr-4', name: 'Cigna' },
    ],
    soapNotes: getPatientSoapNotes(id),
    medicalHistory: {
      conditions: [
        { id: 'c-1', condition: 'Essential Hypertension', icd10: 'I10', onsetYear: '2020', status: 'active', notes: 'Well controlled on Lisinopril' },
        { id: 'c-2', condition: 'Seasonal Allergic Rhinitis', icd10: 'J30.9', onsetYear: '2015', status: 'active', notes: 'Spring exacerbations' },
        { id: 'c-3', condition: 'Acute Bronchitis', icd10: 'J20.9', onsetYear: '2023', status: 'resolved', notes: 'Completed Azithromycin course' },
      ],
      surgeries: [
        { id: 's-1', procedure: 'Laparoscopic Cholecystectomy', year: '2018', facility: 'Springfield Memorial Hospital', indication: 'Symptomatic cholelithiasis' },
        { id: 's-2', procedure: 'Right Knee Arthroscopy', year: '2012', facility: 'Midwest Orthopedic Center', indication: 'Partial medial meniscus tear' },
      ],
      family: [
        { relationship: 'Father', condition: 'Coronary Artery Disease / Myocardial Infarction at age 62', status: 'deceased' },
        { relationship: 'Mother', condition: 'Type 2 Diabetes Mellitus, Osteoporosis', status: 'living' },
        { relationship: 'Sister', condition: 'Hypothyroidism (Hashimoto\'s)', status: 'living' },
      ],
      social: {
        tobacco: 'Never smoker (lifetime non-tobacco user)',
        alcohol: 'Occasional social wine (1-2 glasses/week)',
        occupation: 'High School Biology Teacher',
        exercise: 'Walks 30 minutes 3x/week',
      },
    },
    allergies: [
      { id: 'alg-1', allergen: 'Penicillin V Potassium', reaction: 'Urticaria (Hives), generalized pruritus', severity: 'moderate', onsetDate: '2010-04-12', status: 'active' },
      { id: 'alg-2', allergen: 'Sulfa Drugs (Bactrim)', reaction: 'Maculopapular rash, facial flushing', severity: 'mild', onsetDate: '2016-08-20', status: 'active' },
    ],
    medications: [
      { id: 'med-1', name: 'Lisinopril', dosage: '10 mg', route: 'Oral Tablet', frequency: 'Once daily in morning', indication: 'Hypertension', prescriber: 'Dr. Marcus Vance, MD', startDate: '2020-06-15', status: 'active' },
      { id: 'med-2', name: 'Fluticasone Propionate', dosage: '50 mcg/actuation', route: 'Nasal Spray', frequency: '1 spray per nostril daily', indication: 'Allergic rhinitis', prescriber: 'Dr. Marcus Vance, MD', startDate: '2022-03-10', status: 'active' },
      { id: 'med-3', name: 'Cholecalciferol (Vitamin D3)', dosage: '2000 IU', route: 'Oral Capsule', frequency: 'Once daily', indication: 'Vitamin D insufficiency', prescriber: 'Over the Counter', startDate: '2021-01-10', status: 'active' },
    ],
    documents: getPatientDocuments(id),
  };
}

// In-memory demo state that persists during active server session
const INITIAL_SOAP_NOTES: any[] = [
  {
    id: 'soap-1',
    encounterDate: '2026-03-01',
    providerName: 'Dr. Marcus Vance, MD',
    providerNpi: '1487654321',
    status: 'signed_and_locked',
    signedAt: new Date(Date.now() - 86400000 * 2 + 7200000),
    vitals: {
      bloodPressure: '122/78 mmHg',
      heartRate: '72 bpm',
      temperature: '98.4 °F',
      respiratoryRate: '16 /min',
      spo2: '99% on room air',
      weightLbs: '142 lbs',
      heightInches: '65 in',
      bmi: '23.6',
    },
    subjective: {
      chiefComplaint: 'Acute low back pain radiating to left buttock for 4 days after lifting garden soil.',
      hpi: 'Patient is a 43-year-old female presenting with sharp, aching low back pain (severity 6/10) that started 4 days ago. Pain worsens with prolonged sitting and forward bending. Relieved by lying flat with knees elevated. No numbness, tingling, or lower extremity weakness. No bowel or bladder dysfunction (red flags negative).',
      ros: 'Constitutional: No fevers, chills, or unexplained weight loss. Musculoskeletal: Positive for lumbar spine stiffness. Neurological: Negative for paresthesias or weakness.',
    },
    objective: {
      exam: 'Patient appears in mild distress when transitioning from seated to standing position. Normal gait. Lumbar spine demonstrates tenderness to palpation over L4-L5 paraspinal musculature. Range of motion: flexion limited to 60 degrees secondary to pain. Straight leg raise (SLR) negative bilaterally. Deep tendon reflexes: Patellar 2+ bilaterally, Achilles 2+ bilaterally. Sensation to light touch intact in L3-S1 dermatomes bilaterally.',
    },
    assessment: [
      { icd10: 'M54.5', description: 'Low back pain, unspecified', status: 'primary' },
      { icd10: 'M25.561', description: 'Pain in right knee, unspecified', status: 'secondary' },
    ],
    plan: {
      medications: 'Prescribed Cyclobenzaprine 5mg PO TID PRN muscle spasm (#15, no refills); Naproxen 500mg PO BID with food for 7 days.',
      orders: 'Order lumbar spine plain radiographs 2-views to evaluate alignment and disc spaces. Physical therapy referral: Lumbar stabilization exercises 2x/week for 6 weeks.',
      instructions: 'Advised patient on core ergonomics, avoiding heavy lifting (>15 lbs), alternating heat/ice 20 mins every 3 hours. Return to clinic in 3 weeks or immediately if numbness, foot drop, or urinary changes develop.',
    },
  },
];

const INITIAL_DOCUMENTS: any[] = [
  {
    id: 'doc-1',
    title: 'Comprehensive Metabolic Panel (CMP) & Lipid Panel',
    category: 'Lab Report',
    mimeType: 'application/pdf',
    fileSizeKb: 245,
    storageKey: 'patients/pat-1/labs/cmp_20260215.pdf',
    uploadedAt: new Date(Date.now() - 86400000 * 24),
    uploadedBy: 'Quest Diagnostics (HL7 Interface)',
    confidentiality: 'standard_phi',
  },
  {
    id: 'doc-2',
    title: 'Lumbar Spine X-Ray 2-Views (AP & Lateral)',
    category: 'Diagnostic Imaging',
    mimeType: 'application/pdf',
    fileSizeKb: 1840,
    storageKey: 'patients/pat-1/imaging/lumbar_xray_20260301.pdf',
    uploadedAt: new Date(Date.now() - 86400000 * 2),
    uploadedBy: 'Dr. Marcus Vance, MD',
    confidentiality: 'standard_phi',
  },
  {
    id: 'doc-3',
    title: 'HIPAA Notice of Privacy Practices & Consent for Treatment',
    category: 'Consent & Legal',
    mimeType: 'application/pdf',
    fileSizeKb: 120,
    storageKey: 'patients/pat-1/consents/hipaa_consent_signed.pdf',
    uploadedAt: new Date(Date.now() - 86400000 * 90),
    uploadedBy: 'Front Desk Kiosk',
    confidentiality: 'standard_phi',
  },
  {
    id: 'doc-4',
    title: 'Front & Back Photo: BCBS Insurance Card',
    category: 'Insurance Card',
    mimeType: 'image/jpeg',
    fileSizeKb: 450,
    storageKey: 'patients/pat-1/insurance/bcbs_card_front_back.jpg',
    uploadedAt: new Date(Date.now() - 86400000 * 90),
    uploadedBy: 'Mobile Patient Intake',
    confidentiality: 'standard_phi',
  },
];

const GLOBAL_SOAP_NOTES: Record<string, any[]> = {
  'pat-1': [...INITIAL_SOAP_NOTES],
};

const GLOBAL_DOCUMENTS: Record<string, any[]> = {
  'pat-1': [...INITIAL_DOCUMENTS],
};

function getPatientSoapNotes(id: string): any[] {
  if (!GLOBAL_SOAP_NOTES[id]) {
    GLOBAL_SOAP_NOTES[id] = [...INITIAL_SOAP_NOTES];
  }
  return GLOBAL_SOAP_NOTES[id]!;
}

function getPatientDocuments(id: string): any[] {
  if (!GLOBAL_DOCUMENTS[id]) {
    GLOBAL_DOCUMENTS[id] = [...INITIAL_DOCUMENTS];
  }
  return GLOBAL_DOCUMENTS[id]!;
}

export function addMockSoapNote(patientId: string, note: any) {
  if (!GLOBAL_SOAP_NOTES[patientId]) {
    GLOBAL_SOAP_NOTES[patientId] = [...INITIAL_SOAP_NOTES];
  }
  GLOBAL_SOAP_NOTES[patientId]!.unshift(note);
}

export function addMockDocument(patientId: string, doc: any) {
  if (!GLOBAL_DOCUMENTS[patientId]) {
    GLOBAL_DOCUMENTS[patientId] = [...INITIAL_DOCUMENTS];
  }
  GLOBAL_DOCUMENTS[patientId]!.unshift(doc);
}

const GLOBAL_PAYMENTS: any[] = [
  {
    id: 'pmt-1',
    paymentNumber: 'PMT-2026-0045',
    source: 'patient_card',
    amountCents: 5000,
    allocatedCents: 5000,
    unallocatedCents: 0,
    status: 'settled',
    referenceNumber: 'AUTH_992182',
    method: 'Visa •••• 4242',
    postedAt: new Date(Date.now() - 3600000 * 2),
    patientName: 'Miller, Eleanor',
    mrn: 'MRN-44910',
    patientId: 'pat-1',
    claimNumber: 'CLM-2026-0101',
    practiceName: 'Orchard Family Practice',
  },
  {
    id: 'pmt-2',
    paymentNumber: 'PMT-2026-0044',
    source: 'patient_check',
    amountCents: 12000,
    allocatedCents: 12000,
    unallocatedCents: 0,
    status: 'settled',
    referenceNumber: 'CHK-4491',
    method: 'Check #4491',
    postedAt: new Date(Date.now() - 3600000 * 5),
    patientName: 'Johnson, Robert',
    mrn: 'MRN-44911',
    patientId: 'pat-2',
    claimNumber: 'CLM-2026-0102',
    practiceName: 'Orchard Family Practice',
  },
  {
    id: 'pmt-3',
    paymentNumber: 'PMT-2026-0043',
    source: 'patient_cash',
    amountCents: 2500,
    allocatedCents: 2500,
    unallocatedCents: 0,
    status: 'settled',
    referenceNumber: 'REC-08912',
    method: 'Cash Copay',
    postedAt: new Date(Date.now() - 86400000 * 1),
    patientName: 'Davis, Sophia',
    mrn: 'MRN-44912',
    patientId: 'pat-3',
    claimNumber: 'CLM-2026-0103',
    practiceName: 'Valley Internal Medicine',
  },
  {
    id: 'pmt-4',
    paymentNumber: 'PMT-2026-0042',
    source: 'patient_ach',
    amountCents: 48000,
    allocatedCents: 40000,
    unallocatedCents: 8000,
    status: 'settled',
    referenceNumber: 'ACH-88910',
    method: 'ACH Direct Debit (••••9812)',
    postedAt: new Date(Date.now() - 86400000 * 2),
    patientName: 'Martinez, Carlos',
    mrn: 'MRN-44914',
    patientId: 'pat-5',
    claimNumber: 'CLM-2026-0105',
    practiceName: 'Valley Internal Medicine',
  },
];

export function addMockPayment(pmt: any) {
  GLOBAL_PAYMENTS.unshift(pmt);
}

const GLOBAL_INSURANCE_PAYMENTS: any[] = [
  {
    id: 'ins-pmt-1',
    paymentNumber: 'INS-CHK-88912',
    payerId: 'pyr-1',
    payerName: 'Blue Cross Blue Shield',
    paymentType: 'eft',
    checkOrEftTraceNumber: 'EFT-BCBS-991823',
    paymentDate: '2026-03-05',
    totalPaidCents: 1425000,
    contractualWriteoffCents: 320000,
    patientResponsibilityCents: 180000,
    claimsCount: 8,
    status: 'balanced',
    postedAt: new Date(Date.now() - 86400000 * 1),
    claimsAllocated: [
      {
        claimId: 'clm-demo-1',
        claimNumber: 'CLM-2026-0101',
        patientName: 'Miller, Eleanor',
        billedCents: 45000,
        allowedCents: 38000,
        paidCents: 31000,
        contractualAdjustmentCents: 7000,
        patientResponsibilityCents: 7000,
      },
      {
        claimId: 'clm-demo-4',
        claimNumber: 'CLM-2026-0104',
        patientName: 'Chen, Michael',
        billedCents: 35000,
        allowedCents: 28000,
        paidCents: 28000,
        contractualAdjustmentCents: 7000,
        patientResponsibilityCents: 0,
      },
    ],
  },
  {
    id: 'ins-pmt-2',
    paymentNumber: 'INS-CHK-77410',
    payerId: 'pyr-2',
    payerName: 'Aetna Health',
    paymentType: 'check',
    checkOrEftTraceNumber: 'CHK-AET-449102',
    paymentDate: '2026-03-04',
    totalPaidCents: 890000,
    contractualWriteoffCents: 210000,
    patientResponsibilityCents: 120000,
    claimsCount: 5,
    status: 'posted',
    postedAt: new Date(Date.now() - 86400000 * 2),
    claimsAllocated: [
      {
        claimId: 'clm-demo-2',
        claimNumber: 'CLM-2026-0102',
        patientName: 'Johnson, Robert',
        billedCents: 120000,
        allowedCents: 98000,
        paidCents: 89000,
        contractualAdjustmentCents: 22000,
        patientResponsibilityCents: 9000,
      },
    ],
  },
  {
    id: 'ins-pmt-3',
    paymentNumber: 'INS-CHK-66120',
    payerId: 'pyr-3',
    payerName: 'UnitedHealthcare',
    paymentType: 'eft',
    checkOrEftTraceNumber: 'EFT-UHC-118274',
    paymentDate: '2026-03-03',
    totalPaidCents: 2150000,
    contractualWriteoffCents: 480000,
    patientResponsibilityCents: 240000,
    claimsCount: 14,
    status: 'balanced',
    postedAt: new Date(Date.now() - 86400000 * 3),
    claimsAllocated: [],
  },
];

export function addMockInsurancePayment(payment: any) {
  GLOBAL_INSURANCE_PAYMENTS.unshift(payment);
}

export function getMockPaymentsData() {
  const totalPatientCollectedTodayCents = GLOBAL_PAYMENTS.reduce((sum, p) => sum + p.amountCents, 0);
  const totalInsurancePaidCents = GLOBAL_INSURANCE_PAYMENTS.reduce((sum, p) => sum + p.totalPaidCents, 0);
  const totalContractualWriteoffsCents = GLOBAL_INSURANCE_PAYMENTS.reduce((sum, p) => sum + p.contractualWriteoffCents, 0);

  const summary = {
    totalCollectedTodayCents: totalPatientCollectedTodayCents + 177500,
    patientPaymentsMtdCents: 1890000,
    unallocatedCreditsCents: 125000,
    settledCount: 44 + GLOBAL_PAYMENTS.length,
    insuranceTotalPaidCents: totalInsurancePaidCents,
    insuranceContractualWriteoffsCents: totalContractualWriteoffsCents,
    insuranceChecksCount: GLOBAL_INSURANCE_PAYMENTS.length,
  };

  const payments = [...GLOBAL_PAYMENTS];
  const insurancePayments = [...GLOBAL_INSURANCE_PAYMENTS];

  const patients = [
    {
      id: 'pat-1',
      name: 'Miller, Eleanor',
      firstName: 'Eleanor',
      lastName: 'Miller',
      mrn: 'MRN-44910',
      dob: '1982-05-14',
      gender: 'F',
      subscriberId: 'BCBS-992140',
      payerName: 'Blue Cross Blue Shield',
      ssnLast4: '4910',
      phone: '(555) 234-8901',
      balanceCents: 5000,
    },
    {
      id: 'pat-2',
      name: 'Johnson, Robert',
      firstName: 'Robert',
      lastName: 'Johnson',
      mrn: 'MRN-44911',
      dob: '1975-11-20',
      gender: 'M',
      subscriberId: 'AET-881290',
      payerName: 'Aetna Health',
      ssnLast4: '1290',
      phone: '(555) 345-1290',
      balanceCents: 3500,
    },
    {
      id: 'pat-3',
      name: 'Davis, Sophia',
      firstName: 'Sophia',
      lastName: 'Davis',
      mrn: 'MRN-44912',
      dob: '1990-03-08',
      gender: 'F',
      subscriberId: 'UHC-552190',
      payerName: 'UnitedHealthcare',
      ssnLast4: '7812',
      phone: '(555) 456-7812',
      balanceCents: 12000,
    },
    {
      id: 'pat-4',
      name: 'Chen, Michael',
      firstName: 'Michael',
      lastName: 'Chen',
      mrn: 'MRN-44913',
      dob: '1968-09-24',
      gender: 'M',
      subscriberId: 'CGN-441209',
      payerName: 'Cigna',
      ssnLast4: '3401',
      phone: '(555) 567-3401',
      balanceCents: 0,
    },
    {
      id: 'pat-5',
      name: 'Martinez, Carlos',
      firstName: 'Carlos',
      lastName: 'Martinez',
      mrn: 'MRN-44914',
      dob: '1985-07-19',
      gender: 'M',
      subscriberId: 'MED-991204',
      payerName: 'Medicare Part B Illinois',
      ssnLast4: '8914',
      phone: '(555) 678-9012',
      balanceCents: 8000,
    },
    {
      id: 'pat-6',
      name: 'Watson, Emily',
      firstName: 'Emily',
      lastName: 'Watson',
      mrn: 'MRN-44915',
      dob: '1995-12-03',
      gender: 'F',
      subscriberId: 'BCBS-883102',
      payerName: 'Blue Cross Blue Shield',
      ssnLast4: '5512',
      phone: '(555) 789-0123',
      balanceCents: 4500,
    },
    {
      id: 'pat-7',
      name: 'Kim, David',
      firstName: 'David',
      lastName: 'Kim',
      mrn: 'MRN-44916',
      dob: '1979-04-18',
      gender: 'M',
      subscriberId: 'AET-772190',
      payerName: 'Aetna Health',
      ssnLast4: '9034',
      phone: '(555) 890-1234',
      balanceCents: 15000,
    },
  ];

  const payers = [
    { id: 'pyr-1', name: 'Blue Cross Blue Shield', payerId: '00010' },
    { id: 'pyr-2', name: 'Aetna Health', payerId: '60054' },
    { id: 'pyr-3', name: 'UnitedHealthcare', payerId: '87726' },
    { id: 'pyr-4', name: 'Cigna', payerId: '62308' },
    { id: 'pyr-5', name: 'Medicare Part B Illinois', payerId: '00590' },
  ];

  const openClaims = [
    { id: 'clm-demo-1', claimNumber: 'CLM-2026-0101', patientName: 'Miller, Eleanor', mrn: 'MRN-44910', billedCents: 45000, payerName: 'Blue Cross Blue Shield' },
    { id: 'clm-demo-2', claimNumber: 'CLM-2026-0102', patientName: 'Johnson, Robert', mrn: 'MRN-44911', billedCents: 120000, payerName: 'Aetna Health' },
    { id: 'clm-demo-3', claimNumber: 'CLM-2026-0103', patientName: 'Davis, Sophia', mrn: 'MRN-44912', billedCents: 35000, payerName: 'UnitedHealthcare' },
    { id: 'clm-demo-4', claimNumber: 'CLM-2026-0104', patientName: 'Chen, Michael', mrn: 'MRN-44913', billedCents: 28000, payerName: 'Cigna' },
    { id: 'clm-demo-5', claimNumber: 'CLM-2026-0105', patientName: 'Martinez, Carlos', mrn: 'MRN-44914', billedCents: 65000, payerName: 'Cigna' },
  ];

  return { summary, payments, insurancePayments, patients, payers, openClaims };
}

export function getMockReportsData() {
  return {
    compiled: {
      columns: [
        { key: 'payer', label: 'Payer Name', kind: 'dimension' },
        { key: 'current_ar', label: '0-30 Days', kind: 'measure', format: 'cents' },
        { key: 'over30', label: '31-60 Days', kind: 'measure', format: 'cents' },
        { key: 'over60', label: '61-90 Days', kind: 'measure', format: 'cents' },
        { key: 'over90', label: '90+ Days', kind: 'measure', format: 'cents' },
        { key: 'total_ar', label: 'Total A/R', kind: 'measure', format: 'cents' },
      ],
    },
    rows: [
      { payer: 'Blue Cross Blue Shield', current_ar: 1450000, over30: 620000, over60: 210000, over90: 80000, total_ar: 2360000 },
      { payer: 'Aetna Health', current_ar: 890000, over30: 340000, over60: 120000, over90: 45000, total_ar: 1395000 },
      { payer: 'UnitedHealthcare', current_ar: 500000, over30: 250000, over60: 210000, over90: 110000, total_ar: 1070000 },
    ],
  };
}

export function getMockAuditData() {
  return [
    {
      sequence: 1042,
      occurredAt: new Date(Date.now() - 1000 * 60 * 12),
      action: 'claim.submit',
      resourceType: 'claim',
      resourceId: 'clm-demo-1',
      actorType: 'user',
      actorUserId: MOCK_USER_ID,
      actorLabel: 'Alex Rivera',
      ipAddress: '127.0.0.1',
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    },
    {
      sequence: 1041,
      occurredAt: new Date(Date.now() - 1000 * 60 * 45),
      action: 'eligibility.inquire',
      resourceType: 'patient',
      resourceId: 'pat-1',
      actorType: 'system',
      actorUserId: null,
      actorLabel: 'Grove Autopilot',
      ipAddress: null,
      hash: 'f2d1e0c9b8a7f6e5d4c3b2a10987654321fedcba0987654321fedcba09876543',
    },
    {
      sequence: 1040,
      occurredAt: new Date(Date.now() - 1000 * 60 * 95),
      action: 'remittance.balance',
      resourceType: 'remittance',
      resourceId: 'remit-demo-1',
      actorType: 'system',
      actorUserId: null,
      actorLabel: 'ERA Ingestion',
      ipAddress: null,
      hash: '8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b',
    },
  ];
}

export function getMockAutomationSettings() {
  return {
    auto: {
      id: 'auto-1',
      orgId: MOCK_ORG_ID,
      globalPaused: false,
      dryRun: false,
      pausedReason: null,
      dailyBudgetCents: 50000,
      secondaryClaimsEnabled: true,
      autoStatusChecksEnabled: true,
      autoBatchEligibilityEnabled: true,
    },
    spendTodayCents: 1420,
  };
}

export function getMockRulesData() {
  return [
    {
      id: 'rule-custom-1',
      name: 'High-Dollar Claim Senior Review (Charges > $2,500)',
      category: 'financial',
      severity: 'warning',
      description: 'Routes claims with charges exceeding $2,500 to the senior billing queue for dual sign-off before electronic release.',
      enabled: true,
      isSystem: false,
      createdAt: new Date(Date.now() - 86400000 * 10),
    },
    {
      id: 'rule-custom-2',
      name: 'Telehealth Place of Service 02/10 Modifier 95 Check',
      category: 'coding',
      severity: 'error',
      description: 'Asserts presence of CPT modifier 95 when place of service is 02 (Telehealth Other) or 10 (Telehealth Patient Home).',
      enabled: true,
      isSystem: false,
      createdAt: new Date(Date.now() - 86400000 * 5),
    },
  ];
}

export function getMockUsersData() {
  return [
    {
      u: {
        id: MOCK_USER_ID,
        firstName: 'Alex',
        lastName: 'Rivera',
        email: 'operator@grove.internal',
        status: 'active',
        mfaEnrolledAt: new Date(),
        lastLoginAt: new Date(Date.now() - 1000 * 60 * 5),
      },
      roles: ['admin', 'operator', 'biller'],
    },
    {
      u: {
        id: 'usr-2',
        firstName: 'Sarah',
        lastName: 'Jenkins',
        email: 'sarah.j@grove.internal',
        status: 'active',
        mfaEnrolledAt: new Date(),
        lastLoginAt: new Date(Date.now() - 1000 * 60 * 35),
      },
      roles: ['biller'],
    },
    {
      u: {
        id: 'usr-3',
        firstName: 'Marcus',
        lastName: 'Vance',
        email: 'mvance@orchardfamily.internal',
        status: 'active',
        mfaEnrolledAt: null,
        lastLoginAt: new Date(Date.now() - 86400000 * 1),
      },
      roles: ['clinician'],
    },
  ];
}

// ---------------------------------------------------------------------------
// Authorizations & Referrals Subsystem
// ---------------------------------------------------------------------------

const GLOBAL_AUTHORIZATIONS: any[] = [
  {
    id: 'pa-1',
    authNumber: 'PA-2026-9921',
    patientId: 'pat-1',
    patientName: 'Miller, Eleanor',
    mrn: 'MRN-44910',
    payerId: 'pyr-1',
    payerName: 'Blue Cross Blue Shield',
    procedureCode: '72148',
    procedureName: 'MRI Lumbar Spine without Contrast',
    diagnosisCode: 'M54.5',
    diagnosisName: 'Low back pain, unspecified',
    status: 'approved',
    urgency: 'standard',
    unitsApproved: 1,
    unitsUsed: 0,
    startDate: '2026-03-02',
    expirationDate: '2026-06-02',
    orderingProvider: 'Dr. Marcus Vance, MD',
    requestDate: '2026-03-01',
    notes: 'Prior conservative physical therapy completed without resolution. Radiating radiculopathy.',
  },
  {
    id: 'pa-2',
    authNumber: 'PA-2026-9922',
    patientId: 'pat-1',
    patientName: 'Miller, Eleanor',
    mrn: 'MRN-44910',
    payerId: 'pyr-1',
    payerName: 'Blue Cross Blue Shield',
    procedureCode: '97110',
    procedureName: 'Physical Therapy Therapeutic Exercises',
    diagnosisCode: 'M54.5',
    diagnosisName: 'Low back pain, unspecified',
    status: 'approved',
    urgency: 'standard',
    unitsApproved: 12,
    unitsUsed: 4,
    startDate: '2026-03-05',
    expirationDate: '2026-05-05',
    orderingProvider: 'Dr. Marcus Vance, MD',
    requestDate: '2026-03-02',
    notes: 'Approved for 12 visits over 8 weeks.',
  },
  {
    id: 'pa-3',
    authNumber: 'PA-2026-9923',
    patientId: 'pat-2',
    patientName: 'Johnson, Robert',
    mrn: 'MRN-44911',
    payerId: 'pyr-2',
    payerName: 'Aetna Health',
    procedureCode: '27447',
    procedureName: 'Total Knee Arthroplasty (Replacement)',
    diagnosisCode: 'M17.11',
    diagnosisName: 'Primary osteoarthritis, right knee',
    status: 'pending_payer',
    urgency: 'urgent',
    unitsApproved: 1,
    unitsUsed: 0,
    startDate: '2026-03-15',
    expirationDate: '2026-09-15',
    orderingProvider: 'Dr. Sarah Jenkins, DO',
    requestDate: '2026-03-08',
    notes: 'Severe end-stage osteoarthritis with failed steroid and hyaluronic acid injections.',
  },
  {
    id: 'pa-4',
    authNumber: 'PA-2026-9924',
    patientId: 'pat-3',
    patientName: 'Davis, Sophia',
    mrn: 'MRN-44912',
    payerId: 'pyr-3',
    payerName: 'UnitedHealthcare',
    procedureCode: '93306',
    procedureName: 'Transthoracic Echocardiogram (TTE) with Doppler',
    diagnosisCode: 'I50.9',
    diagnosisName: 'Heart failure, unspecified',
    status: 'documentation_required',
    urgency: 'standard',
    unitsApproved: 1,
    unitsUsed: 0,
    startDate: '2026-03-10',
    expirationDate: '2026-06-10',
    orderingProvider: 'Dr. Marcus Vance, MD',
    requestDate: '2026-03-06',
    notes: 'Payer requesting last 6 months of cardiology notes and EKG tracing.',
  },
  {
    id: 'pa-5',
    authNumber: 'PA-2026-9925',
    patientId: 'pat-5',
    patientName: 'Martinez, Carlos',
    mrn: 'MRN-44914',
    payerId: 'pyr-4',
    payerName: 'Cigna',
    procedureCode: '45378',
    procedureName: 'Diagnostic Colonoscopy',
    diagnosisCode: 'K52.9',
    diagnosisName: 'Noninfectious gastroenteritis and colitis',
    status: 'approved',
    urgency: 'standard',
    unitsApproved: 1,
    unitsUsed: 0,
    startDate: '2026-02-15',
    expirationDate: '2026-03-17', // Expiring in 7 days
    orderingProvider: 'Dr. Sarah Jenkins, DO',
    requestDate: '2026-02-10',
    notes: 'Expiring soon. Procedure scheduled for March 14, 2026.',
  },
];

const GLOBAL_REFERRALS: any[] = [
  {
    id: 'ref-1',
    referralNumber: 'REF-2026-0041',
    direction: 'outbound',
    patientId: 'pat-1',
    patientName: 'Miller, Eleanor',
    mrn: 'MRN-44910',
    referringProvider: 'Dr. Marcus Vance, MD',
    targetProvider: 'Dr. David Cho, MD',
    specialty: 'Orthopedic Spine Surgery',
    facility: 'Midwest Spine & Joint Institute',
    reason: 'Evaluation for lumbar disc herniation and persistent L4-L5 radicular symptoms.',
    status: 'active',
    referralDate: '2026-03-02',
    appointmentDate: '2026-03-24',
    notes: 'MRI lumbar plain films and encounter notes forwarded electronically.',
  },
  {
    id: 'ref-2',
    referralNumber: 'REF-2026-0042',
    direction: 'outbound',
    patientId: 'pat-1',
    patientName: 'Miller, Eleanor',
    mrn: 'MRN-44910',
    referringProvider: 'Dr. Marcus Vance, MD',
    targetProvider: 'Peak Performance Physical Therapy',
    specialty: 'Physical Therapy',
    facility: 'Peak PT Clinic North',
    reason: 'Lumbar core stabilization and pelvic posture re-education 2x weekly.',
    status: 'active',
    referralDate: '2026-03-02',
    appointmentDate: '2026-03-12',
    notes: 'Prior authorization PA-2026-9922 attached.',
  },
  {
    id: 'ref-3',
    referralNumber: 'REF-2026-0043',
    direction: 'inbound',
    patientId: 'pat-3',
    patientName: 'Davis, Sophia',
    mrn: 'MRN-44912',
    referringProvider: 'Dr. James Wilson, MD (Urgent Care)',
    targetProvider: 'Dr. Marcus Vance, MD',
    specialty: 'Internal Medicine / Cardiology Follow-up',
    facility: 'Orchard Family Practice',
    reason: 'Follow-up for acute exertional dyspnea and blood pressure stabilization.',
    status: 'scheduled',
    referralDate: '2026-03-04',
    appointmentDate: '2026-03-18',
    notes: 'Urgent care discharge summary received.',
  },
];

export function addMockAuthorization(auth: any) {
  GLOBAL_AUTHORIZATIONS.unshift(auth);
}

export function addMockReferral(ref: any) {
  GLOBAL_REFERRALS.unshift(ref);
}

export function getMockAuthorizationsData() {
  const pendingCount = GLOBAL_AUTHORIZATIONS.filter(
    (a) => a.status === 'pending_payer' || a.status === 'documentation_required'
  ).length;
  const approvedCount = GLOBAL_AUTHORIZATIONS.filter((a) => a.status === 'approved').length;
  const expiringCount = GLOBAL_AUTHORIZATIONS.filter((a) => {
    if (!a.expirationDate) return false;
    const diffDays = (new Date(a.expirationDate).getTime() - Date.now()) / (1000 * 3600 * 24);
    return diffDays >= 0 && diffDays <= 14;
  }).length;

  const summary = {
    pendingCount: pendingCount || 14,
    approvedCount: approvedCount || 48,
    expiringCount: expiringCount || 3,
    totalReferrals: GLOBAL_REFERRALS.length + 29,
    atRiskDollarsCents: 6420000,
  };

  const patients = [
    { id: 'pat-1', name: 'Miller, Eleanor', mrn: 'MRN-44910' },
    { id: 'pat-2', name: 'Johnson, Robert', mrn: 'MRN-44911' },
    { id: 'pat-3', name: 'Davis, Sophia', mrn: 'MRN-44912' },
    { id: 'pat-4', name: 'Chen, Michael', mrn: 'MRN-44913' },
    { id: 'pat-5', name: 'Martinez, Carlos', mrn: 'MRN-44914' },
  ];

  const payers = [
    { id: 'pyr-1', name: 'Blue Cross Blue Shield' },
    { id: 'pyr-2', name: 'Aetna Health' },
    { id: 'pyr-3', name: 'UnitedHealthcare' },
    { id: 'pyr-4', name: 'Cigna' },
  ];

  return {
    summary,
    authorizations: [...GLOBAL_AUTHORIZATIONS],
    referrals: [...GLOBAL_REFERRALS],
    patients,
    payers,
  };
}

// ---------------------------------------------------------------------------
// Providers & Clinical Staff Subsystem
// ---------------------------------------------------------------------------

const GLOBAL_PROVIDERS: any[] = [
  {
    id: 'prv-1',
    firstName: 'Marcus',
    lastName: 'Vance',
    credentials: 'MD',
    npi: '1487654321',
    taxonomyCode: '207Q00000X',
    taxonomyDescription: 'Family Medicine Physician',
    licenseNumber: 'IL-036-99214',
    licenseState: 'IL',
    deaNumber: 'BV1487654',
    email: 'mvance@orchardfamily.internal',
    phone: '(555) 234-8901',
    status: 'active',
    billingRole: 'rendering_and_billing',
    practiceIds: ['prac-1', 'prac-2'],
    practiceNames: ['Orchard Family Practice', 'Valley Internal Medicine'],
    acceptingNewPatients: true,
  },
  {
    id: 'prv-2',
    firstName: 'Sarah',
    lastName: 'Jenkins',
    credentials: 'DO',
    npi: '1982736450',
    taxonomyCode: '207R00000X',
    taxonomyDescription: 'Internal Medicine Physician',
    licenseNumber: 'IL-036-88120',
    licenseState: 'IL',
    deaNumber: 'BJ1982736',
    email: 'sjenkins@orchardfamily.internal',
    phone: '(555) 234-8902',
    status: 'active',
    billingRole: 'rendering_and_billing',
    practiceIds: ['prac-1'],
    practiceNames: ['Orchard Family Practice'],
    acceptingNewPatients: true,
  },
  {
    id: 'prv-3',
    firstName: 'Elena',
    lastName: 'Rostova',
    credentials: 'MD',
    npi: '1346798520',
    taxonomyCode: '208D00000X',
    taxonomyDescription: 'General Practice / Urgent Care',
    licenseNumber: 'IL-036-77341',
    licenseState: 'IL',
    deaNumber: 'BR1346798',
    email: 'erostova@westsideurgent.internal',
    phone: '(555) 678-9015',
    status: 'active',
    billingRole: 'rendering_only',
    practiceIds: ['prac-3'],
    practiceNames: ['Westside Urgent Care & Telehealth'],
    acceptingNewPatients: true,
  },
];

export function getMockProvidersData() {
  return {
    providers: [...GLOBAL_PROVIDERS],
  };
}

export function addMockProvider(provider: any) {
  GLOBAL_PROVIDERS.unshift(provider);
}

// ---------------------------------------------------------------------------
// Organization & Practice Setup Subsystem
// ---------------------------------------------------------------------------

const GLOBAL_ORGANIZATION = {
  legalName: 'Orchard Health Systems, LLC',
  dba: 'Orchard Medical & RCM Group',
  taxId: '36-4928190',
  groupNpi: '1982736450',
  taxonomyCode: '193200000X',
  taxonomyDescription: 'Multi-Specialty Group Healthcare Provider',
  phone: '(555) 234-8900',
  fax: '(555) 234-8999',
  email: 'billing@orchardhealth.internal',
  physicalAddress: {
    line1: '100 Medical Center Parkway',
    suite: 'Suite 400',
    city: 'Springfield',
    state: 'IL',
    zip: '62704',
  },
  payToAddress: {
    line1: 'PO Box 88910',
    city: 'Springfield',
    state: 'IL',
    zip: '62791',
  },
};

const GLOBAL_PRACTICES: any[] = [
  {
    id: 'prac-1',
    name: 'Orchard Family Practice',
    code: 'OFP-01',
    posCode: '11',
    posDescription: 'Office',
    cliaNumber: '14D0987654',
    address: '100 Medical Center Pkwy, Suite 400, Springfield, IL 62704',
    phone: '(555) 234-8900',
    isDefaultBilling: true,
    activeClaimsCount: 142,
  },
  {
    id: 'prac-2',
    name: 'Valley Internal Medicine',
    code: 'VIM-02',
    posCode: '11',
    posDescription: 'Office',
    cliaNumber: '14D0987655',
    address: '450 West Valley Boulevard, Suite 210, Springfield, IL 62703',
    phone: '(555) 345-6789',
    isDefaultBilling: false,
    activeClaimsCount: 68,
  },
  {
    id: 'prac-3',
    name: 'Westside Urgent Care & Telehealth',
    code: 'WUC-03',
    posCode: '20',
    posDescription: 'Urgent Care Facility / Telehealth (POS 02/10)',
    cliaNumber: '14D0987656',
    address: '890 Westside Highway, Springfield, IL 62702',
    phone: '(555) 678-9011',
    isDefaultBilling: false,
    activeClaimsCount: 35,
  },
];

export function getMockOrganizationData() {
  return {
    organization: { ...GLOBAL_ORGANIZATION },
    practices: [...GLOBAL_PRACTICES],
  };
}

export function updateMockOrganization(updates: any) {
  Object.assign(GLOBAL_ORGANIZATION, updates);
}

export function addMockPractice(practice: any) {
  GLOBAL_PRACTICES.push(practice);
}

// ---------------------------------------------------------------------------
// Billing & EDI Clearinghouse Setups
// ---------------------------------------------------------------------------

const GLOBAL_EDI_SETTINGS = {
  clearinghouse: 'stedi_rest',
  clearinghouseName: 'Stedi Healthcare Cloud API (Active)',
  submitterId: 'GRV_SUB_99214',
  receiverId: 'STEDI_REC_001',
  isaQualifier: 'ZZ',
  isaSenderId: 'GROVEHEALTH    ',
  isaReceiverId: 'STEDICLEARING  ',
  gsSenderId: 'GROVEHEALTH',
  gsReceiverId: 'STEDICLEARING',
  defaultBillingPracticeId: 'prac-1',
  defaultRenderingProviderId: 'prv-1',
  autoAttachOriginalIcnOnResubmit: true,
  autoConvertFrequency7Replacement: true,
  autoPostEraRemittances: true,
  autoCheckEligibilityOnBooking: true,
  productionMode: false, // test mode
  lastPingAt: new Date(Date.now() - 1000 * 60 * 2),
};

export function getMockEdiSettingsData() {
  return {
    edi: { ...GLOBAL_EDI_SETTINGS },
    practices: [...GLOBAL_PRACTICES],
    providers: [...GLOBAL_PROVIDERS],
  };
}

export function updateMockEdiSettings(updates: any) {
  Object.assign(GLOBAL_EDI_SETTINGS, updates);
}

// ---------------------------------------------------------------------------
// Autonomous Denial Fixation Engine & Custom Rules
// ---------------------------------------------------------------------------

const GLOBAL_DENIAL_RULES: any[] = [
  {
    id: 'rule-denial-1',
    code: 'AUTORULE-01',
    name: 'Telehealth Place of Service (02/10) Modifier 95 Auto-Append',
    triggerCarc: 'CO-4',
    triggerRarc: 'N56',
    description: 'When claim is denied for missing telehealth modifier, automatically appends modifier 95 to eligible E/M CPT codes, changes claim type to Frequency 7 (Replacement), auto-attaches original payer ICN, and queues for instant EDI submission.',
    strategy: 'append_modifier_95_and_resubmit_type_7',
    targetCpt: '99212, 99213, 99214, 99215',
    autoSubmitCorrectedClaim: true,
    autoAttachOriginalIcn: true,
    enabled: true,
    fixesAppliedCount: 38,
    recoveredDollarsCents: 456000,
  },
  {
    id: 'rule-denial-2',
    code: 'AUTORULE-02',
    name: 'Corrected Claim ICN / PCCN Auto-Attachment & Replacement Loop 2300 REF*F8',
    triggerCarc: 'CO-16',
    triggerRarc: 'M20',
    description: 'When submitting a corrected claim for previously adjudicated claim, automatically retrieves original payer claim control number (ICN/CCN) from 835 remittance and injects into Box 22 / Loop 2300 REF*F8 with frequency code 7.',
    strategy: 'auto_attach_icn_and_set_frequency_7',
    targetCpt: 'ALL',
    autoSubmitCorrectedClaim: true,
    autoAttachOriginalIcn: true,
    enabled: true,
    fixesAppliedCount: 64,
    recoveredDollarsCents: 892000,
  },
  {
    id: 'rule-denial-3',
    code: 'AUTORULE-03',
    name: 'Patient Deductible & Coinsurance Automatic Ledger Transfer (PR-1 / PR-2)',
    triggerCarc: 'PR-1',
    triggerRarc: '',
    description: 'When remittance denies insurance payment as patient deductible (PR-1) or copay (PR-3), automatically writes off contractual adjustment (CO-45) and creates a patient responsibility ledger entry.',
    strategy: 'transfer_to_patient_responsibility',
    targetCpt: 'ALL',
    autoSubmitCorrectedClaim: false,
    autoAttachOriginalIcn: false,
    enabled: true,
    fixesAppliedCount: 112,
    recoveredDollarsCents: 1450000,
  },
  {
    id: 'rule-denial-4',
    code: 'AUTORULE-04',
    name: 'Individual Rendering Provider NPI Auto-Reattachment (Box 24J)',
    triggerCarc: 'CO-16',
    triggerRarc: 'MA112',
    description: 'Asserts individual clinician NPI in Loop 2420A / Box 24J when payer policy rejects group-only rendering identifier.',
    strategy: 'attach_individual_rendering_npi',
    targetCpt: 'ALL',
    autoSubmitCorrectedClaim: true,
    autoAttachOriginalIcn: true,
    enabled: true,
    fixesAppliedCount: 19,
    recoveredDollarsCents: 248000,
  },
];

export function getMockDenialRulesData() {
  return {
    rules: [...GLOBAL_DENIAL_RULES],
  };
}

export function addMockDenialRule(rule: any) {
  GLOBAL_DENIAL_RULES.unshift({
    id: `rule-denial-${Date.now()}`,
    code: `CUSTOM-RULE-${Math.floor(100 + Math.random() * 900)}`,
    fixesAppliedCount: 0,
    recoveredDollarsCents: 0,
    enabled: true,
    ...rule,
  });
}

export function toggleMockDenialRule(id: string) {
  const r = GLOBAL_DENIAL_RULES.find((rule) => rule.id === id);
  if (r) r.enabled = !r.enabled;
}

// ---------------------------------------------------------------------------
// Manual Payment Posting Engine (Patient, Copay & Insurance EOB)
// ---------------------------------------------------------------------------

export function postManualPayment({
  postingType, // 'patient_payment' | 'copay_pos' | 'insurance_eob'
  patientId,
  claimId,
  payerId,
  amountCents,
  contractualAdjustmentCents = 0,
  patientResponsibilityCents = 0,
  paymentMethod, // 'card', 'cash', 'check', 'ach', 'eob_check'
  referenceNumber,
  checkDate,
  notes,
}: {
  postingType: string;
  patientId?: string;
  claimId?: string;
  payerId?: string;
  amountCents: number;
  contractualAdjustmentCents?: number;
  patientResponsibilityCents?: number;
  paymentMethod: string;
  referenceNumber?: string;
  checkDate?: string;
  notes?: string;
}) {
  const pmtId = `pmt-${Date.now()}`;
  const pmtNumber = `PMT-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  const paymentRecord = {
    id: pmtId,
    paymentNumber: pmtNumber,
    source:
      postingType === 'insurance_eob'
        ? 'insurance_check'
        : postingType === 'copay_pos'
        ? 'patient_cash'
        : 'patient_card',
    amountCents,
    allocatedCents: amountCents,
    unallocatedCents: 0,
    status: 'settled',
    referenceNumber: referenceNumber || `REF-${Date.now()}`,
    method:
      paymentMethod === 'cash'
        ? 'Cash Point-of-Care Copay'
        : paymentMethod === 'check'
        ? `Paper Check #${referenceNumber ?? '1001'}`
        : paymentMethod === 'card'
        ? 'Visa Card •••• 4242'
        : paymentMethod === 'ach'
        ? 'ACH Electronic Transfer'
        : `Insurance Remittance (${referenceNumber ?? 'EOB-Check'})`,
    postedAt: new Date(),
    patientName: patientId === 'pat-2' ? 'Johnson, Robert' : 'Miller, Eleanor',
    mrn: patientId === 'pat-2' ? 'MRN-44911' : 'MRN-44910',
    patientId: patientId || 'pat-1',
    claimNumber: claimId ? 'CLM-2026-0101' : null,
    practiceName: 'Orchard Family Practice',
    notes: notes || `Manual ${postingType.replace(/_/g, ' ')} posted`,
  };

  addMockPayment(paymentRecord);
  return paymentRecord;
}

// ---------------------------------------------------------------------------
// Claim Status Inquiries & Responses (276/277) Subsystem
// ---------------------------------------------------------------------------

const GLOBAL_CLAIM_STATUSES: any[] = [
  {
    id: 'st-1',
    inquiryNumber: 'INQ-2026-0412',
    claimNumber: 'CLM-2026-0101',
    claimId: 'clm-demo-1',
    patientName: 'Miller, Eleanor',
    mrn: 'MRN-44910',
    payerName: 'Blue Cross Blue Shield',
    payerId: '00010',
    serviceDate: '2026-03-01',
    totalChargeCents: 45000,
    statusCategory: 'A1',
    statusCategoryLabel: 'Acknowledged / In Process',
    statusCode: '19',
    statusDescription: 'Entity acknowledges receipt of claim/encounter. Claim is actively in adjudication queue.',
    traceNumber: 'TRC-STAT-88910',
    lastCheckedAt: new Date(Date.now() - 1000 * 60 * 18),
    nextAction: 'Expected adjudication within 48 hours. No action required.',
  },
  {
    id: 'st-2',
    inquiryNumber: 'INQ-2026-0413',
    claimNumber: 'CLM-2026-0102',
    claimId: 'clm-demo-2',
    patientName: 'Johnson, Robert',
    mrn: 'MRN-44911',
    payerName: 'Aetna Health',
    payerId: '00020',
    serviceDate: '2026-03-02',
    totalChargeCents: 120000,
    statusCategory: 'A2',
    statusCategoryLabel: 'Adjudicated as Paid',
    statusCode: '20',
    statusDescription: 'Payment issued via EFT #889120. Remittance advice 835 available for balance reconciliation.',
    traceNumber: 'TRC-STAT-88911',
    lastCheckedAt: new Date(Date.now() - 1000 * 60 * 45),
    nextAction: 'Ready to post remittance advice.',
  },
  {
    id: 'st-3',
    inquiryNumber: 'INQ-2026-0414',
    claimNumber: 'CLM-2026-0103',
    claimId: 'clm-demo-3',
    patientName: 'Davis, Sophia',
    mrn: 'MRN-44912',
    payerName: 'UnitedHealthcare',
    payerId: '00030',
    serviceDate: '2026-03-03',
    totalChargeCents: 35000,
    statusCategory: 'A4',
    statusCategoryLabel: 'Denied / Payer Exception',
    statusCode: '4',
    statusDescription: 'Missing procedure modifier 95 for place of service 02 (Telehealth). Corrected claim required.',
    traceNumber: 'TRC-STAT-88912',
    lastCheckedAt: new Date(Date.now() - 1000 * 60 * 85),
    nextAction: 'Auto-denial rule AUTORULE-01 available to auto-fix and resubmit.',
  },
  {
    id: 'st-4',
    inquiryNumber: 'INQ-2026-0415',
    claimNumber: 'CLM-2026-0104',
    claimId: 'clm-demo-4',
    patientName: 'Chen, Michael',
    mrn: 'MRN-44913',
    payerName: 'Cigna',
    payerId: '00040',
    serviceDate: '2026-03-04',
    totalChargeCents: 28000,
    statusCategory: 'A1',
    statusCategoryLabel: 'Acknowledged / In Process',
    statusCode: '19',
    statusDescription: 'Claim accepted into clearinghouse processing system.',
    traceNumber: 'TRC-STAT-88913',
    lastCheckedAt: new Date(Date.now() - 1000 * 60 * 120),
    nextAction: 'Auto-tracking active.',
  },
];

export function getMockClaimStatusData() {
  const inProcessCount = GLOBAL_CLAIM_STATUSES.filter((s) => s.statusCategory === 'A1').length;
  const paidCount = GLOBAL_CLAIM_STATUSES.filter((s) => s.statusCategory === 'A2').length;
  const deniedCount = GLOBAL_CLAIM_STATUSES.filter((s) => s.statusCategory === 'A4').length;

  const summary = {
    totalInquiries: GLOBAL_CLAIM_STATUSES.length + 38,
    inProcessCount: inProcessCount + 24,
    paidCount: paidCount + 12,
    deniedCount: deniedCount + 2,
    automatedChecksToday: 42,
  };

  return {
    summary,
    statuses: [...GLOBAL_CLAIM_STATUSES],
  };
}

// ---------------------------------------------------------------------------
// Unified Batch Management Subsystem (Claims, Payments, Eligibility)
// ---------------------------------------------------------------------------

const GLOBAL_BATCHES: any[] = [
  {
    id: 'batch-clm-1',
    type: 'claims_837p',
    batchNumber: 'BATCH-837P-2026-0081',
    practiceName: 'Orchard Family Practice',
    itemCount: 24,
    totalAmountCents: 4820000,
    status: 'accepted_999',
    clearinghouseStatus: 'ACK-999 Functional Acknowledgment Received',
    createdAt: new Date(Date.now() - 3600000 * 4),
    releasedAt: new Date(Date.now() - 3600000 * 3),
    releasedBy: 'Autonomous Clearinghouse Bot',
  },
  {
    id: 'batch-clm-2',
    type: 'claims_837p',
    batchNumber: 'BATCH-837P-2026-0082',
    practiceName: 'Valley Internal Medicine',
    itemCount: 12,
    totalAmountCents: 1945000,
    status: 'ready_for_release',
    clearinghouseStatus: 'Scrubbed 100% Clean — Pending Release',
    createdAt: new Date(Date.now() - 3600000 * 1),
    releasedAt: null,
    releasedBy: null,
  },
  {
    id: 'batch-pmt-1',
    type: 'payments',
    batchNumber: 'BATCH-PMT-2026-0034',
    practiceName: 'All Practices (Combined POS)',
    itemCount: 42,
    totalAmountCents: 342000, // $3,420.00
    status: 'settled',
    clearinghouseStatus: 'Credit Card & Point of Care Gateway Batch Closed',
    createdAt: new Date(Date.now() - 3600000 * 6),
    releasedAt: new Date(Date.now() - 3600000 * 2),
    releasedBy: 'Front Desk & Merchant Autopilot',
  },
  {
    id: 'batch-pmt-2',
    type: 'payments',
    batchNumber: 'BATCH-ERA-2026-0012',
    practiceName: 'Orchard Health Systems',
    itemCount: 3,
    totalAmountCents: 1425000, // $14,250.00
    status: 'balanced',
    clearinghouseStatus: '835 ERA Electronic Remittances Adjudicated',
    createdAt: new Date(Date.now() - 86400000 * 1),
    releasedAt: new Date(Date.now() - 86400000 * 1 + 3600000),
    releasedBy: 'Auto-Balancing Engine',
  },
  {
    id: 'batch-eli-1',
    type: 'eligibility_270',
    batchNumber: 'BATCH-270-2026-0309',
    practiceName: 'All Practices (Tomorrow Schedule)',
    itemCount: 68,
    totalAmountCents: 0,
    status: 'completed',
    clearinghouseStatus: '94% Active Coverage Confirmed (64/68)',
    createdAt: new Date(Date.now() - 3600000 * 8),
    releasedAt: new Date(Date.now() - 3600000 * 7),
    releasedBy: 'Daily Eligibility Cron Job',
  },
];

export function getMockBatchesData() {
  const claimsBatches = GLOBAL_BATCHES.filter((b) => b.type === 'claims_837p');
  const paymentBatches = GLOBAL_BATCHES.filter((b) => b.type === 'payments');
  const eligibilityBatches = GLOBAL_BATCHES.filter((b) => b.type === 'eligibility_270');

  const summary = {
    totalBatchesToday: GLOBAL_BATCHES.length,
    openClaimBatches: claimsBatches.filter((b) => b.status === 'ready_for_release').length,
    settledPaymentCents: 342000,
    totalAdjudicatedCents: 1425000,
    eligibilityVerifiedCount: 68,
  };

  return {
    summary,
    batches: [...GLOBAL_BATCHES],
    claimsBatches,
    paymentBatches,
    eligibilityBatches,
  };
}

export function mergeMockPatients(primaryId: string, duplicateId: string) {
  // Move SOAP notes
  if (GLOBAL_SOAP_NOTES[duplicateId]) {
    if (!GLOBAL_SOAP_NOTES[primaryId]) GLOBAL_SOAP_NOTES[primaryId] = [];
    GLOBAL_SOAP_NOTES[primaryId].push(...GLOBAL_SOAP_NOTES[duplicateId]);
    delete GLOBAL_SOAP_NOTES[duplicateId];
  }
  // Move documents
  if (GLOBAL_DOCUMENTS[duplicateId]) {
    if (!GLOBAL_DOCUMENTS[primaryId]) GLOBAL_DOCUMENTS[primaryId] = [];
    GLOBAL_DOCUMENTS[primaryId].push(...GLOBAL_DOCUMENTS[duplicateId]);
    delete GLOBAL_DOCUMENTS[duplicateId];
  }
  // Move payments
  GLOBAL_PAYMENTS.forEach((p) => {
    if (p.patientId === duplicateId) {
      p.patientId = primaryId;
    }
  });
  // Move authorizations
  GLOBAL_AUTHORIZATIONS.forEach((a) => {
    if (a.patientId === duplicateId) {
      a.patientId = primaryId;
    }
  });
  // Move referrals
  GLOBAL_REFERRALS.forEach((r) => {
    if (r.patientId === duplicateId) {
      r.patientId = primaryId;
    }
  });
}

const GLOBAL_CLAIM_OVERRIDES: Record<string, any> = {};

export function updateMockClaimFiling(claimId: string, params: any) {
  GLOBAL_CLAIM_OVERRIDES[claimId] = {
    ...(GLOBAL_CLAIM_OVERRIDES[claimId] ?? {}),
    ...params,
  };
}

// ---------------------------------------------------------------------------
// Claim Notes, Patient Alerts & Payer Alerts Storage
// ---------------------------------------------------------------------------

const GLOBAL_CLAIM_NOTES: Record<string, any[]> = {
  'clm-demo-1': [
    {
      id: 'cn-1',
      category: 'Summary Note',
      author: 'Dr. Marcus Vance, MD',
      authorRole: 'Attending Physician',
      content: 'Patient evaluated for acute low back strain after lifting heavy soil. Conservative management started with Cyclobenzaprine and Naproxen. Ordered 2-view lumbar radiographs. Operative notes and chart documentation attached to claim.',
      createdAt: new Date(Date.now() - 86400000 * 3),
    },
    {
      id: 'cn-2',
      category: 'Claim Note',
      author: 'Alex Rivera',
      authorRole: 'Senior Biller',
      content: 'Initial submission sent via Stedi Clearinghouse. ISA Control #10029381. ST Control #0001. Awaiting adjudication.',
      createdAt: new Date(Date.now() - 86400000 * 2),
    },
    {
      id: 'cn-3',
      category: 'Denial Follow-up',
      author: 'Grove Autopilot',
      authorRole: 'Autonomous RCM Engine',
      content: 'Electronic 835 Remittance parsed with Claim Adjustment Reason Code CO-96. CPT 99214 was billed with CPT 73030 without modifier 25. Generated corrected claim Type 7 with modifier 25 appended.',
      createdAt: new Date(Date.now() - 86400000 * 1),
    },
  ],
};

export function getMockClaimNotes(claimId: string) {
  return GLOBAL_CLAIM_NOTES[claimId] ?? [
    {
      id: `cn-${Date.now()}`,
      category: 'Claim Note',
      author: 'Billing Operator',
      authorRole: 'RCM Team',
      content: 'Claim under active review in billing work queue.',
      createdAt: new Date(Date.now() - 86400000),
    }
  ];
}

export function addMockClaimNote(claimId: string, note: { category: string; content: string; author?: string; authorRole?: string }) {
  if (!GLOBAL_CLAIM_NOTES[claimId]) {
    GLOBAL_CLAIM_NOTES[claimId] = [];
  }
  const newNote = {
    id: `cn-${Date.now()}`,
    category: note.category || 'Claim Note',
    author: note.author || 'Alex Rivera',
    authorRole: note.authorRole || 'Senior Biller',
    content: note.content,
    createdAt: new Date(),
  };
  GLOBAL_CLAIM_NOTES[claimId].unshift(newNote);
  return newNote;
}

const GLOBAL_PATIENT_ALERTS: Record<string, any> = {
  'pat-1': {
    id: 'pa-1',
    patientId: 'pat-1',
    patientName: 'Eleanor Miller',
    mrn: 'MRN-44910',
    text: 'Patient has an outstanding personal balance of $120.00 from 2025. Please verify primary coverage and collect co-pay before refiling claims.',
    severity: 'warning',
    setBy: 'Billing Department (Sarah Jenkins)',
    setDate: '2026-03-02',
    dismissed: false,
  },
};

export function getMockPatientAlert(patientId: string) {
  return GLOBAL_PATIENT_ALERTS[patientId] ?? null;
}

export function dismissMockPatientAlert(patientId: string) {
  if (GLOBAL_PATIENT_ALERTS[patientId]) {
    GLOBAL_PATIENT_ALERTS[patientId].dismissed = true;
  }
}

const GLOBAL_INSURANCE_ALERTS: Record<string, any> = {
  'pyr-1': {
    id: 'ia-1',
    payerName: 'Blue Cross Blue Shield',
    text: 'BCBS Policy Update: Musculoskeletal plain imaging (CPT 73030) billed concurrently with E/M (99214) requires distinct documentation with Modifier 25. Timely filing window: 180 days from Date of Service.',
    severity: 'info',
  },
};

export function getMockInsuranceAlert(payerId: string) {
  return GLOBAL_INSURANCE_ALERTS[payerId] ?? null;
}

const GLOBAL_CLAIM_ALERTS: Record<string, any> = {
  'clm-demo-1': {
    id: 'cla-1',
    claimId: 'clm-demo-1',
    text: 'URGENT: Claim denied under CO-96. Payer timely filing window closes on 03/25/2026. Submit corrected claim (Frequency 7) or appeal with clinical chart notes.',
    severity: 'danger',
    setBy: 'Grove Autopilot Scrubber',
    setDate: '2026-03-06',
  },
};

export function getMockClaimAlert(claimId: string) {
  return GLOBAL_CLAIM_ALERTS[claimId] ?? null;
}


// ---------------------------------------------------------------------------
// Fee Schedule, CPT & Dx Management (eCW-style)
// ---------------------------------------------------------------------------

const GLOBAL_FEE_SCHEDULES: any[] = [
  {
    id: 'fs-1',
    name: 'Standard Commercial Chargemaster',
    scheduleType: 'charge',
    payerName: 'Default Standard Chargemaster',
    effectiveDate: '2026-01-01',
    terminationDate: '2026-12-31',
    isDefault: true,
    linesCount: 12,
    status: 'active',
    notes: 'Default master chargemaster pricing for commercial and non-contracted billing. Claims with DOS in 2026 default to this schedule.',
  },
  {
    id: 'fs-2',
    name: 'Medicare Part B Illinois (Locality 01)',
    scheduleType: 'medicare',
    payerName: 'Medicare Part B Illinois',
    effectiveDate: '2026-01-01',
    terminationDate: null,
    isDefault: false,
    linesCount: 12,
    status: 'active',
    notes: 'CMS 2026 Physician Fee Schedule (MPFS) Geographic Locality 01. Applies to claims with DOS >= 01/01/2026.',
  },
  {
    id: 'fs-3',
    name: 'Blue Cross Blue Shield PPO Contract Rate',
    scheduleType: 'allowed',
    payerName: 'Blue Cross Blue Shield',
    effectiveDate: '2025-07-01',
    terminationDate: '2027-06-30',
    isDefault: false,
    linesCount: 10,
    status: 'active',
    notes: 'BCBS Commercial PPO Network Provider Contract #BC-9901 (DOS: 07/01/2025 through 06/30/2027).',
  },
  {
    id: 'fs-4',
    name: 'Aetna Managed Care HMO Fee Schedule',
    scheduleType: 'allowed',
    payerName: 'Aetna Health',
    effectiveDate: '2025-01-01',
    terminationDate: '2026-12-31',
    isDefault: false,
    linesCount: 8,
    status: 'active',
    notes: 'Aetna Signature Administrators HMO fee schedule. Valid for claims with DOS through 12/31/2026.',
  },
  {
    id: 'fs-5',
    name: 'Community Sliding Fee / Self-Pay Scale',
    scheduleType: 'charge',
    payerName: 'Uninsured / Self-Pay Patients',
    effectiveDate: '2026-01-01',
    terminationDate: null,
    isDefault: false,
    linesCount: 12,
    status: 'active',
    notes: 'Prompt pay 40% discount for uninsured patients paid at time of service.',
  },
];

const GLOBAL_FEE_SCHEDULE_LINES: any[] = [
  {
    id: 'fsl-1',
    feeScheduleId: 'fs-1',
    procedureCode: '99213',
    modifier1: null,
    description: 'Office/outpatient visit, est patient, 20-29 min, low MDM',
    nonFacilityRateCents: 9250,
    facilityRateCents: 6800,
    standardBilledCents: 18500,
    workRvu: 1.30,
    totalRvu: 2.70,
    effectiveDate: '2026-01-01',
  },
  {
    id: 'fsl-2',
    feeScheduleId: 'fs-1',
    procedureCode: '99214',
    modifier1: null,
    description: 'Office/outpatient visit, est patient, 30-39 min, moderate MDM',
    nonFacilityRateCents: 13600,
    facilityRateCents: 10200,
    standardBilledCents: 27500,
    workRvu: 1.92,
    totalRvu: 3.96,
    effectiveDate: '2026-01-01',
  },
  {
    id: 'fsl-3',
    feeScheduleId: 'fs-1',
    procedureCode: '99215',
    modifier1: null,
    description: 'Office/outpatient visit, est patient, 40-54 min, high MDM',
    nonFacilityRateCents: 18900,
    facilityRateCents: 14800,
    standardBilledCents: 38000,
    workRvu: 2.80,
    totalRvu: 5.50,
    effectiveDate: '2026-01-01',
  },
  {
    id: 'fsl-4',
    feeScheduleId: 'fs-1',
    procedureCode: '99203',
    modifier1: null,
    description: 'Office/outpatient visit, new patient, 30-44 min, low MDM',
    nonFacilityRateCents: 11800,
    facilityRateCents: 8500,
    standardBilledCents: 24000,
    workRvu: 1.60,
    totalRvu: 3.44,
    effectiveDate: '2026-01-01',
  },
  {
    id: 'fsl-5',
    feeScheduleId: 'fs-1',
    procedureCode: '99204',
    modifier1: null,
    description: 'Office/outpatient visit, new patient, 45-59 min, moderate MDM',
    nonFacilityRateCents: 17800,
    facilityRateCents: 13800,
    standardBilledCents: 36000,
    workRvu: 2.60,
    totalRvu: 5.18,
    effectiveDate: '2026-01-01',
  },
  {
    id: 'fsl-6',
    feeScheduleId: 'fs-1',
    procedureCode: '99395',
    modifier1: null,
    description: 'Periodic comprehensive preventive medicine reeval, 18-39 yrs',
    nonFacilityRateCents: 15500,
    facilityRateCents: 12000,
    standardBilledCents: 31000,
    workRvu: 2.00,
    totalRvu: 4.50,
    effectiveDate: '2026-01-01',
  },
  {
    id: 'fsl-7',
    feeScheduleId: 'fs-1',
    procedureCode: '80053',
    modifier1: null,
    description: 'Comprehensive metabolic panel (CMP)',
    nonFacilityRateCents: 1450,
    facilityRateCents: 1450,
    standardBilledCents: 4500,
    workRvu: 0.00,
    totalRvu: 0.42,
    effectiveDate: '2026-01-01',
  },
  {
    id: 'fsl-8',
    feeScheduleId: 'fs-1',
    procedureCode: '85025',
    modifier1: null,
    description: 'Complete blood count (CBC) w/ automated differential',
    nonFacilityRateCents: 1080,
    facilityRateCents: 1080,
    standardBilledCents: 3500,
    workRvu: 0.00,
    totalRvu: 0.31,
    effectiveDate: '2026-01-01',
  },
  {
    id: 'fsl-9',
    feeScheduleId: 'fs-1',
    procedureCode: '96372',
    modifier1: null,
    description: 'Therapeutic/prophylactic/diagnostic injection, SC/IM',
    nonFacilityRateCents: 2400,
    facilityRateCents: 1200,
    standardBilledCents: 6500,
    workRvu: 0.17,
    totalRvu: 0.70,
    effectiveDate: '2026-01-01',
  },
  {
    id: 'fsl-10',
    feeScheduleId: 'fs-1',
    procedureCode: '99441',
    modifier1: null,
    description: 'Telephone E&M service by physician/QHP, 5-10 min',
    nonFacilityRateCents: 5600,
    facilityRateCents: 4200,
    standardBilledCents: 12000,
    workRvu: 0.75,
    totalRvu: 1.63,
    effectiveDate: '2026-01-01',
  },
  {
    id: 'fsl-11',
    feeScheduleId: 'fs-1',
    procedureCode: '99214',
    modifier1: '95',
    description: 'Telehealth E&M with synchronous real-time audio/video',
    nonFacilityRateCents: 13600,
    facilityRateCents: 10200,
    standardBilledCents: 27500,
    workRvu: 1.92,
    totalRvu: 3.96,
    effectiveDate: '2026-01-01',
  },
  {
    id: 'fsl-12',
    feeScheduleId: 'fs-1',
    procedureCode: '36415',
    modifier1: null,
    description: 'Routine venipuncture (blood draw collection)',
    nonFacilityRateCents: 300,
    facilityRateCents: 300,
    standardBilledCents: 2000,
    workRvu: 0.00,
    totalRvu: 0.09,
    effectiveDate: '2026-01-01',
  },
];

const GLOBAL_CPT_CODES: any[] = [
  {
    code: '99213',
    codeSystem: 'CPT',
    description: 'Office or other outpatient visit for the evaluation and management of an established patient, 20-29 minutes, low level of medical decision making',
    category: 'Evaluation & Management',
    globalDays: '0',
    isAddOn: false,
    workRvu: 1.30,
    totalRvu: 2.70,
    defaultChargeCents: 18500,
    allowedPlacesOfService: ['11 (Office)', '02 (Telehealth)', '10 (Telehealth Home)'],
    status: 'active',
  },
  {
    code: '99214',
    codeSystem: 'CPT',
    description: 'Office or other outpatient visit for the evaluation and management of an established patient, 30-39 minutes, moderate level of medical decision making',
    category: 'Evaluation & Management',
    globalDays: '0',
    isAddOn: false,
    workRvu: 1.92,
    totalRvu: 3.96,
    defaultChargeCents: 27500,
    allowedPlacesOfService: ['11 (Office)', '02 (Telehealth)', '10 (Telehealth Home)'],
    status: 'active',
  },
  {
    code: '99215',
    codeSystem: 'CPT',
    description: 'Office or other outpatient visit for the evaluation and management of an established patient, 40-54 minutes, high level of medical decision making',
    category: 'Evaluation & Management',
    globalDays: '0',
    isAddOn: false,
    workRvu: 2.80,
    totalRvu: 5.50,
    defaultChargeCents: 38000,
    allowedPlacesOfService: ['11 (Office)', '02 (Telehealth)', '10 (Telehealth Home)'],
    status: 'active',
  },
  {
    code: '99203',
    codeSystem: 'CPT',
    description: 'Office or other outpatient visit for the evaluation and management of a new patient, 30-44 minutes, low level of medical decision making',
    category: 'Evaluation & Management',
    globalDays: '0',
    isAddOn: false,
    workRvu: 1.60,
    totalRvu: 3.44,
    defaultChargeCents: 24000,
    allowedPlacesOfService: ['11 (Office)', '02 (Telehealth)'],
    status: 'active',
  },
  {
    code: '99204',
    codeSystem: 'CPT',
    description: 'Office or other outpatient visit for the evaluation and management of a new patient, 45-59 minutes, moderate level of medical decision making',
    category: 'Evaluation & Management',
    globalDays: '0',
    isAddOn: false,
    workRvu: 2.60,
    totalRvu: 5.18,
    defaultChargeCents: 36000,
    allowedPlacesOfService: ['11 (Office)', '02 (Telehealth)'],
    status: 'active',
  },
  {
    code: '99395',
    codeSystem: 'CPT',
    description: 'Periodic comprehensive preventive medicine reevaluation and management, established patient; 18-39 years',
    category: 'Preventive Medicine',
    globalDays: '0',
    isAddOn: false,
    workRvu: 2.00,
    totalRvu: 4.50,
    defaultChargeCents: 31000,
    allowedPlacesOfService: ['11 (Office)'],
    status: 'active',
  },
  {
    code: '80053',
    codeSystem: 'CPT',
    description: 'Comprehensive metabolic panel (Albumin, Bilirubin, Calcium, Carbon dioxide, Chloride, Creatinine, Glucose, Phosphatase, Potassium, Protein, Sodium, AST, ALT, Urea nitrogen)',
    category: 'Laboratory & Pathology',
    globalDays: 'XXX',
    isAddOn: false,
    workRvu: 0.00,
    totalRvu: 0.42,
    defaultChargeCents: 4500,
    allowedPlacesOfService: ['11 (Office)', '81 (Independent Lab)'],
    status: 'active',
  },
  {
    code: '85025',
    codeSystem: 'CPT',
    description: 'Blood count; complete (CBC), automated (Hgb, Hct, RBC, WBC and platelet count) and automated differential WBC count',
    category: 'Laboratory & Pathology',
    globalDays: 'XXX',
    isAddOn: false,
    workRvu: 0.00,
    totalRvu: 0.31,
    defaultChargeCents: 3500,
    allowedPlacesOfService: ['11 (Office)', '81 (Independent Lab)'],
    status: 'active',
  },
  {
    code: '96372',
    codeSystem: 'CPT',
    description: 'Therapeutic, prophylactic, or diagnostic injection; subcutaneous or intramuscular',
    category: 'Medicine & Injections',
    globalDays: '0',
    isAddOn: false,
    workRvu: 0.17,
    totalRvu: 0.70,
    defaultChargeCents: 6500,
    allowedPlacesOfService: ['11 (Office)'],
    status: 'active',
  },
  {
    code: '99441',
    codeSystem: 'CPT',
    description: 'Telephone evaluation and management service by a physician or other qualified health care professional; 5-10 minutes',
    category: 'Telehealth',
    globalDays: '0',
    isAddOn: false,
    workRvu: 0.75,
    totalRvu: 1.63,
    defaultChargeCents: 12000,
    allowedPlacesOfService: ['02 (Telehealth)', '10 (Telehealth Home)'],
    status: 'active',
  },
  {
    code: '36415',
    codeSystem: 'CPT',
    description: 'Routine collection of venous blood by venipuncture',
    category: 'Medicine & Injections',
    globalDays: 'XXX',
    isAddOn: false,
    workRvu: 0.00,
    totalRvu: 0.09,
    defaultChargeCents: 2000,
    allowedPlacesOfService: ['11 (Office)'],
    status: 'active',
  },
  {
    code: '93000',
    codeSystem: 'CPT',
    description: 'Electrocardiogram, routine ECG with at least 12 leads; with interpretation and report',
    category: 'Cardiology',
    globalDays: '0',
    isAddOn: false,
    workRvu: 0.17,
    totalRvu: 0.65,
    defaultChargeCents: 8500,
    allowedPlacesOfService: ['11 (Office)', '22 (Hospital Outpatient)'],
    status: 'active',
  },
  {
    code: 'G0438',
    codeSystem: 'HCPCS',
    description: 'Annual wellness visit; includes a personalized prevention plan of service (PPPS), first visit',
    category: 'Preventive Medicine',
    globalDays: '0',
    isAddOn: false,
    workRvu: 2.43,
    totalRvu: 4.98,
    defaultChargeCents: 34000,
    allowedPlacesOfService: ['11 (Office)', '02 (Telehealth)'],
    status: 'active',
  },
  {
    code: 'G0439',
    codeSystem: 'HCPCS',
    description: 'Annual wellness visit, includes a personalized prevention plan of service (PPPS), subsequent visit',
    category: 'Preventive Medicine',
    globalDays: '0',
    isAddOn: false,
    workRvu: 1.50,
    totalRvu: 3.20,
    defaultChargeCents: 25000,
    allowedPlacesOfService: ['11 (Office)', '02 (Telehealth)'],
    status: 'active',
  },
];

const GLOBAL_DX_CODES: any[] = [
  {
    code: 'E11.9',
    description: 'Type 2 diabetes mellitus without complications',
    category: 'Endocrine & Metabolic',
    billable: true,
    validAsPrincipal: true,
    favorite: true,
    dualCodingNote: 'Use additional code to identify control: Z79.4 (insulin), Z79.84 (oral hypoglycemic)',
  },
  {
    code: 'E11.65',
    description: 'Type 2 diabetes mellitus with hyperglycemia',
    category: 'Endocrine & Metabolic',
    billable: true,
    validAsPrincipal: true,
    favorite: true,
    dualCodingNote: 'Code first underlying diabetes condition',
  },
  {
    code: 'I10',
    description: 'Essential (primary) hypertension',
    category: 'Cardiovascular',
    billable: true,
    validAsPrincipal: true,
    favorite: true,
    dualCodingNote: 'Excludes: hypertensive heart disease (I11.-), hypertensive kidney disease (I12.-)',
  },
  {
    code: 'I25.10',
    description: 'Atherosclerotic heart disease of native coronary artery without angina pectoris',
    category: 'Cardiovascular',
    billable: true,
    validAsPrincipal: true,
    favorite: false,
    dualCodingNote: 'Includes coronary artery disease (CAD)',
  },
  {
    code: 'J06.9',
    description: 'Acute upper respiratory infection, unspecified',
    category: 'Respiratory',
    billable: true,
    validAsPrincipal: true,
    favorite: true,
    dualCodingNote: 'Common cold, viral upper respiratory illness',
  },
  {
    code: 'J45.909',
    description: 'Unspecified asthma, uncomplicated',
    category: 'Respiratory',
    billable: true,
    validAsPrincipal: true,
    favorite: true,
    dualCodingNote: 'Reactive airway disease / asthma NOS',
  },
  {
    code: 'M54.50',
    description: 'Low back pain, unspecified',
    category: 'Musculoskeletal',
    billable: true,
    validAsPrincipal: true,
    favorite: true,
    dualCodingNote: 'Lumbago, acute or chronic mechanical lower back discomfort',
  },
  {
    code: 'M25.561',
    description: 'Pain in right knee',
    category: 'Musculoskeletal',
    billable: true,
    validAsPrincipal: false,
    favorite: false,
    dualCodingNote: 'Laterality specified: Right knee',
  },
  {
    code: 'Z00.00',
    description: 'Encounter for general adult medical examination without abnormal findings',
    category: 'Preventive Medicine',
    billable: true,
    validAsPrincipal: true,
    favorite: true,
    dualCodingNote: 'Annual routine health checkup / preventive physical',
  },
  {
    code: 'Z23',
    description: 'Encounter for immunization',
    category: 'Preventive Medicine',
    billable: true,
    validAsPrincipal: false,
    favorite: false,
    dualCodingNote: 'Code as secondary diagnosis with vaccine administration',
  },
  {
    code: 'F41.1',
    description: 'Generalized anxiety disorder',
    category: 'Behavioral Health',
    billable: true,
    validAsPrincipal: true,
    favorite: true,
    dualCodingNote: 'Anxiety neurosis / chronic persistent anxiety',
  },
  {
    code: 'K21.9',
    description: 'Gastro-esophageal reflux disease without esophagitis',
    category: 'Gastrointestinal',
    billable: true,
    validAsPrincipal: true,
    favorite: true,
    dualCodingNote: 'GERD, acid reflux without mucosal damage',
  },
  {
    code: 'E78.5',
    description: 'Hyperlipidemia, unspecified',
    category: 'Endocrine & Metabolic',
    billable: true,
    validAsPrincipal: true,
    favorite: true,
    dualCodingNote: 'Elevated cholesterol / mixed dyslipidemia',
  },
  {
    code: 'N39.0',
    description: 'Urinary tract infection, site not specified',
    category: 'Genitourinary',
    billable: true,
    validAsPrincipal: true,
    favorite: true,
    dualCodingNote: 'Cystitis / acute UTI; use additional code (B95-B97) to identify infectious organism',
  },
  {
    code: 'R05.9',
    description: 'Cough, unspecified',
    category: 'Symptoms & Signs',
    billable: true,
    validAsPrincipal: true,
    favorite: false,
    dualCodingNote: 'Symptom coding when underlying etiology not yet established',
  },
];

export function getMockFeeSchedulesData() {
  return {
    feeSchedules: [...GLOBAL_FEE_SCHEDULES],
    feeScheduleLines: [...GLOBAL_FEE_SCHEDULE_LINES],
    cptCodes: [...GLOBAL_CPT_CODES],
    dxCodes: [...GLOBAL_DX_CODES],
  };
}

export function addMockFeeSchedule(params: any) {
  GLOBAL_FEE_SCHEDULES.unshift({
    id: `fs-${Date.now()}`,
    name: params.name || 'New Payer Fee Schedule',
    scheduleType: params.scheduleType || 'allowed',
    payerName: params.payerName || 'Commercial Payer',
    effectiveDate: params.effectiveDate || new Date().toISOString().split('T')[0],
    terminationDate: params.terminationDate || null,
    linesCount: 0,
    status: 'active',
    notes: params.notes || 'Created via Fee Schedule Manager',
  });
}

export function addMockCptCode(params: any) {
  GLOBAL_CPT_CODES.unshift({
    code: params.code,
    codeSystem: params.codeSystem || 'CPT',
    description: params.description,
    category: params.category || 'Evaluation & Management',
    globalDays: params.globalDays || '0',
    isAddOn: params.isAddOn === 'true' || params.isAddOn === true,
    workRvu: Number(params.workRvu || 1.0),
    totalRvu: Number(params.totalRvu || 2.5),
    defaultChargeCents: Math.round(Number(params.charge || 150) * 100),
    allowedPlacesOfService: ['11 (Office)'],
    status: 'active',
  });
}

export function addMockDxCode(params: any) {
  GLOBAL_DX_CODES.unshift({
    code: params.code,
    description: params.description,
    category: params.category || 'General Medicine',
    billable: true,
    validAsPrincipal: params.validAsPrincipal !== false,
    favorite: params.favorite === true || params.favorite === 'true',
    dualCodingNote: params.dualCodingNote || null,
  });
}

export function setDefaultFeeSchedule(id: string) {
  GLOBAL_FEE_SCHEDULES.forEach((fs) => {
    fs.isDefault = fs.id === id;
  });
}

export function updateFeeScheduleTenure(
  id: string,
  params: {
    effectiveDate?: string;
    terminationDate?: string | null;
    isDefault?: boolean;
    notes?: string;
    name?: string;
    payerName?: string;
    scheduleType?: string;
  }
) {
  const fs = GLOBAL_FEE_SCHEDULES.find((s) => s.id === id);
  if (fs) {
    if (params.effectiveDate) fs.effectiveDate = params.effectiveDate;
    if (params.terminationDate !== undefined) fs.terminationDate = params.terminationDate || null;
    if (params.notes !== undefined) fs.notes = params.notes;
    if (params.name) fs.name = params.name;
    if (params.payerName) fs.payerName = params.payerName;
    if (params.scheduleType) fs.scheduleType = params.scheduleType;
    if (params.isDefault) {
      GLOBAL_FEE_SCHEDULES.forEach((s) => {
        s.isDefault = s.id === id;
      });
    }
  }
}

export function cloneMockFeeSchedule(id: string) {
  const source = GLOBAL_FEE_SCHEDULES.find((s) => s.id === id);
  if (source) {
    const newId = `fs-${Date.now()}`;
    const clone = {
      ...source,
      id: newId,
      name: `${source.name} (Copy)`,
      isDefault: false,
      effectiveDate: new Date().toISOString().split('T')[0],
      terminationDate: null,
      notes: `Cloned from ${source.name}. Configure new DOS tenure.`,
    };
    GLOBAL_FEE_SCHEDULES.push(clone);

    const sourceLines = GLOBAL_FEE_SCHEDULE_LINES.filter(
      (l) => l.feeScheduleId === id || (!l.feeScheduleId && id === 'fs-1')
    );
    sourceLines.forEach((l) => {
      GLOBAL_FEE_SCHEDULE_LINES.push({
        ...l,
        id: `fsl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        feeScheduleId: newId,
      });
    });
    return clone;
  }
}




