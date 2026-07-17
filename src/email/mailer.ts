import nodemailer from "nodemailer";
import { config } from "../config";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!config.email.smtpHost || !config.email.user || !config.email.password) {
    throw new Error(
      "Chua cau hinh email - can dien EMAIL_SMTP_HOST, EMAIL_USER, EMAIL_PASSWORD trong bien moi truong thi moi gui email duoc."
    );
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.email.smtpHost,
      port: config.email.smtpPort,
      secure: config.email.smtpSecure,
      auth: { user: config.email.user, pass: config.email.password },
    });
  }
  return transporter;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  cc?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ messageId: string }> {
  const info = await getTransporter().sendMail({
    from: config.email.user,
    to: input.to,
    cc: input.cc,
    subject: input.subject,
    text: input.text,
  });
  return { messageId: info.messageId };
}
