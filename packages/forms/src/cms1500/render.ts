import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from '@cantoo/pdf-lib';
import type { Cms1500Fields } from './fields';
import { CMS1500_LAYOUT, CMS1500_MAX_LINES, type FieldBox } from './layout';

export interface RenderOptions {
  /** The official NUCC form PDF, when rendering a complete image rather than data for pre-printed stock. */
  templatePdf?: Uint8Array;
  /** Per-printer calibration, in points. */
  offset?: { x: number; y: number };
  /** Draw light box outlines and labels for calibration. */
  debug?: boolean;
}

export interface Placement {
  field: string;
  x: number;
  y: number;
  text: string;
}

export interface RenderResult {
  pdf: Uint8Array;
  pages: number;
  /** Every field drawn, for tests and for the calibration overlay. */
  placements: Placement[];
}

/**
 * Render CMS-1500 data. Claims with more than six lines paginate onto continuation
 * forms with box 28 carrying the running total, per NUCC instructions.
 */
export async function renderCms1500(fields: Cms1500Fields, opts: RenderOptions = {}): Promise<RenderResult> {
  const doc = opts.templatePdf ? await PDFDocument.load(opts.templatePdf) : await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Courier);
  const placements: Placement[] = [];
  const dx = opts.offset?.x ?? 0;
  const dy = opts.offset?.y ?? 0;

  const pageCount = Math.max(1, Math.ceil(fields.box24.length / CMS1500_MAX_LINES));
  for (let p = 0; p < pageCount; p++) {
    const page = opts.templatePdf && p < doc.getPageCount() ? doc.getPage(p) : doc.addPage([612, 792]);
    const draw = (field: string, box: FieldBox, text: string | undefined | null) => {
      if (!text) return;
      const t = String(text).slice(0, box.max);
      page.drawText(t, { x: box.x + dx, y: box.y + dy, size: box.size ?? 10, font, color: rgb(0, 0, 0) });
      placements.push({ field, x: box.x + dx, y: box.y + dy, text: t });
      if (opts.debug) outline(page, box, dx, dy, font, field);
    };
    const check = (field: string, box: FieldBox, on: boolean) => draw(field, box, on ? 'X' : '');
    const L = CMS1500_LAYOUT;

    // Header boxes repeat on every page.
    check('box1', L[`box1_${fields.box1}`], true);
    draw('box1a', L.box1a, fields.box1a);
    draw('box2', L.box2, fields.box2);
    draw('box3_dob', L.box3_dob, fields.box3_dob);
    check('box3_m', L.box3_m, fields.box3_sex === 'M');
    check('box3_f', L.box3_f, fields.box3_sex === 'F');
    draw('box4', L.box4, fields.box4);
    draw('box5_street', L.box5_street, fields.box5_street);
    draw('box5_city', L.box5_city, fields.box5_city);
    draw('box5_state', L.box5_state, fields.box5_state);
    draw('box5_zip', L.box5_zip, fields.box5_zip);
    draw('box5_phone', L.box5_phone, fields.box5_phone);
    check('box6', L[`box6_${fields.box6}`], true);
    draw('box7_street', L.box7_street, fields.box7_street);
    draw('box7_city', L.box7_city, fields.box7_city);
    draw('box7_state', L.box7_state, fields.box7_state);
    draw('box7_zip', L.box7_zip, fields.box7_zip);
    draw('box9', L.box9, fields.box9);
    draw('box9a', L.box9a, fields.box9a);
    draw('box9d', L.box9d, fields.box9d);
    check('box10a', fields.box10a ? L.box10a_y : L.box10a_n, true);
    check('box10b', fields.box10b ? L.box10b_y : L.box10b_n, true);
    draw('box10b_state', L.box10b_state, fields.box10b_state);
    check('box10c', fields.box10c ? L.box10c_y : L.box10c_n, true);
    draw('box11', L.box11, fields.box11);
    draw('box11a_dob', L.box11a_dob, fields.box11a_dob);
    check('box11a_m', L.box11a_m, fields.box11a_sex === 'M');
    check('box11a_f', L.box11a_f, fields.box11a_sex === 'F');
    draw('box11c', L.box11c, fields.box11c);
    check('box11d', fields.box11d ? L.box11d_y : L.box11d_n, true);
    draw('box12', L.box12, fields.box12);
    draw('box13', L.box13, fields.box13);
    draw('box14', L.box14_date, fields.box14);
    draw('box14_qual', L.box14_qual, fields.box14_qual);
    draw('box17_qual', L.box17_qual, fields.box17_qual);
    draw('box17', L.box17, fields.box17);
    draw('box17b', L.box17b, fields.box17b);
    draw('box18_from', L.box18_from, fields.box18_from);
    draw('box18_to', L.box18_to, fields.box18_to);
    draw('box21_ind', L.box21_ind, fields.box21_icd);
    fields.box21.forEach((code, i) => draw(`box21_${'ABCDEFGHIJKL'[i]}`, L.box21[i]!, code));
    draw('box22_code', L.box22_code, fields.box22_code);
    draw('box22_ref', L.box22_ref, fields.box22_ref);
    draw('box23', L.box23, fields.box23);

    const lines = fields.box24.slice(p * CMS1500_MAX_LINES, (p + 1) * CMS1500_MAX_LINES);
    lines.forEach((l, i) => {
      const row = L.line(i);
      draw(`24A_from_${i}`, row.from, l.from);
      draw(`24A_to_${i}`, row.to, l.to);
      draw(`24B_${i}`, row.pos, l.pos);
      draw(`24C_${i}`, row.emg, l.emg);
      draw(`24D_cpt_${i}`, row.cpt, l.cpt);
      draw(`24D_mod1_${i}`, row.mod1, l.mods[0]);
      draw(`24D_mod2_${i}`, row.mod2, l.mods[1]);
      draw(`24D_mod3_${i}`, row.mod3, l.mods[2]);
      draw(`24D_mod4_${i}`, row.mod4, l.mods[3]);
      draw(`24E_${i}`, row.pointer, l.pointer);
      draw(`24F_${i}`, row.charge, l.charge);
      draw(`24G_${i}`, row.units, l.units);
      draw(`24H_${i}`, row.epsdt, l.epsdt);
      draw(`24J_${i}`, row.renderingNpi, l.renderingNpi);
    });

    draw('box25', L.box25, fields.box25);
    check('box25_type', fields.box25_type === 'SSN' ? L.box25_ssn : L.box25_ein, true);
    draw('box26', L.box26, fields.box26);
    check('box27', fields.box27 ? L.box27_y : L.box27_n, true);
    // Box 28: on multi-page claims, "CONTINUED" until the last page.
    draw('box28', L.box28, p < pageCount - 1 ? 'CONTINUED' : fields.box28);
    draw('box29', L.box29, p < pageCount - 1 ? '' : fields.box29);
    draw('box31', L.box31, fields.box31);
    draw('box32_name', L.box32_name, fields.box32_name);
    draw('box32_addr1', L.box32_addr1, fields.box32_addr1);
    draw('box32_addr2', L.box32_addr2, fields.box32_addr2);
    draw('box32a', L.box32a, fields.box32a);
    draw('box33_phone', L.box33_phone, fields.box33_phone);
    draw('box33_name', L.box33_name, fields.box33_name);
    draw('box33_addr1', L.box33_addr1, fields.box33_addr1);
    draw('box33_addr2', L.box33_addr2, fields.box33_addr2);
    draw('box33a', L.box33a, fields.box33a);
  }

  return { pdf: await doc.save(), pages: pageCount, placements };
}

