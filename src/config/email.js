const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendMail({ to, subject, html, attachments }) {
  return transporter.sendMail({
    from: `"ATLAS Career Platform" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    attachments,
  });
}

module.exports = { sendMail };
