// Zod schemas for every auth + profile Server Action input.
//
// Arabic error messages flow through to the rendered form errors — the calling
// Server Action returns these via the RHF state object.

import { z } from 'zod';
import { ArabicText as ArabicTextSchema } from './zod';

// Email + password — used by sign-up, sign-in, reset-request
const emailField = z.string().email('أدخل بريداً إلكترونياً صحيحاً');

const passwordField = z
  .string()
  .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
  .regex(/[A-Za-z]/, 'يجب أن تحتوي على حرف لاتيني واحد على الأقل')
  .regex(/[0-9]/, 'يجب أن تحتوي على رقم واحد على الأقل');

// Auth surface schemas -----------------------------------------------------

export const SignUpInput = z.object({
  email: emailField,
  password: passwordField,
});
export type SignUpInput = z.infer<typeof SignUpInput>;

export const SignInInput = z.object({
  email: emailField,
  password: z.string().min(1, 'أدخل كلمة المرور'),
});
export type SignInInput = z.infer<typeof SignInInput>;

export const ResetRequestInput = z.object({
  email: emailField,
});
export type ResetRequestInput = z.infer<typeof ResetRequestInput>;

export const ResetApplyInput = z
  .object({
    password: passwordField,
    confirmPassword: z.string().min(1, 'أعد إدخال كلمة المرور'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين',
    path: ['confirmPassword'],
  });
export type ResetApplyInput = z.infer<typeof ResetApplyInput>;

// Child profile surface schemas --------------------------------------------

const gradeBand = z.enum(['k', '1-2', '3-4', '5-6'], {
  message: 'اختر صفّاً',
});

const ageField = z.coerce
  .number()
  .int('أدخل عمراً صحيحاً')
  .min(5, 'العمر يجب أن يكون 5 سنوات على الأقل')
  .max(12, 'العمر يجب ألا يتجاوز 12 سنة');

const displayNameField = ArabicTextSchema.refine((s) => s.length <= 30, {
  message: 'الاسم يجب ألا يتجاوز 30 حرفاً',
});

export const CreateChildProfileInput = z.object({
  displayName: displayNameField,
  age: ageField,
  gradeBand,
});
export type CreateChildProfileInput = z.infer<typeof CreateChildProfileInput>;

export const UpdateChildProfileInput = CreateChildProfileInput;
export type UpdateChildProfileInput = z.infer<typeof UpdateChildProfileInput>;

// Delete confirmation — type-the-name modal --------------------------------

export const DeleteChildConfirmInput = z.object({
  confirmName: z.string().min(1, 'اكتب اسم الطفل للتأكيد'),
});
export type DeleteChildConfirmInput = z.infer<typeof DeleteChildConfirmInput>;
