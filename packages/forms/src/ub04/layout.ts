/**
 * UB-04 (CMS-1450) coordinate map, in PDF points on US Letter (612 × 792), origin at
 * the bottom-left as PDF requires.
 *
 * Like the CMS-1500 this is a calibrated starting point for the official form; the
 * alignment page prints every locator label at its position so a printed sheet can be
 * laid over pre-printed stock and the map adjusted per printer. Store per-practice
 * offsets in `printer_calibration`, not here.
 *
 * The UB-04 is denser than the CMS-1500: 8pt Courier rather than 10pt, because the
 * revenue-line grid gives each row about 13 points of height.
 */
import type { FieldBox } from '../cms1500/layout';

export type { FieldBox };

/** Baseline of revenue line 1, and the pitch between lines. */
const LINE1_Y = 447;
const ROW_H = 13.2;

/** Column x-positions for the three payer rows in FL 50–65. */
const PAYER_ROW_Y = [316, 303, 290];
/** FL 58–65 sit in a second block lower on the form, same three rows. */
const INSURED_ROW_Y = [246, 233, 220];

export const UB04_LAYOUT = {
  // --- FL 1–6: provider, patient control, type of bill, tax id, period -------
  fl1_name: { x: 22, y: 742, max: 32, size: 8 },
  fl1_addr1: { x: 22, y: 733, max: 32, size: 8 },
  fl1_addr2: { x: 22, y: 724, max: 32, size: 8 },
  fl1_phone: { x: 22, y: 715, max: 20, size: 8 },
  fl2_name: { x: 178, y: 742, max: 30, size: 8 },
  fl2_addr1: { x: 178, y: 733, max: 30, size: 8 },
  fl2_addr2: { x: 178, y: 724, max: 30, size: 8 },
  fl3a: { x: 396, y: 745, max: 22, size: 8 },
  fl3b: { x: 396, y: 733, max: 22, size: 8 },
  fl4: { x: 522, y: 745, max: 4, size: 8 },
  fl5: { x: 396, y: 715, max: 16, size: 8 },
  fl6_from: { x: 484, y: 715, max: 6, size: 8 },
  fl6_through: { x: 528, y: 715, max: 6, size: 8 },

  // --- FL 8–11: patient identity -------------------------------------------
  fl8a: { x: 30, y: 688, max: 18, size: 8 },
  fl8b: { x: 30, y: 678, max: 46, size: 8 },
  fl9a: { x: 30, y: 666, max: 40, size: 8 },
  fl9b: { x: 246, y: 666, max: 22, size: 8 },
  fl9c: { x: 392, y: 666, max: 2, size: 8 },
  fl9d: { x: 414, y: 666, max: 10, size: 8 },
  fl9e: { x: 470, y: 666, max: 2, size: 8 },
  fl10: { x: 30, y: 650, max: 8, size: 8 },
  fl11: { x: 96, y: 650, max: 1, size: 8 },

  // --- FL 12–17: admission and discharge -----------------------------------
  fl12: { x: 116, y: 650, max: 6, size: 8 },
  fl13: { x: 160, y: 650, max: 2, size: 8 },
  fl14: { x: 184, y: 650, max: 1, size: 8 },
  fl15: { x: 204, y: 650, max: 1, size: 8 },
  fl16: { x: 226, y: 650, max: 2, size: 8 },
  fl17: { x: 250, y: 650, max: 2, size: 8 },

  // --- FL 18–28: condition codes -------------------------------------------
  fl18_28: Array.from({ length: 11 }, (_, i) => ({ x: 276 + i * 24, y: 650, max: 2, size: 8 })),
  fl29: { x: 544, y: 650, max: 2, size: 8 },

  // --- FL 31–34: occurrence codes and dates --------------------------------
  fl31_34: Array.from({ length: 4 }, (_, i) => ({
    code: { x: 30 + i * 74, y: 618, max: 2, size: 8 },
    date: { x: 50 + i * 74, y: 618, max: 6, size: 8 },
  })),

  // --- FL 35–36: occurrence spans ------------------------------------------
  fl35_36: Array.from({ length: 2 }, (_, i) => ({
    code: { x: 330, y: 618 - i * 13, max: 2, size: 8 },
    from: { x: 352, y: 618 - i * 13, max: 6, size: 8 },
    through: { x: 400, y: 618 - i * 13, max: 6, size: 8 },
  })),

  // --- FL 38: responsible party --------------------------------------------
  fl38_name: { x: 30, y: 586, max: 40, size: 8 },
  fl38_addr1: { x: 30, y: 576, max: 40, size: 8 },
  fl38_addr2: { x: 30, y: 566, max: 40, size: 8 },

  // --- FL 39–41: value codes, three columns of four ------------------------
  fl39_41: Array.from({ length: 12 }, (_, i) => {
    const col = Math.floor(i / 4);
    const row = i % 4;
    return {
      code: { x: 330 + col * 78, y: 592 - row * 11, max: 2, size: 8 },
      amount: { x: 352 + col * 78, y: 592 - row * 11, max: 10, size: 8 },
    };
  }),

  // --- FL 42–48: the revenue grid, 22 lines --------------------------------
  line: (i: number) => {
    const y = LINE1_Y - i * ROW_H;
    return {
      fl42: { x: 24, y, max: 4, size: 8 },
      fl43: { x: 62, y, max: 26, size: 8 },
      fl44: { x: 246, y, max: 18, size: 8 },
      fl45: { x: 360, y, max: 6, size: 8 },
      fl46: { x: 404, y, max: 7, size: 8 },
      fl47: { x: 452, y, max: 12, size: 8 },
      fl48: { x: 530, y, max: 11, size: 8 },
    } satisfies Record<string, FieldBox>;
  },
  /** Line 23 — the totals row. */
  totals: {
    fl42: { x: 24, y: LINE1_Y - 22 * ROW_H, max: 4, size: 8 },
    fl47: { x: 452, y: LINE1_Y - 22 * ROW_H, max: 12, size: 8 },
    fl48: { x: 530, y: LINE1_Y - 22 * ROW_H, max: 11, size: 8 },
  },
  creationDate: { x: 360, y: LINE1_Y - 22 * ROW_H, max: 6, size: 8 },
  pageOf: { x: 246, y: LINE1_Y - 22 * ROW_H, max: 16, size: 8 },

  // --- FL 50–57: payer block, three rows -----------------------------------
  payers: PAYER_ROW_Y.map((y, i) => ({
    fl50: { x: 24, y, max: 24, size: 8 },
    fl51: { x: 168, y, max: 16, size: 8 },
    fl52: { x: 268, y, max: 1, size: 8 },
    fl53: { x: 296, y, max: 1, size: 8 },
    fl54: { x: 322, y, max: 12, size: 8 },
    fl55: { x: 404, y, max: 12, size: 8 },
    fl57: { x: 486, y, max: 14, size: 8 },
    // FL 58–65 live in the lower block but belong to the same payer row.
    fl58: { x: 24, y: INSURED_ROW_Y[i]!, max: 26, size: 8 },
    fl59: { x: 186, y: INSURED_ROW_Y[i]!, max: 2, size: 8 },
    fl60: { x: 212, y: INSURED_ROW_Y[i]!, max: 20, size: 8 },
    fl61: { x: 348, y: INSURED_ROW_Y[i]!, max: 16, size: 8 },
    fl62: { x: 458, y: INSURED_ROW_Y[i]!, max: 16, size: 8 },
    fl63: { x: 24, y: INSURED_ROW_Y[i]! - 40, max: 30, size: 8 },
    fl64: { x: 232, y: INSURED_ROW_Y[i]! - 40, max: 26, size: 8 },
    fl65: { x: 424, y: INSURED_ROW_Y[i]! - 40, max: 22, size: 8 },
  })),
  fl56: { x: 486, y: 330, max: 10, size: 8 },

  // --- FL 66–75: diagnoses and procedures ----------------------------------
  fl66: { x: 30, y: 168, max: 1, size: 8 },
  fl67: { x: 48, y: 168, max: 8, size: 8 },
  fl67_poa: { x: 92, y: 168, max: 1, size: 6 },
  /** FL 67 A–Q run across two rows of nine and eight. */
  fl67_other: Array.from({ length: 17 }, (_, i) => {
    const row = i < 9 ? 0 : 1;
    const col = i < 9 ? i : i - 9;
    return {
      code: { x: 104 + col * 52, y: 168 - row * 14, max: 8, size: 8 },
      poa: { x: 146 + col * 52, y: 168 - row * 14, max: 1, size: 6 },
    };
  }),
  fl69: { x: 30, y: 128, max: 8, size: 8 },
  fl70: Array.from({ length: 3 }, (_, i) => ({ x: 96 + i * 52, y: 128, max: 8, size: 8 })),
  fl71: { x: 260, y: 128, max: 4, size: 8 },
  fl72: Array.from({ length: 3 }, (_, i) => ({
    code: { x: 306 + i * 52, y: 128, max: 8, size: 8 },
    poa: { x: 348 + i * 52, y: 128, max: 1, size: 6 },
  })),
  fl74: { code: { x: 30, y: 106, max: 8, size: 8 }, date: { x: 76, y: 106, max: 6, size: 8 } },
  fl74_other: Array.from({ length: 5 }, (_, i) => ({
    code: { x: 126 + i * 78, y: 106, max: 8, size: 8 },
    date: { x: 172 + i * 78, y: 106, max: 6, size: 8 },
  })),

  // --- FL 76–79: providers --------------------------------------------------
  fl76: providerBoxes(24, 82),
  fl77: providerBoxes(310, 82),
  fl78: providerBoxes(24, 58),
  fl79: providerBoxes(310, 58),

  // --- FL 80–81 -------------------------------------------------------------
  fl80: { x: 24, y: 34, max: 56, size: 8 },
  fl81: Array.from({ length: 4 }, (_, i) => ({
    qualifier: { x: 400, y: 44 - i * 10, max: 2, size: 7 },
    code: { x: 420, y: 44 - i * 10, max: 14, size: 7 },
  })),
} as const;

function providerBoxes(x: number, y: number) {
  return {
    npi: { x: x + 34, y, max: 10, size: 8 },
    qual: { x: x + 110, y, max: 2, size: 8 },
    id: { x: x + 130, y, max: 14, size: 8 },
    last: { x: x + 34, y: y - 10, max: 20, size: 8 },
    first: { x: x + 168, y: y - 10, max: 12, size: 8 },
  } satisfies Record<string, FieldBox>;
}
