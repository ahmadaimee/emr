'use client';

import { useTransition } from 'react';
import { postRemittance } from '../actions';
import { Button } from '@/components/ui';

export function PostButton({ remittanceId, disabled }: { remittanceId: string; disabled: boolean }) {
  const [pending, startTransition] = useTransition();

  const handlePost = () => {
    startTransition(async () => {
      await postRemittance(remittanceId);
    });
  };

  return (
    <Button
      variant="primary"
      disabled={disabled || pending}
      onClick={handlePost}
    >
      {pending ? 'Posting...' : 'Post Remittance'}
    </Button>
  );
}
