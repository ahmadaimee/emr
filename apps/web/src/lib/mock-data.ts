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
    sessionId: '00000000-0000-4000-8000-000000000003',
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
  sessionId: '00000000-0000-4000-8000-000000000003',
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
      patient: {
        id: 'pat-1',
        firstName: 'Eleanor',
        lastName: 'Miller',
        dob: '1982-05-14',
        gender: 'F',
        mrn: 'MRN-44910',
        memberId: 'BCBS-992812',
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
          chargeCents: 25000,
          units: 1,
          diagnosisPointers: [1],
        },
        {
          id: 'line-2',
          lineNumber: 2,
          cptCode: '73030',
          description: 'Radiologic examination, shoulder; complete',
          modifier1: null,
          chargeCents: 20000,
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
        carc: 'CO-96',
        rarc: 'N382',
        amountCents: 45000,
        reasonDescription: 'Non-covered charge(s). Missing modifier documentation for separate identifiable service.',
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
      checkDate: '2026-03-05',
      totalPaidCents: 1425000,
      status: 'balanced',
      receivedAt: new Date(Date.now() - 86400000 * 1),
    },
    claims: [
      {
        id: 'rc-1',
        claimId: 'clm-demo-1',
        claimNumber: 'CLM-2026-0101',
        patientName: 'Miller, Eleanor',
        totalChargeCents: 45000,
        paidCents: 0,
        patientResponsibilityCents: 0,
        adjustments: [
          { group: 'CO', reason: '96', amountCents: 45000, description: 'Non-covered charge(s)' },
        ],
      },
      {
        id: 'rc-2',
        claimId: 'clm-demo-4',
        claimNumber: 'CLM-2026-0104',
        patientName: 'Chen, Michael',
        totalChargeCents: 35000,
        paidCents: 28000,
        patientResponsibilityCents: 7000,
        adjustments: [
          { group: 'PR', reason: '1', amountCents: 7000, description: 'Deductible Amount' },
        ],
      },
    ],
  };
}

