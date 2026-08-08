import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/config/env";
import { logger } from "@/shared/logging/logger";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends applicant-facing notification emails. Falls back to logging the
 * full message instead of sending when SMTP_HOST isn't configured, so the
 * feature works (and is verifiable) in local dev without a mail server or
 * fabricated credentials. A send failure is always caught and logged here,
 * never thrown - notifying an applicant is a side effect of a status
 * change, not a precondition for it, so it must never fail the request
 * that triggered it.
 */
export class EmailService {
  private readonly transporter: Transporter | null;

  constructor() {
    this.transporter = env.SMTP_HOST
      ? nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth: env.SMTP_USER && env.SMTP_PASSWORD ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
        })
      : null;
  }

  async send(input: SendEmailInput): Promise<void> {
    if (!this.transporter) {
      logger.info(
        { to: input.to, subject: input.subject, html: input.html },
        `[DEV EMAIL] SMTP_HOST not configured - logging instead of sending: "${input.subject}" to ${input.to}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({ from: env.SMTP_FROM, to: input.to, subject: input.subject, html: input.html });
    } catch (err) {
      logger.error({ err, to: input.to, subject: input.subject }, "Failed to send email");
    }
  }
}
