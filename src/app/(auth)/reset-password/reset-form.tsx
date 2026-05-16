'use client';

import { useActionState } from 'react';
import { ArabicText } from '@/components/arabic-text';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { applyResetAction, type ResetApplyActionState } from './actions';

export function ResetForm() {
  const [state, formAction, pending] = useActionState<ResetApplyActionState | undefined, FormData>(
    applyResetAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">
          <ArabicText size="ui">كلمة المرور الجديدة</ArabicText>
        </Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state?.error?.password)}
        />
        {state?.error?.password?.[0] && (
          <ArabicText size="caption" className="block text-destructive">
            {state.error.password[0]}
          </ArabicText>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">
          <ArabicText size="ui">أعد إدخال كلمة المرور</ArabicText>
        </Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state?.error?.confirmPassword)}
        />
        {state?.error?.confirmPassword?.[0] && (
          <ArabicText size="caption" className="block text-destructive">
            {state.error.confirmPassword[0]}
          </ArabicText>
        )}
      </div>

      {state?.error?._form?.[0] && (
        <ArabicText size="caption" className="block text-destructive">
          {state.error._form[0]}
        </ArabicText>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        <ArabicText size="ui">{pending ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور الجديدة'}</ArabicText>
      </Button>
    </form>
  );
}
