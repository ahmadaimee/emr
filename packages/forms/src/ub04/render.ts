import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from '@cantoo/pdf-lib';
import type { Ub04Fields } from './fields';
import { UB04_LINES_PER_PAGE, UB04_TOTALS_REVENUE_CODE } from './fields';
import { UB04_LAYOUT, type FieldBox } from './layout';
import type { Placement, RenderOptions, RenderResult } from '../cms1500/render';

export type { Placement, RenderOptions, RenderResult };

/**
 * Render UB-04 data.
 *
 * Claims with more than 22 revenue lines continue onto further sheets. Two rules govern
 * that, and both matter to whether the payer accepts the bill:
 *
 *  - Only the LAST page carries the 0001 totals line, and it totals the whole claim,
 *    not the page. A per-page subtotal would not reconcile against FL 47.
 *  - Every page carries "PAGE x OF y" in the FL 45 line-23 area, because the pages are
 *    separated in handling and a sheet that does not say which claim it belongs to is
 *    a returned bill.
 */
export async function renderUb04(fields: Ub04Fields, opts: RenderOptions = {}): Promise<RenderResult> {
  const doc = opts.templatePdf ? await PDFDocument.load(opts.templatePdf) : await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Courier);
  const placements: Placement[] = [];
  const dx = opts.offset?.x ?? 0;
  const dy = opts.offset?.y ?? 0;

  const pageCount = Math.max(1, Math.ceil(fields.lines.length / UB04_LINES_PER_PAGE));

  for (let p = 0; p < pageCount; p++) {
    const page = opts.templatePdf && p < doc.getPageCount() ? doc.getPage(p) : doc.addPage([612, 792]);
    const isLast = p === pageCount - 1;

    const draw = (field: string, box: FieldBox, text: string | undefined | null) => {
      if (!text) return;
      const t = String(text).slice(0, box.max);
      page.drawText(t, { x: box.x + dx, y: box.y + dy, size: box.size ?? 8, font, color: rgb(0, 0, 0) });
      placements.push({ field, x: box.x + dx, y: box.y + dy, text: t });
      if (opts.debug) outline(page, box, dx, dy, font, field);
    };
    const L = UB04_LAYOUT;

    // Header repeats on every page — each sheet has to stand on its own.
    draw('fl1_name', L.fl1_name, fields.fl1_name);
    draw('fl1_addr1', L.fl1_addr1, fields.fl1_addr1);
    draw('fl1_addr2', L.fl1_addr2, fields.fl1_addr2);
    draw('fl1_phone', L.fl1_phone, fields.fl1_phone);
    draw('fl2_name', L.fl2_name, fields.fl2_name);
    draw('fl2_addr1', L.fl2_addr1, fields.fl2_addr1);
    draw('fl2_addr2', L.fl2_addr2, fields.fl2_addr2);
    draw('fl3a', L.fl3a, fields.fl3a);
    draw('fl3b', L.fl3b, fields.fl3b);
    draw('fl4', L.fl4, fields.fl4);
    draw('fl5', L.fl5, fields.fl5);
    draw('fl6_from', L.fl6_from, fields.fl6_from);
    draw('fl6_through', L.fl6_through, fields.fl6_through);

    draw('fl8a', L.fl8a, fields.fl8a);
    draw('fl8b', L.fl8b, fields.fl8b);
    draw('fl9a', L.fl9a, fields.fl9a);
    draw('fl9b', L.fl9b, fields.fl9b);
    draw('fl9c', L.fl9c, fields.fl9c);
    draw('fl9d', L.fl9d, fields.fl9d);
    draw('fl9e', L.fl9e, fields.fl9e);
    draw('fl10', L.fl10, fields.fl10);
    draw('fl11', L.fl11, fields.fl11);

    draw('fl12', L.fl12, fields.fl12);
    draw('fl13', L.fl13, fields.fl13);
    draw('fl14', L.fl14, fields.fl14);
    draw('fl15', L.fl15, fields.fl15);
    draw('fl16', L.fl16, fields.fl16);
    draw('fl17', L.fl17, fields.fl17);

    fields.fl18_28.forEach((code, i) => draw(`fl${18 + i}`, L.fl18_28[i]!, code));
    draw('fl29', L.fl29, fields.fl29);

    fields.fl31_34.forEach((o, i) => {
      draw(`fl${31 + i}_code`, L.fl31_34[i]!.code, o.code);
      draw(`fl${31 + i}_date`, L.fl31_34[i]!.date, o.date);
    });
    fields.fl35_36.forEach((o, i) => {
      draw(`fl${35 + i}_code`, L.fl35_36[i]!.code, o.code);
      draw(`fl${35 + i}_from`, L.fl35_36[i]!.from, o.from);
      draw(`fl${35 + i}_through`, L.fl35_36[i]!.through, o.through);
    });

    draw('fl38_name', L.fl38_name, fields.fl38_name);
    draw('fl38_addr1', L.fl38_addr1, fields.fl38_addr1);
    draw('fl38_addr2', L.fl38_addr2, fields.fl38_addr2);

    fields.fl39_41.forEach((v, i) => {
      draw(`fl39_41_${i}_code`, L.fl39_41[i]!.code, v.code);
      draw(`fl39_41_${i}_amount`, L.fl39_41[i]!.amount, v.amount);
    });

    // The revenue grid — this page's slice only.
    const slice = fields.lines.slice(p * UB04_LINES_PER_PAGE, (p + 1) * UB04_LINES_PER_PAGE);
    slice.forEach((l, i) => {
      const row = L.line(i);
      draw(`fl42_${i}`, row.fl42, l.fl42);
      draw(`fl43_${i}`, row.fl43, l.fl43);
      draw(`fl44_${i}`, row.fl44, l.fl44);
      draw(`fl45_${i}`, row.fl45, l.fl45);
      draw(`fl46_${i}`, row.fl46, l.fl46);
      draw(`fl47_${i}`, row.fl47, l.fl47);
      draw(`fl48_${i}`, row.fl48, l.fl48);
    });

    draw('pageOf', L.pageOf, `PAGE ${p + 1} OF ${pageCount}`);
    draw('creationDate', L.creationDate, fields.creationDate);

    // Totals belong to the claim, so they print once, on the last sheet.
    if (isLast) {
      draw('totals_fl42', L.totals.fl42, fields.totals.fl42 || UB04_TOTALS_REVENUE_CODE);
      draw('totals_fl47', L.totals.fl47, fields.totals.fl47);
      draw('totals_fl48', L.totals.fl48, fields.totals.fl48);
    }

    // Payer block, up to three rows.
    fields.payers.forEach((pay, i) => {
      const row = L.payers[i];
      if (!row) return;
      draw(`fl50_${i}`, row.fl50, pay.fl50);
      draw(`fl51_${i}`, row.fl51, pay.fl51);
      draw(`fl52_${i}`, row.fl52, pay.fl52);
      draw(`fl53_${i}`, row.fl53, pay.fl53);
      draw(`fl54_${i}`, row.fl54, pay.fl54);
      draw(`fl55_${i}`, row.fl55, pay.fl55);
      draw(`fl57_${i}`, row.fl57, fields.fl57[i]);
      draw(`fl58_${i}`, row.fl58, pay.fl58);
      draw(`fl59_${i}`, row.fl59, pay.fl59);
      draw(`fl60_${i}`, row.fl60, pay.fl60);
      draw(`fl61_${i}`, row.fl61, pay.fl61);
      draw(`fl62_${i}`, row.fl62, pay.fl62);
      draw(`fl63_${i}`, row.fl63, pay.fl63);
      draw(`fl64_${i}`, row.fl64, pay.fl64);
      draw(`fl65_${i}`, row.fl65, pay.fl65);
    });
    draw('fl56', L.fl56, fields.fl56);

    draw('fl66', L.fl66, fields.fl66);
    draw('fl67', L.fl67, fields.fl67);
    draw('fl67_poa', L.fl67_poa, fields.fl67_poa);
    fields.fl67_other.forEach((d, i) => {
      draw(`fl67_${'ABCDEFGHIJKLMNOPQ'[i]}`, L.fl67_other[i]!.code, d.code);
      draw(`fl67_${'ABCDEFGHIJKLMNOPQ'[i]}_poa`, L.fl67_other[i]!.poa, d.poa);
    });
    draw('fl69', L.fl69, fields.fl69);
    fields.fl70.forEach((r, i) => draw(`fl70_${'abc'[i]}`, L.fl70[i]!, r));
    draw('fl71', L.fl71, fields.fl71);
    fields.fl72.forEach((d, i) => {
      draw(`fl72_${'abc'[i]}`, L.fl72[i]!.code, d.code);
      draw(`fl72_${'abc'[i]}_poa`, L.fl72[i]!.poa, d.poa);
    });
    draw('fl74_code', L.fl74.code, fields.fl74.code);
    draw('fl74_date', L.fl74.date, fields.fl74.date);
    fields.fl74_other.forEach((pr, i) => {
      draw(`fl74_${'abcde'[i]}_code`, L.fl74_other[i]!.code, pr.code);
      draw(`fl74_${'abcde'[i]}_date`, L.fl74_other[i]!.date, pr.date);
    });

    for (const [key, boxes] of [
      ['fl76', L.fl76],
      ['fl77', L.fl77],
      ['fl78', L.fl78],
      ['fl79', L.fl79],
    ] as const) {
      const v = fields[key];
      draw(`${key}_npi`, boxes.npi, v.npi);
      draw(`${key}_qual`, boxes.qual, v.qual);
      draw(`${key}_id`, boxes.id, v.id);
      draw(`${key}_last`, boxes.last, v.last);
      draw(`${key}_first`, boxes.first, v.first);
    }

    draw('fl80', L.fl80, fields.fl80);
    fields.fl81.forEach((cc, i) => {
      draw(`fl81_${'abcd'[i]}_qual`, L.fl81[i]!.qualifier, cc.qualifier);
      draw(`fl81_${'abcd'[i]}_code`, L.fl81[i]!.code, cc.code);
    });
  }

  return { pdf: await doc.save(), pages: pageCount, placements };
}

