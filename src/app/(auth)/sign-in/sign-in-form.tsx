'use client';

import { useActionState, useState, useTransition } from 'react';
import { ArabicText } from '@/components/arabic-text';
import { GoogleButton } from '@/components/auth/google-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Separator } from '@/components/ui/separator';
import { resendFromSignInAction, type SignInActionState, signInAction } from './actions';

export function SignInForm({ resetOk }: { resetOk: boolean }) {
  const [state, formAction, pending] = useActionState<SignInActionState | undefined, FormData>(
    signInAction,
    undefined,
  );
  const [resendStatus, setResendStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [resendPending, startResend] = useTransition();

  return (
    <>
      {resetOk && (
        <ArabicText
          size="ui"
          as="div"
          className="mb-4 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-green-800"
        >
          تم تحديث كلمة المرور — سجّل الدخول الآن
        </ArabicText>
      )}

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">
            <ArabicText size="ui">البريد الإلكتروني</ArabicText>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            required
            aria-invalid={Boolean(state?.error?.email)}
          />
          {state?.error?.email?.[0] && (
            <ArabicText size="caption" className="block text-destructive">
              {state.error.email[0]}
            </ArabicText>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">
            <ArabicText size="ui">كلمة المرور</ArabicText>
          </Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(state?.error?.password)}
          />
          {state?.error?.password?.[0] && (
            <ArabicText size="caption" className="block text-destructive">
              {state.error.password[0]}
            </ArabicText>
          )}
        </div>

        {state?.error?._form?.[0] && (
          <ArabicText size="caption" className="block text-destructive">
            {state.error._form[0]}
          </ArabicText>
        )}

        {state?.unverifiedEmail && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 space-y-2">
            <ArabicText size="caption" as="div" className="block text-amber-900">
              لم نتلقَّ تأكيد بريدك. اضغط أدناه لإعادة إرسال الرسالة.
            </ArabicText>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={resendPending || resendStatus === 'sent'}
              onClick={() => {
                startResend(async () => {
                  const result = await resendFromSignInAction(state.unverifiedEmail ?? '');
                  setResendStatus('error' in result ? 'error' : 'sent');
                });
              }}
            >
              <ArabicText size="caption">
                {resendStatus === 'sent' ? 'تم الإرسال' : 'أعد إرسال رسالة التأكيد'}
              </ArabicText>
            </Button>
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          <ArabicText size="ui">{pending ? 'جارٍ الدخول…' : 'تسجيل الدخول'}</ArabicText>
        </Button>

        <Separator />

        <GoogleButton />
      </form>
    </>
  );
}
