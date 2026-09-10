/**
 * CMS-1500 (02/12) coordinate map, in PDF points on US Letter (612 × 792), origin at
 * the bottom-left as PDF requires.
 *
 * The form is OCR-scanned by payers and alignment tolerances are tight. These
 * coordinates are a calibrated starting point for the official NUCC template; the
 * alignment page (`renderAlignmentPage`) prints every field label at its position so a
 * printed sheet can be laid over pre-printed red-ink stock and the map adjusted per
 * printer. Store per-practice offsets in `printer_calibration`, not here.
 *
 * Text is Courier 10pt: the form's OCR spec expects fixed-pitch, 10 characters per inch.
 */
export interface FieldBox {
  x: number;
  y: number;
  /** Max characters; text is truncated, never wrapped. */
  max: number;
  size?: number;
}

const ROW_H = 24; // 24E service-line row pitch
const LINE1_Y = 331; // baseline of service line 1

export const CMS1500_LAYOUT = {
  box1_medicare: { x: 25, y: 671, max: 1 },
  box1_medicaid: { x: 75, y: 671, max: 1 },
  box1_tricare: { x: 124, y: 671, max: 1 },
  box1_champva: { x: 190, y: 671, max: 1 },
  box1_group: { x: 240, y: 671, max: 1 },
  box1_feca: { x: 304, y: 671, max: 1 },
  box1_other: { x: 353, y: 671, max: 1 },
  box1a: { x: 382, y: 671, max: 29 },

  box2: { x: 25, y: 647, max: 28 },
  box3_dob: { x: 240, y: 647, max: 10 },
  box3_m: { x: 320, y: 647, max: 1 },
  box3_f: { x: 349, y: 647, max: 1 },
  box4: { x: 382, y: 647, max: 29 },

  box5_street: { x: 25, y: 623, max: 28 },
  box6_self: { x: 254, y: 623, max: 1 },
  box6_spouse: { x: 283, y: 623, max: 1 },
  box6_child: { x: 312, y: 623, max: 1 },
  box6_other: { x: 341, y: 623, max: 1 },
  box7_street: { x: 382, y: 623, max: 29 },

  box5_city: { x: 25, y: 599, max: 24 },
  box5_state: { x: 210, y: 599, max: 2 },
  box7_city: { x: 382, y: 599, max: 24 },
  box7_state: { x: 545, y: 599, max: 2 },

  box5_zip: { x: 25, y: 575, max: 12 },
  box5_phone: { x: 120, y: 575, max: 14 },
  box7_zip: { x: 382, y: 575, max: 12 },
  box7_phone: { x: 480, y: 575, max: 14 },

  box9: { x: 25, y: 551, max: 28 },
  box10a_y: { x: 261, y: 551, max: 1 },
  box10a_n: { x: 304, y: 551, max: 1 },
  box11: { x: 382, y: 551, max: 29 },

  box9a: { x: 25, y: 527, max: 28 },
  box10b_y: { x: 261, y: 527, max: 1 },
  box10b_n: { x: 304, y: 527, max: 1 },
  box10b_state: { x: 330, y: 527, max: 2 },
  box11a_dob: { x: 390, y: 527, max: 10 },
  box11a_m: { x: 510, y: 527, max: 1 },
  box11a_f: { x: 553, y: 527, max: 1 },

  box10c_y: { x: 261, y: 503, max: 1 },
  box10c_n: { x: 304, y: 503, max: 1 },
  box11b: { x: 382, y: 503, max: 29 },

  box9d: { x: 25, y: 479, max: 28 },
  box11c: { x: 382, y: 479, max: 29 },

  box11d_y: { x: 390, y: 455, max: 1 },
  box11d_n: { x: 419, y: 455, max: 1 },
  box12: { x: 60, y: 431, max: 24 },
  box12_date: { x: 260, y: 431, max: 10 },
  box13: { x: 415, y: 431, max: 24 },

  box14_date: { x: 30, y: 400, max: 10 },
  box14_qual: { x: 135, y: 400, max: 3 },
  box15_qual: { x: 270, y: 400, max: 3 },
  box15_date: { x: 300, y: 400, max: 10 },
  box16_from: { x: 400, y: 400, max: 10 },
  box16_to: { x: 500, y: 400, max: 10 },

  box17_qual: { x: 25, y: 376, max: 2 },
  box17: { x: 50, y: 376, max: 24 },
  box17a: { x: 250, y: 384, max: 12 },
  box17b: { x: 250, y: 376, max: 10 },
  box18_from: { x: 400, y: 376, max: 10 },
  box18_to: { x: 500, y: 376, max: 10 },

  box19: { x: 25, y: 352, max: 55 },
  box20_y: { x: 390, y: 352, max: 1 },
  box20_n: { x: 419, y: 352, max: 1 },
  box20_charges: { x: 460, y: 352, max: 10 },

  box21_ind: { x: 175, y: 340, max: 1 },
  box21: [
    { x: 40, y: 340, max: 8 }, { x: 130, y: 340, max: 8 }, { x: 220, y: 340, max: 8 }, { x: 310, y: 340, max: 8 },
    { x: 40, y: 328, max: 8 }, { x: 130, y: 328, max: 8 }, { x: 220, y: 328, max: 8 }, { x: 310, y: 328, max: 8 },
    { x: 40, y: 316, max: 8 }, { x: 130, y: 316, max: 8 }, { x: 220, y: 316, max: 8 }, { x: 310, y: 316, max: 8 },
  ],
  box22_code: { x: 390, y: 340, max: 2 },
  box22_ref: { x: 460, y: 340, max: 18 },
  box23: { x: 390, y: 316, max: 29 },

  // 24A–J: one row per service line, six rows.
  line: (i: number) => {
    const y = LINE1_Y - 26 - i * ROW_H;
    return {
      from: { x: 25, y, max: 8 },
      to: { x: 90, y, max: 8 },
      pos: { x: 157, y, max: 2 },
      emg: { x: 182, y, max: 1 },
      cpt: { x: 205, y, max: 5 },
      mod1: { x: 250, y, max: 2 },
      mod2: { x: 272, y, max: 2 },
      mod3: { x: 294, y, max: 2 },
      mod4: { x: 316, y, max: 2 },
      pointer: { x: 350, y, max: 4 },
      charge: { x: 385, y, max: 9 },
      units: { x: 450, y, max: 3 },
      epsdt: { x: 478, y, max: 1 },
      renderingNpi: { x: 510, y, max: 10 },
      supplemental: { x: 25, y: y + 12, max: 60, size: 8 },
    } satisfies Record<string, FieldBox>;
  },

  box25: { x: 25, y: 155, max: 10 },
  box25_ssn: { x: 155, y: 155, max: 1 },
  box25_ein: { x: 170, y: 155, max: 1 },
  box26: { x: 195, y: 155, max: 14 },
  box27_y: { x: 320, y: 155, max: 1 },
  box27_n: { x: 349, y: 155, max: 1 },
  box28: { x: 385, y: 155, max: 9 },
  box29: { x: 460, y: 155, max: 9 },
  box30: { x: 535, y: 155, max: 9 },

  box31: { x: 25, y: 110, max: 25, size: 8 },
  box31_date: { x: 25, y: 98, max: 10, size: 8 },
  box32_name: { x: 200, y: 131, max: 26 },
  box32_addr1: { x: 200, y: 119, max: 26 },
  box32_addr2: { x: 200, y: 107, max: 26 },
  box32a: { x: 200, y: 92, max: 10 },
  box33_phone: { x: 470, y: 143, max: 14 },
  box33_name: { x: 382, y: 131, max: 26 },
  box33_addr1: { x: 382, y: 119, max: 26 },
  box33_addr2: { x: 382, y: 107, max: 26 },
  box33a: { x: 382, y: 92, max: 10 },
} as const;

export const CMS1500_MAX_LINES = 6;
