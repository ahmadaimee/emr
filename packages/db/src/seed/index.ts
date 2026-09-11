/**
 * Development seed. SYNTHETIC DATA ONLY — every name, ID, and number here is invented.
 *
 * Creates one organisation (Orchard), two client practices, providers, payers with
 * plans and a contract, a handful of patients with coverages, the system roles, and an
 * admin user. Enough to exercise the whole revenue cycle end to end with the mock
 * clearinghouse.
 *
 * Runs as the OWNER role so it can write without a tenant context, but stamps every
 * row with the org it belongs to exactly as the application would.
 */
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

const url = process.env.DATABASE_MIGRATION_URL;
if (!url) throw new Error('DATABASE_MIGRATION_URL is not set');

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const ORG_SLUG = 'orchard';

async function main() {
  const sql = postgres(url!, { max: 1, onnotice: () => undefined });
  try {
    const exists = await sql`select 1 from organizations where id = ${ORG_ID}`;
    if (exists.length > 0) {
      console.log('Seed already present; run `pnpm db:reset && pnpm db:migrate && pnpm db:seed` to rebuild.');
      return;
    }

    await sql.begin(async (tx) => {
      // ----- Organisation -------------------------------------------------
      await tx`
        insert into organizations (id, name, slug, edi_submitter_id, edi_submitter_name, edi_usage_indicator)
        values (${ORG_ID}, 'Orchard Medical Management', ${ORG_SLUG}, 'GROVE000001', 'ORCHARD MEDICAL MGMT', 'T')
      `;

      // ----- Practices, locations, providers -----------------------------
      const northside = randomUUID();
      const eastgate = randomUUID();
      await tx`
        insert into practices (id, org_id, name, npi, tax_id, tax_id_type, taxonomy_code, default_place_of_service) values
          (${northside}, ${ORG_ID}, 'Northside Family Medicine', '1234567893', '123456789', 'EI', '207Q00000X', '11'),
          (${eastgate},  ${ORG_ID}, 'Eastgate Orthopedics',      '1245319599', '987654321', 'EI', '207X00000X', '11')
      `;

      const northsideLoc = randomUUID();
      const eastgateLoc = randomUUID();
      await tx`
        insert into locations (id, org_id, practice_id, name, line1, city, state, postal_code, place_of_service, mac_jurisdiction) values
          (${northsideLoc}, ${ORG_ID}, ${northside}, 'Main Office',  '100 Main St',      'Springfield', 'IL', '627011234', '11', 'J6'),
          (${eastgateLoc},  ${ORG_ID}, ${eastgate},  'Eastgate Clinic', '4400 Eastgate Blvd', 'Springfield', 'IL', '627024567', '11', 'J6')
      `;

      const drSmith = randomUUID();
      const drPatel = randomUUID();
      const drOkafor = randomUUID();
      await tx`
        insert into providers (id, org_id, practice_id, first_name, last_name, credentials, npi, taxonomy_code, license_state, state_license) values
          (${drSmith},  ${ORG_ID}, ${northside}, 'Jane',   'Smith',  'MD', '1987654328', '207Q00000X', 'IL', 'IL-036-111111'),
          (${drPatel},  ${ORG_ID}, ${northside}, 'Arjun',  'Patel',  'DO', '1972612544', '207Q00000X', 'IL', 'IL-036-222222'),
          (${drOkafor}, ${ORG_ID}, ${eastgate},  'Chidi',  'Okafor', 'MD', '1568450813', '207X00000X', 'IL', 'IL-036-333333')
      `;

      // ----- Payers, plans, contracts -------------------------------------
      const medicare = randomUUID();
      const bcbs = randomUUID();
      const aetna = randomUUID();
      const medicaid = randomUUID();
      await tx`
        insert into payers (id, org_id, name, type, payer_id_code, claim_filing_indicator) values
          (${medicare}, ${ORG_ID}, 'Medicare Part B (Illinois)', 'medicare',   'SMIL0', 'MB'),
          (${bcbs},     ${ORG_ID}, 'Blue Cross Blue Shield IL',  'blue_cross', '00621', 'BL'),
          (${aetna},    ${ORG_ID}, 'Aetna',                      'commercial', '60054', 'CI'),
          (${medicaid}, ${ORG_ID}, 'Illinois Medicaid (HFS)',    'medicaid',   'ILMCD', 'MC')
      `;
      await tx`
        insert into payer_connector_ids (org_id, payer_id, connector, connector_payer_id) values
          (${ORG_ID}, ${medicare}, 'mock', 'SMIL0'),  (${ORG_ID}, ${medicare}, 'stedi', 'SMIL0'),
          (${ORG_ID}, ${bcbs},     'mock', '00621'),  (${ORG_ID}, ${bcbs},     'stedi', '00621'),
          (${ORG_ID}, ${aetna},    'mock', '60054'),  (${ORG_ID}, ${aetna},    'stedi', '60054'),
          (${ORG_ID}, ${medicaid}, 'mock', 'ILMCD'),  (${ORG_ID}, ${medicaid}, 'stedi', 'ILMCD')
      `;

      const bcbsPpo = randomUUID();
      const aetnaPpo = randomUUID();
      await tx`
        insert into payer_plans (id, org_id, payer_id, name, plan_type, timely_filing_days, timely_filing_secondary_days, appeal_filing_days) values
          (${bcbsPpo},  ${ORG_ID}, ${bcbs},     'BlueChoice PPO',     'PPO', 180, 90, 180),
          (${aetnaPpo}, ${ORG_ID}, ${aetna},    'Aetna Choice POS II','POS', 120, 90, 180),
          (${randomUUID()}, ${ORG_ID}, ${medicare}, 'Medicare Part B', 'FFS', 365, 365, 120),
          (${randomUUID()}, ${ORG_ID}, ${medicaid}, 'HFS Fee-for-Service', 'FFS', 180, 180, 60)
      `;

      const bcbsContract = randomUUID();
      const bcbsSchedule = randomUUID();
      await tx`
        insert into payer_contracts (id, org_id, practice_id, payer_id, plan_id, name, effective_date, reimbursement_method, underpayment_tolerance_cents)
        values (${bcbsContract}, ${ORG_ID}, ${northside}, ${bcbs}, ${bcbsPpo}, 'BCBS IL 2026 Professional Agreement', '2026-01-01', 'fee_schedule', 100)
      `;
      await tx`
        insert into fee_schedules (id, org_id, contract_id, practice_id, name, schedule_type, effective_date)
        values (${bcbsSchedule}, ${ORG_ID}, ${bcbsContract}, ${northside}, 'BCBS IL 2026 Allowed', 'allowed', '2026-01-01')
      `;
      await tx`
        insert into fee_schedule_lines (org_id, fee_schedule_id, procedure_code, non_facility_rate_cents, facility_rate_cents) values
          (${ORG_ID}, ${bcbsSchedule}, '99212',  8200,  5900),
          (${ORG_ID}, ${bcbsSchedule}, '99213', 13400,  9800),
          (${ORG_ID}, ${bcbsSchedule}, '99214', 19600, 14500),
          (${ORG_ID}, ${bcbsSchedule}, '99215', 27500, 20400),
          (${ORG_ID}, ${bcbsSchedule}, '36415',   900,   900),
          (${ORG_ID}, ${bcbsSchedule}, '80053',  2100,  2100),
          (${ORG_ID}, ${bcbsSchedule}, '90471',  2800,  2800),
          (${ORG_ID}, ${bcbsSchedule}, '20610',  9300,  6800)
      `;

      // ----- Patients & coverages ----------------------------------------
      const patients = [
        { id: randomUUID(), practice: northside, mrn: 'NS-000101', first: 'Alice', last: 'Alpha', dob: '1980-01-01', sex: 'F', payer: bcbs, plan: bcbsPpo, member: 'ABC123456789', group: 'GRP5550' },
        { id: randomUUID(), practice: northside, mrn: 'NS-000102', first: 'Bob', last: 'Beta', dob: '1955-06-15', sex: 'M', payer: medicare, plan: null, member: '1EG4TE5MK72', group: null },
        { id: randomUUID(), practice: northside, mrn: 'NS-000103', first: 'Grace', last: 'Gamma', dob: '1992-11-30', sex: 'F', payer: aetna, plan: aetnaPpo, member: 'W22334455', group: 'AET-9981' },
        { id: randomUUID(), practice: northside, mrn: 'NS-000104', first: 'Dev', last: 'Delta', dob: '2015-03-08', sex: 'M', payer: medicaid, plan: null, member: '123456789INACTIVE', group: null },
        { id: randomUUID(), practice: eastgate, mrn: 'EG-000201', first: 'Elena', last: 'Epsilon', dob: '1971-09-22', sex: 'F', payer: bcbs, plan: bcbsPpo, member: 'XYZ987654321', group: 'GRP5550' },
        { id: randomUUID(), practice: eastgate, mrn: 'EG-000202', first: 'Frank', last: 'Phi', dob: '1948-02-14', sex: 'M', payer: medicare, plan: null, member: '2AB9CD8EF10', group: null },
      ];
      for (const p of patients) {
        await tx`
          insert into patients (id, org_id, practice_id, mrn, first_name, last_name, date_of_birth, sex, address_line1, city, state, postal_code, email, phone_mobile, allow_sms, allow_email, statement_delivery_method)
          values (${p.id}, ${ORG_ID}, ${p.practice}, ${p.mrn}, ${p.first}, ${p.last}, ${p.dob}, ${p.sex}, '12 Oak Lane', 'Springfield', 'IL', '62701', ${`${p.first.toLowerCase()}.${p.last.toLowerCase()}@example.test`}, '2175550100', true, true, 'email')
        `;
        await tx`
          insert into coverages (org_id, patient_id, payer_id, plan_id, rank, member_id, group_number, relationship_code, effective_date)
          values (${ORG_ID}, ${p.id}, ${p.payer}, ${p.plan}, 'primary', ${p.member}, ${p.group}, '18', '2026-01-01')
        `;
      }
      // Bob (Medicare) also has Medicaid secondary — exercises auto-COB and crossover.
      await tx`
        insert into coverages (org_id, patient_id, payer_id, rank, member_id, relationship_code, effective_date)
        values (${ORG_ID}, ${patients[1]!.id}, ${medicaid}, 'secondary', '987654321000', '18', '2026-01-01')
      `;

      // ----- Roles & permissions ------------------------------------------
      const roleDefs: Record<string, string[]> = {
        Administrator: ['*:*'],
        'Billing Manager': [
          'patient:*', 'coverage:*', 'eligibility:*', 'encounter:*', 'claim:*', 'remittance:*',
          'payment:*', 'denial:*', 'statement:*', 'report:*', 'rule:read', 'rule:test', 'task:*', 'queue:*',
        ],
        Biller: [
          'patient:read', 'patient:update', 'coverage:*', 'eligibility:*', 'encounter:*', 'claim:read',
          'claim:update', 'claim:submit', 'remittance:read', 'remittance:post', 'payment:*', 'denial:*',
          'statement:read', 'statement:send', 'report:read', 'task:*',
        ],
        'Front Desk': ['patient:*', 'coverage:*', 'eligibility:run', 'eligibility:read', 'payment:collect', 'statement:read', 'task:read'],
        Provider: ['patient:read', 'encounter:read', 'claim:read', 'report:read'],
        Auditor: ['audit:read', 'patient:read', 'claim:read', 'remittance:read', 'report:read'],
      };
      const roleIds: Record<string, string> = {};
      for (const [name, perms] of Object.entries(roleDefs)) {
        const id = randomUUID();
        roleIds[name] = id;
        await tx`insert into roles (id, org_id, name, is_system) values (${id}, ${ORG_ID}, ${name}, true)`;
        for (const perm of perms) {
          const [resource = '*', action = '*'] = perm.split(':');
          await tx`insert into role_permissions (org_id, role_id, resource, action) values (${ORG_ID}, ${id}, ${resource}, ${action})`;
        }
      }

      // ----- Admin user -----------------------------------------------------
      // Password is set on first login through the invite flow; no hash is seeded so
      // a development database never contains a guessable credential.
      const admin = randomUUID();
      await tx`
        insert into users (id, org_id, email, first_name, last_name, status)
        values (${admin}, ${ORG_ID}, 'admin@orchard.local', 'Grove', 'Admin', 'invited')
      `;
      await tx`insert into user_roles (org_id, user_id, role_id) values (${ORG_ID}, ${admin}, ${roleIds['Administrator']!})`;
      await tx`insert into user_practice_access (org_id, user_id, practice_id) values (${ORG_ID}, ${admin}, ${northside}), (${ORG_ID}, ${admin}, ${eastgate})`;

      // ----- Work queues & automation defaults ----------------------------
      const queues: [string, string, string][] = [
        ['denials', 'Denials', 'denial'], ['rejections', 'Clearinghouse Rejections', 'rejection'],
        ['eligibility', 'Eligibility Exceptions', 'eligibility'], ['underpayments', 'Underpayments', 'underpayment'],
        ['timely-filing', 'Timely Filing at Risk', 'timely_filing'], ['coding', 'Coding Review', 'coding'],
        ['secondary-review', 'Secondary Claims Review', 'general'], ['patient-balances', 'Patient Balances', 'patient'],
        ['duplicates', 'Possible Duplicate Patients', 'general'], ['out-of-balance', 'Out-of-Balance Remittances', 'general'],
        ['authorizations', 'Prior Authorizations', 'authorization'],
      ];
      for (const [key, name, category] of queues) {
        await tx`insert into work_queues (org_id, key, name, category, is_system) values (${ORG_ID}, ${key}, ${name}, ${category}, true)`;
      }
      await tx`insert into automation_settings (org_id, practice_id, dry_run) values (${ORG_ID}, null, true)`;

      // ----- Place of service reference ------------------------------------
      await tx`
        insert into place_of_service_codes (code, name, facility_rate) values
          ('02', 'Telehealth provided other than in patient home', true),
          ('10', 'Telehealth provided in patient home', false),
          ('11', 'Office', false),
          ('12', 'Home', false),
          ('19', 'Off campus outpatient hospital', true),
          ('21', 'Inpatient hospital', true),
          ('22', 'On campus outpatient hospital', true),
          ('23', 'Emergency room', true),
          ('24', 'Ambulatory surgical center', true),
          ('31', 'Skilled nursing facility', true),
          ('81', 'Independent laboratory', false)
        on conflict do nothing
      `;
    });

    console.log('✓ Seeded: 1 org, 2 practices, 3 providers, 4 payers, 6 patients, 6 roles, 11 work queues');
    console.log('  Admin login: admin@orchard.local (set password via invite)');
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
