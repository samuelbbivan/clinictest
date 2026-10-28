const nodemailer = require("nodemailer");

const clinicName = "Lakeside Medical Clinic";
const clinicAddress = "Cluster X, JLT, Dubai";

function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  const port = Number(SMTP_PORT);
  if (!SMTP_HOST || !Number.isInteger(port) || port < 1 || port > 65535
      || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    throw new Error("Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM to send appointment emails.");
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

function sendConfirmation(appointment) {
  const [date, time] = appointment.appointmentDateTime.split("T");
  return createTransporter().sendMail({
    from: {
      name: clinicName,
      address: process.env.SMTP_FROM,
    },
    to: appointment.patientEmail,
    subject: "Your appointment is confirmed",
    text: [
      `Hello ${appointment.patientName},`,
      "",
      "Your appointment is confirmed.",
      "",
      `Specialty: ${appointment.specialty}`,
      `Doctor: ${appointment.doctor}`,
      `Date: ${date}`,
      `Time: ${time.slice(0, 5)}`,
      `Clinic address: ${clinicAddress}`,
      "",
      `London International · lisrc.ae · by ${clinicAddress}`,
      "",
      `${clinicName} · built at Sam`,
    ].join("\n"),
  });
}

module.exports = { sendConfirmation };
