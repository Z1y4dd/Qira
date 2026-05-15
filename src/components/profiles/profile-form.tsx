'use client';

import { useActionState } from 'react';
import { ArabicText } from '@/components/arabic-text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export interface ProfileFormState {
  error?: {
    _form?: string[];
    displayName?: string[];
    age?: string[];
    gradeBand?: string[];
  };
}

export type ProfileAction = (
  prev: ProfileFormState | undefined,
  formData: FormData,
) => Promise<ProfileFormState>;

export interface ProfileFormDefaults {
  displayName?: string;
  age?: number;
  gradeBand?: 'k' | '1-2' | '3-4' | '5-6';
}

const GRADE_OPTIONS: Array<{ value: 'k' | '1-2' | '3-4' | '5-6'; labelAr: string }> = [
  { value: 'k', labelAr: 'التمهيدي / KG' },
  { value: '1-2', labelAr: 'الصف 1–2' },
  { value: '3-4', labelAr: 'الصف 3–4' },
  { value: '5-6', labelAr: 'الصف 5–6' },
];

export function ProfileForm({
  action,
  defaults,
  submitLabelAr,
  pendingLabelAr,
  childId,
}: {
  action: ProfileAction;
  defaults?: ProfileFormDefaults;
  submitLabelAr: string;
  pendingLabelAr: string;
  /** When editing, render a hidden input the Server Action reads to identify the child. */
  childId?: string;
}) {
  const [state, formAction, pending] = useActionState<ProfileFormState | undefined, FormData>(
    action,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-5">
      {childId && <input type="hidden" name="childId" value={childId} />}
      <div className="space-y-2">
        <Label htmlFor="displayName">
          <ArabicText size="ui">اسم الطفل</ArabicText>
        </Label>
        <Input
          id="displayName"
          name="displayName"
          type="text"
          placeholder="مثلاً: أحمد"
          required
          defaultValue={defaults?.displayName}
          aria-invalid={Boolean(state?.error?.displayName)}
        />
        {state?.error?.displayName?.[0] && (
          <ArabicText size="caption" className="block text-destructive">
            {state.error.displayName[0]}
          </ArabicText>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="age">
          <ArabicText size="ui">العمر</ArabicText>
        </Label>
        <Input
          id="age"
          name="age"
          type="number"
          min={5}
          max={12}
          inputMode="numeric"
          required
          defaultValue={defaults?.age}
          dir="ltr"
          aria-invalid={Boolean(state?.error?.age)}
        />
        {state?.error?.age?.[0] && (
          <ArabicText size="caption" className="block text-destructive">
            {state.error.age[0]}
          </ArabicText>
        )}
      </div>

      <div className="space-y-2">
        <Label>
          <ArabicText size="ui">الصف الدراسي</ArabicText>
        </Label>
        <RadioGroup
          name="gradeBand"
          defaultValue={defaults?.gradeBand}
          className="grid grid-cols-2 gap-3"
        >
          {GRADE_OPTIONS.map((opt) => (
            <Label
              key={opt.value}
              htmlFor={`grade-${opt.value}`}
              className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
            >
              <RadioGroupItem id={`grade-${opt.value}`} value={opt.value} />
              <ArabicText size="ui">{opt.labelAr}</ArabicText>
            </Label>
          ))}
        </RadioGroup>
        {state?.error?.gradeBand?.[0] && (
          <ArabicText size="caption" className="block text-destructive">
            {state.error.gradeBand[0]}
          </ArabicText>
        )}
      </div>

      {state?.error?._form?.[0] && (
        <ArabicText size="caption" className="block text-destructive">
          {state.error._form[0]}
        </ArabicText>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        <ArabicText size="ui">{pending ? pendingLabelAr : submitLabelAr}</ArabicText>
      </Button>
    </form>
  );
}
