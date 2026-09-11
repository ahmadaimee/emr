'use client';

import { useState } from 'react';
import { uploadPatientDocument } from '../actions';

export function UploadDocumentModal({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Lab Report');

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface-raised px-3 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors shadow-xs"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <span>Upload PHI Document</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-line bg-surface-raised p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-base font-semibold text-ink">Upload EHR PHI Document</h2>
                <p className="text-xs text-ink-3">Stored in tenant S3 storage with AES-256 and access logging.</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-ink-4 hover:text-ink text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form
              action={async (fd) => {
                setUploading(true);
                try {
                  await uploadPatientDocument(fd);
                  setOpen(false);
                } finally {
                  setUploading(false);
                }
              }}
              className="mt-4 space-y-3"
            >
              <input type="hidden" name="patientId" value={patientId} />

              <div>
                <label className="block text-xs font-medium text-ink-3">Document Title</label>
                <input
                  name="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lab Results, X-Ray, Referral, Signed Consent..."
                  required
                  className="mt-1 h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-3">Clinical Category</label>
                <select
                  name="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-xs"
                >
                  <option value="Lab Report">Lab Report (HL7 / PDF)</option>
                  <option value="Diagnostic Imaging">Diagnostic Imaging (DICOM / X-Ray PDF)</option>
                  <option value="Clinical Note">External Clinical / Specialist Note</option>
                  <option value="Consent & Legal">HIPAA Consent & Treatment Agreement</option>
                  <option value="Insurance Card">Insurance Card (Front / Back Photo)</option>
                  <option value="Intake Questionnaire">Patient Intake / Medical History Form</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-3">Select File</label>
                <div className="mt-1 flex justify-center rounded-lg border-2 border-dashed border-line-strong px-6 pt-5 pb-6 text-center hover:border-grove transition-colors">
                  <div className="space-y-1 text-center">
                    <svg
                      className="mx-auto h-8 w-8 text-ink-4"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="text-xs text-ink-2">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer rounded-md font-medium text-grove hover:underline focus-within:outline-none"
                      >
                        <span>Choose file</span>
                        <input id="file-upload" name="file" type="file" className="sr-only" />
                      </label>
                      <span className="pl-1">or drag & drop</span>
                    </div>
                    <p className="text-[10px] text-ink-4">PDF, JPG, PNG, DICOM up to 25MB</p>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-line bg-surface-sunken p-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-ink-2">
                    HIPAA compliance: file is encrypted at rest with AES-256, hash verified, and logged in the audit trail.
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-8 rounded-md border border-line-strong bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-sunken"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="h-8 rounded-md bg-grove px-4 text-xs font-medium text-ink-inverse hover:bg-grove-strong transition-colors disabled:opacity-50"
                >
                  {uploading ? 'Encrypting & Storing...' : 'Upload & Encrypt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

