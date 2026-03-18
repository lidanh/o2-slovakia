import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { buildInviteHtml } from "./templates/invite";
import { buildTrainingHtml } from "./templates/training";
import { buildFeedbackHtml, type FeedbackEmailParams } from "./templates/feedback";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    // Supabase Inbucket SMTP (local dev)
    transporter = nodemailer.createTransport({
      host: "127.0.0.1",
      port: 54325,
      secure: false,
      tls: { rejectUnauthorized: false },
    });
  } else {
    // AWS SES SMTP (production)
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST!,
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!,
      },
    });
  }

  return transporter;
}

export async function sendInvitationEmail(
  to: string,
  inviterName: string,
  inviteUrl: string,
  tenantName?: string
): Promise<void> {
  const html = buildInviteHtml(inviterName, inviteUrl, tenantName);

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || "O2 Trainer <noreply@o2trainer.sk>",
    to,
    subject: tenantName
      ? `You have been invited to ${tenantName} on O2 Trainer`
      : "You have been invited to O2 Trainer",
    html,
  });
}

export async function sendFeedbackEmail(
  to: string,
  params: FeedbackEmailParams
): Promise<void> {
  const html = buildFeedbackHtml(params);

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || "O2 Trainer <noreply@o2trainer.sk>",
    to,
    subject: params.language === "sk"
      ? `Spätná väzba z tréningu: ${params.scenarioName} — ${params.score}/100`
      : params.language === "hu"
        ? `Képzési visszajelzés: ${params.scenarioName} — ${params.score}/100`
        : `Training Feedback: ${params.scenarioName} — ${params.score}/100`,
    html,
  });
}

export async function sendTrainingEmail(
  to: string,
  params: {
    scenarioName: string;
    difficultyName: string;
    trainingUrl: string;
    senderName: string;
  }
): Promise<void> {
  const html = buildTrainingHtml(params);

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || "O2 Trainer <noreply@o2trainer.sk>",
    to,
    subject: `Training Assignment: ${params.scenarioName}`,
    html,
  });
}
