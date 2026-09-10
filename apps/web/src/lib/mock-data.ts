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
  return {
    a: {
      claim: {
        id,
        claimNumber: 'CLM-2026-0101',
        payerClaimControlNumber: 'PAY-8849201',
        status: 'denied',
        coverageRank: 'primary',
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
  };
}

export function getMockQueuesData() {
  const queueList = [
    { id: 'q-1', key: 'denials', name: 'Denials Requiring Appeal', category: 'denial' },
    { id: 'q-2', key: 'rejections', name: 'Clearinghouse 277CA Rejections', category: 'rejection' },
    { id: 'q-3', key: 'underpayments', name: 'Underpayments vs Fee Schedule', category: 'underpayment' },
    { id: 'q-4', key: 'timely_filing', name: 'Timely Filing Within 14 Days', category: 'timely_filing' },
    { id: 'q-5', key: 'eligibility', name: 'Eligibility Inactive Exceptions', category: 'eligibility' },
  ];

  const taskRows = [
    {
      t: {
        id: 'tsk-1',
        workQueueId: 'q-1',
        claimId: 'clm-demo-1',
        priority: 'high',
        status: 'open',
        title: 'Appeal Denial CO-96 for Eleanor Miller',
        detail: { deniedCents: 45000, reason: 'Non-covered service / Missing modifier 25', payer: 'Blue Cross Blue Shield' },
        createdAt: new Date(Date.now() - 3600000 * 5),
        slaDeadline: new Date(Date.now() + 86400000 * 5),
      },
      patientFirst: 'Eleanor',
      patientLast: 'Miller',
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
        createdAt: new Date(Date.now() - 3600000 * 2),
        slaDeadline: new Date(Date.now() + 86400000 * 1),
      },
      patientFirst: 'Robert',
      patientLast: 'Johnson',
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
        createdAt: new Date(Date.now() - 3600000 * 18),
        slaDeadline: new Date(Date.now() + 86400000 * 8),
      },
      patientFirst: 'Michael',
      patientLast: 'Chen',
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
        createdAt: new Date(Date.now() - 3600000 * 24),
        slaDeadline: new Date(Date.now() + 86400000 * 4),
      },
      patientFirst: 'Sophia',
      patientLast: 'Davis',
      queueName: 'Timely Filing Within 14 Days',
    },
  ];

  const stats = {
    totalOpen: 38,
    urgentCount: 12,
    totalDollarCents: 1805000,
    resolvedToday: 14,
  };

  return { queueList, taskRows, stats };
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
        dob: '1982-05-14',
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
        dob: '1975-11-20',
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
        dob: '1990-03-08',
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
        dob: '1968-09-24',
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
        dob: '1985-12-03',
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

  return { rows };
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

export function getMockPaymentsData() {
  const totalCollectedTodayCents = GLOBAL_PAYMENTS.reduce((sum, p) => sum + p.amountCents, 177500);
  const summary = {
    totalCollectedTodayCents,
    patientPaymentsMtdCents: 1890000,
    unallocatedCreditsCents: 125000,
    settledCount: 44 + GLOBAL_PAYMENTS.length,
  };

  const payments = [...GLOBAL_PAYMENTS];

  const patients = [
    { id: 'pat-1', name: 'Miller, Eleanor', mrn: 'MRN-44910', balanceCents: 5000 },
    { id: 'pat-2', name: 'Johnson, Robert', mrn: 'MRN-44911', balanceCents: 3500 },
    { id: 'pat-3', name: 'Davis, Sophia', mrn: 'MRN-44912', balanceCents: 12000 },
    { id: 'pat-4', name: 'Chen, Michael', mrn: 'MRN-44913', balanceCents: 0 },
    { id: 'pat-5', name: 'Martinez, Carlos', mrn: 'MRN-44914', balanceCents: 8000 },
  ];

  return { summary, payments, patients };
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
