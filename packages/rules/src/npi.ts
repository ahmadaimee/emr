/**
 * NPI check digit — Luhn over the 10 digits with the constant prefix 80840 (the
 * ISO health-industry identifier) prepended. A syntactically invalid NPI is a
 * guaranteed front-end rejection, so this runs at data entry as well as at scrub.
 */
export function isValidNpi(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  const digits = ('80840' + npi).split('').map(Number);
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i]!;
    if (alternate) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}
