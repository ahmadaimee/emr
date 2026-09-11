/**
 * CMS Place of Service Code Set. Public domain, small, and changes rarely enough that
 * it is maintained here as a literal list rather than an imported file — re-run
 * `pnpm --filter @grove/codes import pos` after editing this list to reseed
 * `place_of_service_codes`.
 *
 * `facilityRate` marks codes CMS pays at the (lower) facility rate under the Medicare
 * Physician Fee Schedule rather than the non-facility rate — the gap that matters most
 * on every telehealth claim (POS 02 is facility-rate, POS 10 is not).
 */
export interface PlaceOfServiceRow {
  code: string;
  name: string;
  facilityRate: boolean;
}

export const PLACE_OF_SERVICE_CODES: PlaceOfServiceRow[] = [
  { code: '01', name: 'Pharmacy', facilityRate: false },
  { code: '02', name: "Telehealth Provided Other than in Patient's Home", facilityRate: true },
  { code: '03', name: 'School', facilityRate: false },
  { code: '04', name: 'Homeless Shelter', facilityRate: false },
  { code: '05', name: 'Indian Health Service Free-Standing Facility', facilityRate: false },
  { code: '06', name: 'Indian Health Service Provider-Based Facility', facilityRate: true },
  { code: '07', name: 'Tribal 638 Free-Standing Facility', facilityRate: false },
  { code: '08', name: 'Tribal 638 Provider-Based Facility', facilityRate: true },
  { code: '09', name: 'Prison/Correctional Facility', facilityRate: false },
  { code: '10', name: "Telehealth Provided in Patient's Home", facilityRate: false },
  { code: '11', name: 'Office', facilityRate: false },
  { code: '12', name: 'Home', facilityRate: false },
  { code: '13', name: 'Assisted Living Facility', facilityRate: false },
  { code: '14', name: 'Group Home', facilityRate: false },
  { code: '15', name: 'Mobile Unit', facilityRate: false },
  { code: '16', name: 'Temporary Lodging', facilityRate: false },
  { code: '17', name: 'Walk-in Retail Health Clinic', facilityRate: false },
  { code: '18', name: 'Place of Employment-Worksite', facilityRate: false },
  { code: '19', name: 'Off Campus-Outpatient Hospital', facilityRate: true },
  { code: '20', name: 'Urgent Care Facility', facilityRate: false },
  { code: '21', name: 'Inpatient Hospital', facilityRate: true },
  { code: '22', name: 'On Campus-Outpatient Hospital', facilityRate: true },
  { code: '23', name: 'Emergency Room - Hospital', facilityRate: true },
  { code: '24', name: 'Ambulatory Surgical Center', facilityRate: true },
  { code: '25', name: 'Birthing Center', facilityRate: false },
  { code: '26', name: 'Military Treatment Facility', facilityRate: true },
  { code: '31', name: 'Skilled Nursing Facility', facilityRate: true },
  { code: '32', name: 'Nursing Facility', facilityRate: false },
  { code: '33', name: 'Custodial Care Facility', facilityRate: false },
  { code: '34', name: 'Hospice', facilityRate: true },
  { code: '41', name: 'Ambulance - Land', facilityRate: true },
  { code: '42', name: 'Ambulance - Air or Water', facilityRate: true },
  { code: '49', name: 'Independent Clinic', facilityRate: false },
  { code: '50', name: 'Federally Qualified Health Center', facilityRate: false },
  { code: '51', name: 'Inpatient Psychiatric Facility', facilityRate: true },
  { code: '52', name: 'Psychiatric Facility-Partial Hospitalization', facilityRate: true },
  { code: '53', name: 'Community Mental Health Center', facilityRate: true },
  { code: '54', name: 'Intermediate Care Facility/Individuals with Intellectual Disabilities', facilityRate: false },
  { code: '55', name: 'Residential Substance Abuse Treatment Facility', facilityRate: false },
  { code: '56', name: 'Psychiatric Residential Treatment Center', facilityRate: true },
  { code: '57', name: 'Non-residential Substance Abuse Treatment Facility', facilityRate: false },
  { code: '58', name: 'Non-residential Opioid Treatment Facility', facilityRate: false },
  { code: '60', name: 'Mass Immunization Center', facilityRate: false },
  { code: '61', name: 'Comprehensive Inpatient Rehabilitation Facility', facilityRate: true },
  { code: '62', name: 'Comprehensive Outpatient Rehabilitation Facility', facilityRate: false },
  { code: '65', name: 'End-Stage Renal Disease Treatment Facility', facilityRate: true },
  { code: '71', name: 'Public Health Clinic', facilityRate: false },
  { code: '72', name: 'Rural Health Clinic', facilityRate: false },
  { code: '81', name: 'Independent Laboratory', facilityRate: false },
  { code: '99', name: 'Other Place of Service', facilityRate: false },
];
