'use client';

import { useState, useTransition } from 'react';
import { ArabicText } from '@/components/arabic-text';
import { Button } from '@/components/ui/button';
import { resendVerificationAction, signOutAction } from './actions';

export function VerifyEmailActions() {
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={pending || status === 'sent'}
        onClick={() => {
          startTransition(async () => {
            const result = await resendVerificationAction();
            if ('error' in result) {
              setStatus('error');
              setErrorMsg(result.error);
            } else {
              setStatus('sent');
            }
          });
        }}
      >
        <ArabicText size="ui">
          {pending ? 'جارٍ الإرسال…' : status === 'sent' ? 'تم الإرسال' : 'أعد إرسال الرسالة'}
        </ArabicText>
      </Button>

      {status === 'error' && (
        <ArabicText size="caption" className="block text-destructive text-center">
          {errorMsg}
        </ArabicText>
      )}

      <form action={signOutAction}>
        <Button type="submit" variant="ghost" size="sm" className="w-full">
          <ArabicText size="caption">تسجيل الخروج</ArabicText>
        </Button>
      </form>
    </div>
  );
}