/** A sheet with every locator label at its coordinate, for lining up pre-printed stock. */
export async function renderUb04AlignmentPage(offset?: { x: number; y: number }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Courier);
  const dx = offset?.x ?? 0;
  const dy = offset?.y ?? 0;

  const walk = (value: unknown, label: string) => {
    if (!value) return;
    if (typeof value === 'function') {
      for (let i = 0; i < UB04_LINES_PER_PAGE; i++) {
        for (const [k, b] of Object.entries((value as (n: number) => Record<string, FieldBox>)(i))) {
          outline(page, b, dx, dy, font, `${k}${i + 1}`);
        }
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${label}${i + 1}`));
      return;
    }
    if (typeof value === 'object' && 'x' in (value as FieldBox) && 'y' in (value as FieldBox)) {
      outline(page, value as FieldBox, dx, dy, font, label);
      return;
    }
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) walk(v, `${label}.${k}`);
  };

  for (const [key, box] of Object.entries(UB04_LAYOUT)) walk(box, key.replace('fl', ''));
  return doc.save();
}

function outline(page: PDFPage, box: FieldBox, dx: number, dy: number, font: PDFFont, label: string) {
  page.drawText(label, { x: box.x + dx, y: box.y + dy, size: 5, font, color: rgb(0.85, 0.2, 0.2) });
}
