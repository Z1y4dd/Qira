# Supabase Email Template Drafts (Arabic)

These are the four Arabic email templates the user must paste into the Supabase
dashboard at `Authentication → Email Templates`. All template variables (e.g.
`{{ .ConfirmationURL }}`, `{{ .Email }}`) are Supabase's standard handlebars-style
template variables — leave them exactly as-shown.

The placeholder copy below is in Fusha (Modern Standard Arabic). The user
should review and adjust tone before public launch.

---

## 1. Confirm Sign-up

**Where:** `Authentication → Email Templates → Confirm signup`

**Subject:**

```
تأكيد البريد الإلكتروني لقِراءة
```

**Body (HTML):**

```html
<div dir="rtl" lang="ar" style="font-family: 'Cairo', 'Segoe UI', system-ui, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 22px; margin: 0 0 16px;">السلام عليكم 👋</h1>
  <p style="font-size: 16px; line-height: 1.7; margin: 0 0 16px;">
    شكراً لتسجيلك في <strong>قِراءة</strong>. اضغط الزرّ أدناه لتأكيد بريدك الإلكتروني وتفعيل حسابك:
  </p>
  <p style="margin: 24px 0;">
    <a href="{{ .ConfirmationURL }}"
       style="display: inline-block; padding: 12px 24px; background: #111; color: #fff; text-decoration: none; border-radius: 8px; font-size: 16px;">
      تأكيد البريد الإلكتروني
    </a>
  </p>
  <p style="font-size: 14px; line-height: 1.7; color: #666; margin: 24px 0 0;">
    إذا لم تكن أنت من سجّل، يمكنك تجاهل هذه الرسالة.
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
  <p style="font-size: 12px; color: #999; margin: 0;">
    فريق قِراءة — تطبيق القراءة العربية للأطفال
  </p>
</div>
```

---

## 2. Magic Link

**Where:** `Authentication → Email Templates → Magic Link`

> Note: Magic Link is not used in Phase 2's main flow (we use password + Google).
> Supabase still requires a template here — leave a minimal version in case the
> flow is enabled later.

**Subject:**

```
رابط الدخول السريع لقِراءة
```

**Body (HTML):**

```html
<div dir="rtl" lang="ar" style="font-family: 'Cairo', system-ui, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px;">
  <p style="font-size: 16px; line-height: 1.7;">
    اضغط الزرّ أدناه لتسجيل الدخول إلى حسابك في <strong>قِراءة</strong>:
  </p>
  <p style="margin: 24px 0;">
    <a href="{{ .ConfirmationURL }}"
       style="display: inline-block; padding: 12px 24px; background: #111; color: #fff; text-decoration: none; border-radius: 8px;">
      تسجيل الدخول
    </a>
  </p>
  <p style="font-size: 14px; color: #666;">صلاحية الرابط محدودة، ولن يعمل بعد فترة وجيزة.</p>
</div>
```

---

## 3. Change Email Address

**Where:** `Authentication → Email Templates → Change Email Address`

**Subject:**

```
تأكيد البريد الإلكتروني الجديد لقِراءة
```

**Body (HTML):**

```html
<div dir="rtl" lang="ar" style="font-family: 'Cairo', system-ui, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px;">
  <p style="font-size: 16px; line-height: 1.7;">
    تلقّينا طلباً لتغيير البريد الإلكتروني المرتبط بحسابك في <strong>قِراءة</strong>.
  </p>
  <p style="margin: 24px 0;">
    <a href="{{ .ConfirmationURL }}"
       style="display: inline-block; padding: 12px 24px; background: #111; color: #fff; text-decoration: none; border-radius: 8px;">
      تأكيد البريد الجديد
    </a>
  </p>
  <p style="font-size: 14px; color: #666;">
    إذا لم تطلب هذا التغيير، يمكنك تجاهل هذه الرسالة — البريد الأصلي يبقى نشطاً.
  </p>
</div>
```

---

## 4. Reset Password

**Where:** `Authentication → Email Templates → Reset Password`

**Subject:**

```
إعادة تعيين كلمة المرور لقِراءة
```

**Body (HTML):**

```html
<div dir="rtl" lang="ar" style="font-family: 'Cairo', system-ui, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px;">
  <p style="font-size: 16px; line-height: 1.7;">
    تلقّينا طلباً لإعادة تعيين كلمة المرور لحسابك في <strong>قِراءة</strong>. اضغط الزرّ أدناه لاختيار كلمة مرور جديدة:
  </p>
  <p style="margin: 24px 0;">
    <a href="{{ .ConfirmationURL }}"
       style="display: inline-block; padding: 12px 24px; background: #111; color: #fff; text-decoration: none; border-radius: 8px;">
      إعادة تعيين كلمة المرور
    </a>
  </p>
  <p style="font-size: 14px; color: #666;">
    إذا لم تطلب هذا، يمكنك تجاهل هذه الرسالة — كلمة المرور الحالية تبقى صالحة.
  </p>
</div>
```

---

## Additional Supabase Dashboard Config

After pasting the templates:

1. **`Authentication → URL Configuration`** — set:
   - **Site URL:** the production Vercel URL (e.g., `https://qira-<hash>.vercel.app`)
   - **Additional Redirect URLs:** add `http://localhost:3000` for local dev, plus any Vercel preview URL patterns.

2. **`Authentication → Providers → Email`** — confirm enabled (default on).

3. **(Optional, post-Phase-2) `Authentication → Providers → Google`** — paste the OAuth client ID + secret from Google Cloud Console, then set `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true` in Vercel env vars.

## GitHub Secrets

For CI to run the cross-user E2E spec:

1. Go to **Repo Settings → Secrets and variables → Actions → New repository secret**.
2. Add `SUPABASE_SERVICE_ROLE_KEY` with the value from your `.env.local`.
3. Also add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or update CI workflow to inject them from a different source).

The CI workflow already runs Playwright; the new spec files (`auth-flow.spec.ts`, `auth-cross-user.spec.ts`) will exercise the admin API once the secret is set.