export function getMockEligibilityData() {
  const rows = [
    {
      e: {
        id: 'elig-1',
        patientId: 'pat-1',
        payerId: 'pyr-1',
        status: 'active',
        planName: 'Blue Choice PPO Preferred',
        copayCents: 2500,
        coinsurancePercent: 20,
        deductibleRemainingCents: 45000,
        oopMaxRemainingCents: 150000,
        inNetwork: true,
        checkedAt: new Date(Date.now() - 3600000 * 4),
      },
      patientFirst: 'Eleanor',
      patientLast: 'Miller',
      payerName: 'Blue Cross Blue Shield',
      mrn: 'MRN-44910',
    },
    {
      e: {
        id: 'elig-2',
        patientId: 'pat-2',
        payerId: 'pyr-2',
        status: 'active',
        planName: 'Aetna Open Choice',
        copayCents: 3000,
        coinsurancePercent: 15,
        deductibleRemainingCents: 20000,
        oopMaxRemainingCents: 120000,
        inNetwork: true,
        checkedAt: new Date(Date.now() - 3600000 * 12),
      },
      patientFirst: 'Robert',
      patientLast: 'Johnson',
      payerName: 'Aetna Health',
      mrn: 'MRN-44911',
    },
    {
      e: {
        id: 'elig-3',
        patientId: 'pat-3',
        payerId: 'pyr-3',
        status: 'inactive',
        planName: 'UHC Choice Plus',
        copayCents: 0,
        coinsurancePercent: 0,
        deductibleRemainingCents: 0,
        oopMaxRemainingCents: 0,
        inNetwork: false,
        checkedAt: new Date(Date.now() - 3600000 * 1),
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
      totalCount: 45,
      completedCount: 45,
      status: 'completed',
      createdAt: new Date(Date.now() - 86400000 * 1),
    },
  ];

  return { rows, batches };
}

export function getMockPatientsData() {
  const rows = [
    {
      id: 'pat-1',
      mrn: 'MRN-44910',
      firstName: 'Eleanor',
      lastName: 'Miller',
      dob: '1982-05-14',
      gender: 'F',
      phone: '(555) 234-8901',
      email: 'eleanor.miller@example.org',
      coverageCount: 2,
      activeClaimsCount: 1,
    },
    {
      id: 'pat-2',
      mrn: 'MRN-44911',
      firstName: 'Robert',
      lastName: 'Johnson',
      dob: '1975-11-20',
      gender: 'M',
      phone: '(555) 345-1290',
      email: 'robert.j@example.org',
      coverageCount: 1,
      activeClaimsCount: 1,
    },
    {
      id: 'pat-3',
      mrn: 'MRN-44912',
      firstName: 'Sophia',
      lastName: 'Davis',
      dob: '1990-03-08',
      gender: 'F',
      phone: '(555) 456-7812',
      email: 'sophia.d@example.org',
      coverageCount: 1,
      activeClaimsCount: 1,
    },
    {
      id: 'pat-4',
      mrn: 'MRN-44913',
      firstName: 'Michael',
      lastName: 'Chen',
      dob: '1968-09-24',
      gender: 'M',
      phone: '(555) 567-3401',
      email: 'm.chen@example.org',
      coverageCount: 1,
      activeClaimsCount: 0,
    },
    {
      id: 'pat-5',
      mrn: 'MRN-44914',
      firstName: 'Carlos',
      lastName: 'Martinez',
      dob: '1985-12-03',
      gender: 'M',
      phone: '(555) 678-9012',
      email: 'carlos.m@example.org',
      coverageCount: 2,
      activeClaimsCount: 1,
    },
  ];

  return { rows };
}

export function getMockPatientDetail(id: string) {
  return {
    patient: {
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
      phone: '(555) 234-8901',
      email: 'eleanor.miller@example.org',
      createdAt: new Date(Date.now() - 86400000 * 90),
    },
    coverages: [
      {
        id: 'cov-1',
        rank: 'primary',
        payerName: 'Blue Cross Blue Shield',
        memberId: 'BCBS-992812',
        groupNumber: 'GRP-10492',
        status: 'active',
        startDate: '2025-01-01',
      },
      {
        id: 'cov-2',
        rank: 'secondary',
        payerName: 'Aetna Health',
        memberId: 'AET-883921',
        groupNumber: 'GRP-55102',
        status: 'active',
        startDate: '2025-01-01',
      },
    ],
    claims: [
      {
        id: 'clm-demo-1',
        claimNumber: 'CLM-2026-0101',
        serviceDateFrom: '2026-03-01',
        totalChargeCents: 45000,
        status: 'denied',
      },
    ],
  };
}

export function getMockReportsData() {
  return {
    arAging: [
      { bucket: 'Current (0-30)', amountCents: 2840000, percent: 59 },
      { bucket: '31-60 days', amountCents: 1210000, percent: 25 },
      { bucket: '61-90 days', amountCents: 540000, percent: 11 },
      { bucket: '91-120 days', amountCents: 185000, percent: 4 },
      { bucket: '120+ days', amountCents: 50000, percent: 1 },
    ],
    denialsByCategory: [
      { category: 'Coding / NCCI Edits', count: 18, amountCents: 820000 },
      { category: 'Eligibility / Inactive Coverage', count: 9, amountCents: 410000 },
      { category: 'Prior Authorization Missing', count: 7, amountCents: 380000 },
      { category: 'Timely Filing Exceeded', count: 4, amountCents: 195000 },
    ],
    kpis: {
      netCollectionRate: 96.4,
      cleanClaimRate: 94.2,
      daysInAr: 34.2,
      denialRate: 6.8,
    },
  };
}

export function getMockAuditData() {
  return {
    events: [
      {
        id: 'aud-1',
        action: 'verify_eligibility',
        resourceType: 'patient',
        resourceId: 'pat-1',
        actorUserId: MOCK_USER_ID,
        ipAddress: '127.0.0.1',
        occurredAt: new Date(Date.now() - 1000 * 60 * 10),
        hash: 'b14ca7e30d7bfa54687d8123fa4e13028302fa910293e8201a82f8374a91b2c3',
        prevHash: 'a038bf8201938fae109283fae019283fa019283fa019283fa019283fa019283f',
        verified: true,
      },
      {
        id: 'aud-2',
        action: 'submit_claim',
        resourceType: 'claim',
        resourceId: 'clm-demo-1',
        actorUserId: MOCK_USER_ID,
        ipAddress: '127.0.0.1',
        occurredAt: new Date(Date.now() - 1000 * 60 * 45),
        hash: 'a038bf8201938fae109283fae019283fa019283fa019283fa019283fa019283f',
        prevHash: '91823fae019283fa019283fa019283fa019283fa019283fa019283fa019283f',
        verified: true,
      },
      {
        id: 'aud-3',
        action: 'post_remittance',
        resourceType: 'remittance',
        resourceId: 'remit-demo-1',
        actorUserId: 'system',
        ipAddress: null,
        occurredAt: new Date(Date.now() - 1000 * 60 * 120),
        hash: '91823fae019283fa019283fa019283fa019283fa019283fa019283fa019283f',
        prevHash: '8091823fae019283fa019283fa019283fa019283fa019283fa019283fa019283',
        verified: true,
      },
    ],
    chainIntact: true,
  };
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
  return {
    ncciEditsCount: 24180,
    mueRulesCount: 12410,
    addonRulesCount: 890,
    activeRules: [
      { code: 'NCCI-PTP', name: 'Procedure-to-Procedure (PTP) Edits', status: 'active', version: '2026.1' },
      { code: 'NCCI-MUE', name: 'Medically Unlikely Edits (MUE)', status: 'active', version: '2026.1' },
      { code: 'MOD-25', name: 'Significant Separately Identifiable E/M Modifier', status: 'active', version: '1.0' },
      { code: 'MOD-59', name: 'Distinct Procedural Service Modifier', status: 'active', version: '1.0' },
      { code: 'LUHN-NPI', name: 'National Provider Identifier Checksum', status: 'active', version: '1.0' },
    ],
  };
}

export function getMockUsersData() {
  return {
    users: [
      {
        id: MOCK_USER_ID,
        name: 'Alex Rivera',
        email: 'operator@grove.internal',
        role: 'Admin / Operator',
        mfaEnrolled: true,
        lastActive: new Date(Date.now() - 1000 * 60 * 5),
      },
      {
        id: 'usr-2',
        name: 'Sarah Jenkins',
        email: 'sarah.j@grove.internal',
        role: 'Biller',
        mfaEnrolled: true,
        lastActive: new Date(Date.now() - 1000 * 60 * 35),
      },
      {
        id: 'usr-3',
        name: 'Dr. Marcus Vance',
        email: 'mvance@orchardfamily.internal',
        role: 'Clinician / Read-Only',
        mfaEnrolled: false,
        lastActive: new Date(Date.now() - 86400000 * 1),
      },
    ],
  };
}
