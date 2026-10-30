import nodemailer from "nodemailer";

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    throw new Error("Email delivery is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD.");
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number.parseInt(SMTP_PORT ?? "587", 10),
    secure: SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

export async function sendVerificationEmail({ email, fullName, token }) {
  const origin = process.env.APP_ORIGIN;
  if (!origin) throw new Error("APP_ORIGIN is required to send account verification links.");
  const verificationUrl = new URL("/verify-email", origin);
  verificationUrl.searchParams.set("token", token);
  const transport = createTransport();

  await transport.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: "Verify your EzehLabs account",
    text: `Hello ${fullName},\n\nVerify your email address by opening this link:\n${verificationUrl}\n\nThis link expires in 24 hours. If you did not create an account, you can ignore this message.`,
  });
}

export async function sendAdminLoginCode({ email, fullName, code }) {
  const transport = createTransport();
  await transport.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: "Your EzehLabs admin sign-in code",
    text: `Hello ${fullName},\n\nYour EzehLabs administrator sign-in code is ${code}.\n\nIt expires in 10 minutes and can only be used once. If you did not try to sign in, you can ignore this message.`,
  });
}