/** A sheet with every field label at its coordinate, for lining up against pre-printed stock. */
export async function renderAlignmentPage(offset?: { x: number; y: number }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Courier);
  const dx = offset?.x ?? 0;
  const dy = offset?.y ?? 0;
  for (const [key, box] of Object.entries(CMS1500_LAYOUT)) {
    if (typeof box === 'function') {
      for (let i = 0; i < CMS1500_MAX_LINES; i++) for (const [k, b] of Object.entries(box(i))) outline(page, b, dx, dy, font, `${k}${i + 1}`);
      continue;
    }
    if (Array.isArray(box)) {
      box.forEach((b, i) => outline(page, b, dx, dy, font, `21${'ABCDEFGHIJKL'[i]}`));
      continue;
    }
    outline(page, box as FieldBox, dx, dy, font, key.replace('box', ''));
  }
  return doc.save();
}

function outline(page: PDFPage, box: FieldBox, dx: number, dy: number, font: PDFFont, label: string) {
  const w = (box.max || 1) * 6;
  page.drawRectangle({ x: box.x + dx - 1, y: box.y + dy - 3, width: w, height: (box.size ?? 10) + 4, borderColor: rgb(0.85, 0.2, 0.2), borderWidth: 0.4, opacity: 0 });
  page.drawText(label, { x: box.x + dx, y: box.y + dy, size: 6, font, color: rgb(0.85, 0.2, 0.2) });
}
