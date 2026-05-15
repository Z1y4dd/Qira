'use client';

import { useActionState } from 'react';
import { ArabicText } from '@/components/arabic-text';
import { GoogleButton } from '@/components/auth/google-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { type SignUpActionState, signUpAction } from './actions';

export function SignUpForm() {
  const [state, formAction, pending] = useActionState<SignUpActionState | undefined, FormData>(
    signUpAction,
    undefined,
  );

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

      <div className="space-y-2">
        <Label htmlFor="password">
          <ArabicText size="ui">كلمة المرور</ArabicText>
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          dir="ltr"
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

      {state?.error?._form?.[0] && (
        <ArabicText size="caption" className="block text-destructive">
          {state.error._form[0]}
        </ArabicText>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        <ArabicText size="ui">{pending ? 'جارٍ الإنشاء…' : 'إنشاء الحساب'}</ArabicText>
      </Button>

      <Separator />

      <GoogleButton />
    </form>
  );
}
