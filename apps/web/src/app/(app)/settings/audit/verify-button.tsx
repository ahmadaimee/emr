'use client';

import { useState, useTransition } from 'react';
import { runVerificationAction } from './actions';
import { Button } from '@/components/ui';

export function VerifyButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<any | null>(null);

  const handleVerify = () => {
    startTransition(async () => {
      const res = await runVerificationAction();
      setResult(res);
    });
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <Button variant="secondary" disabled={pending} onClick={handleVerify}>
          {pending ? 'Verifying HMAC Chain...' : 'Verify Cryptographic Integrity'}
        </Button>
      </div>

      {result ? (
        <div
          className={`mt-3 rounded-md border p-3 text-xs ${
            result.success && result.result.ok
              ? 'border-ok/30 bg-ok-soft/30 text-ok'
              : 'border-danger/30 bg-danger-soft text-danger'
          }`}
        >
          {result.success && result.result.ok ? (
            <div>
              <span className="font-semibold">✓ Audit Chain Intact:</span> Verified{' '}
              {result.result.checked} events (Sequence {result.result.fromSequence} →{' '}
              {result.result.toSequence}). Zero discrepancies detected.
            </div>
          ) : (
            <div>
              <span className="font-semibold">✗ Verification Failed:</span>{' '}
              {result.error || result.result?.reason || 'Hash mismatch detected in audit log.'}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
