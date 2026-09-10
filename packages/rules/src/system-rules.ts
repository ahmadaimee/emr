import type { Finding, Severity } from './ast';
import type { ClaimFacts, LineFacts, ReferenceData } from './facts';
import { isValidNpi } from './npi';

/**
 * System rules ship with the product. They are implemented as TypeScript rather than
 * AST because they need reference lookups and cross-line aggregation that the
 * expression language deliberately does not expose to user-authored rules. They
 * produce the same `Finding` shape, name themselves, and explain themselves — a hold
 * is never a bare code.
 *
 * Each rule documents the specific failure mode it exists to prevent.
 */

export interface SystemRule {
  key: string;
  name: string;
  category: string;
  severity: Severity;
  evaluate(facts: ClaimFacts, ref: ReferenceData): Finding[];
}

const finding = (
  rule: SystemRule,
  message: string,
  extra: Partial<Finding> = {},
): Finding => ({
  ruleKey: rule.key,
  ruleName: rule.name,
  severity: rule.severity,
  message,
  source: `system:${rule.category}`,
  ...extra,
});

const linePath = (i: number, sub = '') => `/lines/${i}${sub}`;

/** Modifiers that legitimately bypass an NCCI indicator-1 edit. */
const NCCI_BYPASS_MODIFIERS = new Set(['59', 'XE', 'XP', 'XS', 'XU', '25', '91', 'LT', 'RT', 'E1', 'E2', 'E3', 'E4', 'FA', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'TA', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', '24', '57', '78', '79']);

// ---------------------------------------------------------------------------

export const ncciPtpRule: SystemRule = {
  key: 'sys.ncci.ptp',
  name: 'NCCI procedure-to-procedure bundling',
  category: 'ncci_ptp',
  severity: 'error',
  evaluate(facts, ref) {
    const out: Finding[] = [];
    const lines = facts.lines;
    for (let i = 0; i < lines.length; i++) {
      for (let j = 0; j < lines.length; j++) {
        if (i === j) continue;
        const a = lines[i]!;
        const b = lines[j]!;
        if (a.serviceDate !== b.serviceDate) continue;
        const edit = ref.ncciPtp(a.procedureCode, b.procedureCode, a.serviceDate);
        if (!edit || edit.modifierIndicator === '9') continue;

        const hasBypass = b.modifiers.some((m) => NCCI_BYPASS_MODIFIERS.has(m));

        if (edit.modifierIndicator === '0') {
          // The single most expensive scrubber mistake: an indicator-0 pair can NEVER
          // be unbundled. A modifier does not help; it just documents the attempt.
          out.push(
            finding(this, `${b.procedureCode} is bundled into ${a.procedureCode} by an NCCI edit with modifier indicator 0 — no modifier can unbundle this pair.${hasBypass ? ' The modifier on this line will not be honoured.' : ''}`, {
              path: linePath(j),
              lineNumber: b.lineNumber,
              evidence: { columnOne: a.procedureCode, columnTwo: b.procedureCode, modifierIndicator: '0' },
              suggestedFix: { action: 'remove_line', target: linePath(j), explanation: `Remove ${b.procedureCode}; its payment is included in ${a.procedureCode}.` },
            }),
          );
        } else if (!hasBypass) {
          out.push(
            finding(this, `${b.procedureCode} is bundled into ${a.procedureCode} by an NCCI edit (indicator 1). Add an appropriate modifier only if the services were distinct and documentation supports it.`, {
              path: linePath(j, '/modifiers'),
              lineNumber: b.lineNumber,
              evidence: { columnOne: a.procedureCode, columnTwo: b.procedureCode, modifierIndicator: '1' },
              suggestedFix: { action: 'add_modifier', target: linePath(j, '/modifiers'), value: 'XU', explanation: 'Prefer the specific X{EPSU} modifiers over 59; payers audit 59 heavily.' },
            }),
          );
        }
      }
    }
    return out;
  },
};

export const mueRule: SystemRule = {
  key: 'sys.mue',
  name: 'Medically Unlikely Edits (unit limits)',
  category: 'mue',
  severity: 'error',
  evaluate(facts, ref) {
    const out: Finding[] = [];
    const byCodeAndDate = new Map<string, { lines: Array<{ idx: number; line: LineFacts }>; units: number }>();

    facts.lines.forEach((line, idx) => {
      const key = `${line.procedureCode}|${line.serviceDate}`;
      const entry = byCodeAndDate.get(key) ?? { lines: [], units: 0 };
      entry.lines.push({ idx, line });
      entry.units += line.units;
      byCodeAndDate.set(key, entry);
    });

    for (const [key, group] of byCodeAndDate) {
      const [code = '', date = ''] = key.split('|');
      const mue = ref.mue(code, date);
      if (!mue) continue;

      if (mue.mai === '1') {
        // Line-level: each line judged on its own.
        for (const { idx, line } of group.lines) {
          if (line.units > mue.maxUnits) {
            out.push(
              finding(this, `${code} billed with ${line.units} units; the MUE limit is ${mue.maxUnits} per line (MAI 1). Split across lines with an appropriate modifier if clinically justified.`, {
                path: linePath(idx, '/units'),
                lineNumber: line.lineNumber,
                evidence: { code, units: line.units, maxUnits: mue.maxUnits, mai: '1' },
                suggestedFix: { action: 'set_units', target: linePath(idx, '/units'), value: mue.maxUnits, explanation: 'Reduce to the MUE limit, or split the remainder onto a separate line with modifier 76/91 as appropriate.' },
              }),
            );
          }
        }
      } else {
        // Date-of-service edit: units are summed across EVERY line AND every other
        // claim for this patient and date. Checking a single line passes violations
        // that then deny after submission.
        const otherClaimUnits = facts.sameDayLinesOnOtherClaims
          .filter((l) => l.procedureCode === code)
          .reduce((s, l) => s + l.units, 0);
        const total = group.units + otherClaimUnits;
        if (total > mue.maxUnits) {
          const first = group.lines[0]!;
          const absolute = mue.mai === '2';
          out.push(
            finding(this, `${code} totals ${total} units on ${date} across this claim${otherClaimUnits ? ` and ${otherClaimUnits} on other claims` : ''}; the MUE limit is ${mue.maxUnits} per date of service (MAI ${mue.mai}${absolute ? ', not overridable' : ', overridable with documentation on appeal'}).`, {
                path: linePath(first.idx, '/units'),
                lineNumber: first.line.lineNumber,
                evidence: { code, totalUnits: total, thisClaimUnits: group.units, otherClaimUnits, maxUnits: mue.maxUnits, mai: mue.mai },
                suggestedFix: absolute
                  ? { action: 'set_units', target: linePath(first.idx, '/units'), value: Math.max(0, mue.maxUnits - otherClaimUnits), explanation: 'MAI 2 limits are absolute. Units above the limit will be denied and cannot be appealed.' }
                  : { action: 'review', explanation: 'MAI 3 limits may be exceeded with documentation. Confirm medical necessity before submitting.' },
              }),
          );
        }
      }
    }
    return out;
  },
};

export const addOnCodeRule: SystemRule = {
  key: 'sys.addon',
  name: 'Add-on code without primary procedure',
  category: 'add_on',
  severity: 'error',
  evaluate(facts, ref) {
    const out: Finding[] = [];
    facts.lines.forEach((line, idx) => {
      const addOn = ref.addOnPrimaries(line.procedureCode);
      if (!addOn) return;
      const sameDayCodes = new Set(facts.lines.filter((l) => l.serviceDate === line.serviceDate).map((l) => l.procedureCode));
      const satisfied = addOn.addOnType === '2' ? sameDayCodes.size > 1 : addOn.primaryCodes.some((p) => sameDayCodes.has(p));
      if (!satisfied) {
        out.push(
          finding(this, `${line.procedureCode} is an add-on code and cannot be billed alone. It requires ${addOn.addOnType === '2' ? 'a primary procedure' : `one of: ${addOn.primaryCodes.slice(0, 8).join(', ')}${addOn.primaryCodes.length > 8 ? '…' : ''}`} on the same date.`, {
            path: linePath(idx),
            lineNumber: line.lineNumber,
            evidence: { code: line.procedureCode, primaryCodes: addOn.primaryCodes.slice(0, 20) },
            suggestedFix: { action: 'review', explanation: 'Add the primary procedure line, or remove the add-on.' },
          }),
        );
      }
    });
    return out;
  },
};

export const diagnosisPointerRule: SystemRule = {
  key: 'sys.dx.pointers',
  name: 'Diagnosis pointers',
  category: 'coding',
  severity: 'error',
  evaluate(facts) {
    const out: Finding[] = [];
    const n = facts.claim.diagnoses.length;
    if (n === 0) {
      out.push(finding(this, 'The claim has no diagnosis codes.', { path: '/diagnoses', suggestedFix: { action: 'review', explanation: 'At least one ICD-10-CM code is required.' } }));
    }
    if (n > 12) {
      out.push(finding(this, `The claim has ${n} diagnoses; the 837P and CMS-1500 allow at most 12.`, { path: '/diagnoses' }));
    }
    facts.lines.forEach((line, idx) => {
      if (line.diagnosisPointers.length === 0) {
        out.push(finding(this, `Line ${line.lineNumber} has no diagnosis pointer.`, { path: linePath(idx, '/diagnosisPointers'), lineNumber: line.lineNumber, suggestedFix: { action: 'add_diagnosis_pointer', target: linePath(idx, '/diagnosisPointers'), value: 1, explanation: 'Point the line at the diagnosis that justifies it.' } }));
      }
      if (line.diagnosisPointers.length > 4) {
        out.push(finding(this, `Line ${line.lineNumber} has ${line.diagnosisPointers.length} pointers; a service line may reference at most 4 diagnoses.`, { path: linePath(idx, '/diagnosisPointers'), lineNumber: line.lineNumber }));
      }
      for (const p of line.diagnosisPointers) {
        if (!Number.isInteger(p) || p < 1 || p > n) {
          out.push(finding(this, `Line ${line.lineNumber} points at diagnosis ${p}, but the claim only has ${n}.`, { path: linePath(idx, '/diagnosisPointers'), lineNumber: line.lineNumber, evidence: { pointer: p, diagnosisCount: n } }));
        }
      }
    });
    return out;
  },
};

export const diagnosisValidityRule: SystemRule = {
  key: 'sys.dx.validity',
  name: 'Diagnosis code validity',
  category: 'coding',
  severity: 'error',
  evaluate(facts, ref) {
    const out: Finding[] = [];
    facts.claim.diagnoses.forEach((code, i) => {
      const dx = ref.diagnosis(code);
      if (!dx) {
        out.push(finding(this, `${code} is not a recognised ICD-10-CM code for this date of service.`, { path: `/diagnoses/${i}` }));
        return;
      }
      if (!dx.billable) {
        out.push(finding(this, `${code} is a category header and not billable; a more specific code is required.`, { path: `/diagnoses/${i}`, suggestedFix: { action: 'review', explanation: 'Select the code with the required additional characters.' } }));
      }
      if (dx.sexRestriction && dx.sexRestriction !== facts.patient.sex) {
        out.push(finding(this, `${code} is restricted to ${dx.sexRestriction === 'F' ? 'female' : 'male'} patients; the patient's sex on file is ${facts.patient.sex}.`, { path: `/diagnoses/${i}`, evidence: { code, sexRestriction: dx.sexRestriction, patientSex: facts.patient.sex } }));
      }
      const age = facts.patient.ageAtService;
      if ((dx.ageMin !== undefined && age < dx.ageMin) || (dx.ageMax !== undefined && age > dx.ageMax)) {
        out.push(finding(this, `${code} is age-restricted (${dx.ageMin ?? 0}–${dx.ageMax ?? '∞'}); the patient was ${age} at the date of service.`, { path: `/diagnoses/${i}`, evidence: { code, age } }));
      }
    });
    return out;
  },
};

export const medicalNecessityRule: SystemRule = {
  key: 'sys.medical_necessity',
  name: 'Medical necessity (LCD/NCD)',
  category: 'medical_necessity',
  severity: 'warning',
  evaluate(facts, ref) {
    const out: Finding[] = [];
    // Only meaningful for Medicare; commercial policies load as tenant rules.
    if (facts.payer.type !== 'medicare') return out;
    facts.lines.forEach((line, idx) => {
      const dxCodes = line.diagnosisPointers.map((p) => facts.claim.diagnoses[p - 1]).filter((c): c is string => Boolean(c));
      const results = dxCodes.map((dx) => ref.medicalNecessity(line.procedureCode, dx, facts.location.macJurisdiction));
      if (results.length > 0 && results.every((r) => r === 'does_not_support')) {
        out.push(
          finding(this, `None of the diagnoses on line ${line.lineNumber} (${dxCodes.join(', ')}) support medical necessity for ${line.procedureCode} under the ${facts.location.macJurisdiction ?? 'applicable'} coverage determination.${line.abnObtained ? '' : ' No ABN is on file, so a denial would be unappealable and could not be billed to the patient.'}`, {
            path: linePath(idx),
            lineNumber: line.lineNumber,
            evidence: { procedure: line.procedureCode, diagnoses: dxCodes, macJurisdiction: facts.location.macJurisdiction ?? null, abnObtained: line.abnObtained },
            suggestedFix: line.abnObtained
              ? { action: 'add_modifier', target: linePath(idx, '/modifiers'), value: 'GA', explanation: 'An ABN is on file; append GA so liability shifts to the patient if denied.' }
              : { action: 'obtain_abn', explanation: 'Add a supporting diagnosis if one is documented, or obtain an ABN before the service.' },
          }),
        );
      }
    });
    return out;
  },
};

export const placeOfServiceRule: SystemRule = {
  key: 'sys.pos',
  name: 'Place of service consistency',
  category: 'pos',
  severity: 'error',
  evaluate(facts, ref) {
    const out: Finding[] = [];
    facts.lines.forEach((line, idx) => {
      const pos = line.placeOfService || facts.claim.placeOfService;
      const proc = ref.procedure(line.procedureCode);
      if (proc?.allowedPlacesOfService && !proc.allowedPlacesOfService.includes(pos)) {
        out.push(finding(this, `${line.procedureCode} is not payable in place of service ${pos}.`, { path: linePath(idx, '/placeOfService'), lineNumber: line.lineNumber, evidence: { procedure: line.procedureCode, placeOfService: pos, allowed: proc.allowedPlacesOfService } }));
      }
      // Telehealth: POS 02/10 must carry modifier 95 (or GT for some payers).
      if ((pos === '02' || pos === '10') && !line.modifiers.some((m) => m === '95' || m === 'GT' || m === 'GQ')) {
        out.push(
          finding(this, `Line ${line.lineNumber} is telehealth (POS ${pos}) but has no telehealth modifier.`, {
            path: linePath(idx, '/modifiers'),
            lineNumber: line.lineNumber,
            suggestedFix: { action: 'add_modifier', target: linePath(idx, '/modifiers'), value: '95', explanation: 'Append 95 for synchronous audio-video telehealth.' },
          }),
        );
      }
      if (!ref.placeOfService(pos)) {
        out.push(finding(this, `${pos} is not a valid place of service code.`, { path: linePath(idx, '/placeOfService'), lineNumber: line.lineNumber }));
      }
    });
    return out;
  },
};

export const modifierRule: SystemRule = {
  key: 'sys.modifiers',
  name: 'Modifier usage',
  category: 'modifier',
  severity: 'warning',
  evaluate(facts) {
    const out: Finding[] = [];
    facts.lines.forEach((line, idx) => {
      const mods = line.modifiers;
      if (mods.length > 4) {
        out.push(finding(this, `Line ${line.lineNumber} has ${mods.length} modifiers; the claim formats allow four.`, { path: linePath(idx, '/modifiers'), lineNumber: line.lineNumber }));
      }
      const dupes = mods.filter((m, i) => mods.indexOf(m) !== i);
      if (dupes.length) {
        out.push(finding(this, `Line ${line.lineNumber} repeats modifier ${dupes[0]}.`, { path: linePath(idx, '/modifiers'), lineNumber: line.lineNumber, suggestedFix: { action: 'remove_modifier', target: linePath(idx, '/modifiers'), value: dupes[0]!, explanation: 'Remove the duplicate.' } }));
      }
      if (mods.includes('59') && mods.some((m) => /^X[EPSU]$/.test(m))) {
        out.push(finding(this, `Line ${line.lineNumber} carries both 59 and an X{EPSU} modifier; use one or the other.`, { path: linePath(idx, '/modifiers'), lineNumber: line.lineNumber, suggestedFix: { action: 'remove_modifier', target: linePath(idx, '/modifiers'), value: '59', explanation: 'The X modifier is more specific and supersedes 59.' } }));
      }
      if (mods.includes('59') && facts.payer.type === 'medicare') {
        out.push(finding(this, `Line ${line.lineNumber} uses modifier 59 for a Medicare claim. CMS prefers the specific X{EPSU} modifiers and audits 59 heavily.`, { path: linePath(idx, '/modifiers'), lineNumber: line.lineNumber, suggestedFix: { action: 'replace_modifier', target: linePath(idx, '/modifiers'), value: ['59', 'XU'], explanation: 'Replace 59 with XE (separate encounter), XS (separate structure), XP (separate practitioner) or XU (unusual non-overlapping service).' } }));
      }
      if (mods.includes('25') && !/^99\d{3}$/.test(line.procedureCode)) {
        out.push(finding(this, `Modifier 25 on line ${line.lineNumber} applies only to E/M services; ${line.procedureCode} is not one.`, { path: linePath(idx, '/modifiers'), lineNumber: line.lineNumber, suggestedFix: { action: 'remove_modifier', target: linePath(idx, '/modifiers'), value: '25', explanation: 'Remove 25 from the non-E/M line.' } }));
      }
      if (mods.includes('GA') && !line.abnObtained) {
        out.push(finding(this, `Line ${line.lineNumber} carries GA but no ABN is recorded on file.`, { path: linePath(idx, '/modifiers'), lineNumber: line.lineNumber, evidence: { abnObtained: false } }));
      }
    });
    return out;
  },
};

export const providerIdentifierRule: SystemRule = {
  key: 'sys.provider.identifiers',
  name: 'Provider identifiers',
  category: 'provider',
  severity: 'error',
  evaluate(facts) {
    const out: Finding[] = [];
    if (!isValidNpi(facts.billingProvider.npi)) {
      out.push(finding(this, `Billing provider NPI ${facts.billingProvider.npi} fails the check digit.`, { path: '/billingProvider/npi' }));
    }
    if (!isValidNpi(facts.renderingProvider.npi)) {
      out.push(finding(this, `Rendering provider NPI ${facts.renderingProvider.npi} fails the check digit.`, { path: '/renderingProvider/npi' }));
    }
    if (!facts.billingProvider.taxId) {
      out.push(finding(this, 'Billing provider has no tax ID; REF*EI is required in loop 2010AA.', { path: '/billingProvider/taxId' }));
    }
    if (!facts.billingProvider.taxonomyCode) {
      out.push(finding(this, 'Billing provider has no taxonomy code. Many payers reject claims without PRV*BI.', { path: '/billingProvider/taxonomyCode', severity: 'warning' }));
    }
    const zip = (facts.billingProvider.postalCode ?? '').replace(/\D/g, '');
    if (zip.length !== 9) {
      out.push(finding(this, `Billing provider ZIP "${facts.billingProvider.postalCode ?? ''}" must be 9 digits. Payers reject 5-digit ZIPs in loop 2010AA.`, { path: '/billingProvider/postalCode', suggestedFix: { action: 'set_field', target: '/billingProvider/postalCode', explanation: 'Look up the ZIP+4 for the billing address.' } }));
    }
    // What matters is the PAYER's enrollment record, not NPPES.
    if (facts.renderingProvider.enrollmentStatus && !['participating', 'non_participating'].includes(facts.renderingProvider.enrollmentStatus)) {
      out.push(finding(this, `Rendering provider enrollment with ${facts.payer.name} is "${facts.renderingProvider.enrollmentStatus}". The payer will deny for an unenrolled provider regardless of NPPES.`, { path: '/renderingProvider', severity: 'error', evidence: { enrollmentStatus: facts.renderingProvider.enrollmentStatus } }));
    }
    return out;
  },
};

export const timelyFilingRule: SystemRule = {
  key: 'sys.timely_filing',
  name: 'Timely filing',
  category: 'timely_filing',
  severity: 'error',
  evaluate(facts) {
    const days = facts.payer.timelyFilingDays;
    if (!days) return [];
    const dos = Date.parse(facts.claim.serviceDateFrom + 'T00:00:00Z');
    const today = Date.parse(facts.today + 'T00:00:00Z');
    const elapsed = Math.round((today - dos) / 86_400_000);
    const remaining = days - elapsed;
    if (remaining < 0) {
      return [finding(this, `The timely filing window for ${facts.payer.name} (${days} days) closed ${-remaining} days ago. The claim will be denied CO-29 unless proof of timely filing exists.`, { path: '/serviceDateFrom', evidence: { timelyFilingDays: days, daysElapsed: elapsed } })];
    }
    if (remaining <= 14) {
      return [finding(this, `Only ${remaining} days remain in the ${facts.payer.name} timely filing window. Submit today.`, { path: '/serviceDateFrom', severity: 'warning', evidence: { daysRemaining: remaining } })];
    }
    return [];
  },
};

export const correctedClaimRule: SystemRule = {
  key: 'sys.frequency',
  name: 'Corrected/void claim reference',
  category: 'coding',
  severity: 'error',
  evaluate(facts) {
    if (facts.claim.frequencyCode !== '1' && !facts.claim.originalPayerClaimControlNumber) {
      return [finding(this, `A frequency-${facts.claim.frequencyCode} claim must carry the payer's original claim control number (REF*F8), or the payer treats it as a duplicate original and denies it.`, { path: '/originalPayerClaimControlNumber', suggestedFix: { action: 'set_field', target: '/originalPayerClaimControlNumber', explanation: 'Copy CLP07 from the primary remittance.' } })];
    }
    return [];
  },
};

export const eligibilityRule: SystemRule = {
  key: 'sys.eligibility',
  name: 'Coverage verification',
  category: 'eligibility',
  severity: 'warning',
  evaluate(facts) {
    const out: Finding[] = [];
    const c = facts.coverage;
    if (c.terminationDate && c.terminationDate < facts.claim.serviceDateFrom) {
      out.push(finding(this, `Coverage terminated ${c.terminationDate}, before the date of service.`, { path: '/coverage', severity: 'error', suggestedFix: { action: 'run_eligibility', explanation: 'Re-verify; the patient may have new coverage.' } }));
    }
    if (c.effectiveDate && c.effectiveDate > facts.claim.serviceDateFrom) {
      out.push(finding(this, `Coverage is effective ${c.effectiveDate}, after the date of service.`, { path: '/coverage', severity: 'error' }));
    }
    if (!c.lastVerifiedAt) {
      out.push(finding(this, 'Eligibility has never been verified for this coverage.', { path: '/coverage', suggestedFix: { action: 'run_eligibility', explanation: 'Run a 270 before submitting.' } }));
    } else if (c.lastVerifiedStatus && c.lastVerifiedStatus !== 'active') {
      out.push(finding(this, `The last eligibility check returned "${c.lastVerifiedStatus}".`, { path: '/coverage', severity: 'error', suggestedFix: { action: 'run_eligibility', explanation: 'Confirm coverage or update the payer before submitting.' } }));
    }
    return out;
  },
};

export const accidentRule: SystemRule = {
  key: 'sys.accident',
  name: 'Accident details',
  category: 'coding',
  severity: 'error',
  evaluate(facts) {
    if ((facts.claim.relatedToAutoAccident || facts.claim.relatedToEmployment) && !facts.claim.accidentDate) {
      return [finding(this, 'The claim is marked accident-related but has no accident date (DTP*439).', { path: '/accidentDate' })];
    }
    return [];
  },
};

export const SYSTEM_RULES: SystemRule[] = [
  diagnosisPointerRule,
  diagnosisValidityRule,
  providerIdentifierRule,
  correctedClaimRule,
  ncciPtpRule,
  mueRule,
  addOnCodeRule,
  placeOfServiceRule,
  modifierRule,
  medicalNecessityRule,
  timelyFilingRule,
  eligibilityRule,
  accidentRule,
];
