import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || 'SwarmMind <onboarding@resend.dev>';
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function sendVerificationEmail(to: string, otpCode: string, magicToken: string) {
  const magicLink = `${FRONTEND_URL}/verify-email?token=${magicToken}`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: 'Verify your SwarmMind account',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <span style="font-size: 48px;">🐝</span>
          <h1 style="margin: 8px 0 0; font-size: 24px; background: linear-gradient(to right, #2563eb, #9333ea); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">SwarmMind</h1>
        </div>

        <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">
          Enter this code to verify your email:
        </p>

        <div style="background: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111827; font-family: monospace;">
            ${otpCode}
          </span>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">
          Or click the button below:
        </p>

        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${magicLink}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(to right, #2563eb, #9333ea); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Verify Email
          </a>
        </div>

        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          This code expires in 10 minutes. If you didn't create an account, ignore this email.
        </p>
      </div>
    `,
  });
}
