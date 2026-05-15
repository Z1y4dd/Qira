'use client';

import { useActionState } from 'react';
import { ArabicText } from '@/components/arabic-text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type ResetRequestActionState, requestResetAction } from './actions';

export function ResetRequestForm() {
  const [state, formAction, pending] = useActionState<
    ResetRequestActionState | undefined,
    FormData
  >(requestResetAction, undefined);

  if (state?.ok) {
    return (
      <div className="space-y-4 text-center">
        <ArabicText size="reader" className="block text-2xl">
          تحقّق من بريدك الإلكتروني
        </ArabicText>
        <ArabicText size="ui" className="block text-muted-foreground">
          إن كان البريد مسجّلاً لدينا، ستصلك رسالة بها رابط لإعادة تعيين كلمة المرور.
        </ArabicText>
      </div>
    );
  }

  return (
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

      {state?.error?._form?.[0] && (
        <ArabicText size="caption" className="block text-destructive">
          {state.error._form[0]}
        </ArabicText>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        <ArabicText size="ui">{pending ? 'جارٍ الإرسال…' : 'أرسل الرابط'}</ArabicText>
      </Button>
    </form>
  );
}
