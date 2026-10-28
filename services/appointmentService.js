const db = require("../data/db");

const insertUser = db.prepare(`
  INSERT INTO users (name, email, passwordHash)
  VALUES (?, ?, ?)
`);

const selectUserByEmail = db.prepare(`
  SELECT id, name, email, passwordHash
  FROM users
  WHERE email = ?
`);

const insertBooking = db.prepare(`
  INSERT INTO appointments (
    specialty,
    doctor,
    appointmentDateTime,
    patientName,
    patientPhone,
    patientEmail,
    status
  ) VALUES (?, ?, ?, ?, ?, ?, 'Pending')
`);

const saveStripeSession = db.prepare(`
  UPDATE appointments
  SET stripeSessionId = ?
  WHERE id = ? AND status = 'Pending'
`);

const selectBookingByStripeSessionId = db.prepare(`
  SELECT * FROM appointments
  WHERE stripeSessionId = ?
`);

const confirmPaidBooking = db.prepare(`
  UPDATE appointments
  SET status = 'Booked'
  WHERE id = ? AND status = 'Pending' AND stripeSessionId = ?
`);

const claimConfirmationEmail = db.prepare(`
  UPDATE appointments
  SET confirmationEmailSentAt = ?
  WHERE id = ? AND status = 'Booked' AND confirmationEmailSentAt IS NULL
`);

const releaseConfirmationEmail = db.prepare(`
  UPDATE appointments
  SET confirmationEmailSentAt = NULL
  WHERE id = ? AND confirmationEmailSentAt = ?
`);

const selectBookingsByEmail = db.prepare(`
  SELECT * FROM appointments
  WHERE patientEmail = ?
  ORDER BY createdAt DESC, id DESC
`);

const selectBookingsByDate = db.prepare(`
  SELECT * FROM appointments
  WHERE date(appointmentDateTime) = ?
  ORDER BY appointmentDateTime
`);

const changeBookingStatus = db.prepare(`
  UPDATE appointments
  SET status = ?
  WHERE id = ? AND patientEmail = ? AND status = 'Booked'
`);

function createUser({ name, email, passwordHash }) {
  const result = insertUser.run(name, email, passwordHash);
  return {
    id: Number(result.lastInsertRowid),
    name,
    email,
  };
}

function getUserByEmail(email) {
  return selectUserByEmail.get(email);
}

function createBooking(booking) {
  const result = insertBooking.run(
    booking.specialty,
    booking.doctor,
    booking.appointmentDateTime,
    booking.patientName,
    booking.patientPhone,
    booking.patientEmail,
  );

  return {
    id: Number(result.lastInsertRowid),
    ...booking,
    status: "Pending",
  };
}

function setStripeSessionId(id, sessionId) {
  return saveStripeSession.run(sessionId, id).changes > 0;
}

function getBookingByStripeSessionId(sessionId) {
  return selectBookingByStripeSessionId.get(sessionId);
}

function markBookingPaid(id, sessionId) {
  return confirmPaidBooking.run(id, sessionId).changes > 0;
}

function claimConfirmationEmailSend(id, claimedAt) {
  return claimConfirmationEmail.run(claimedAt, id).changes > 0;
}

function releaseConfirmationEmailSend(id, claimedAt) {
  return releaseConfirmationEmail.run(id, claimedAt).changes > 0;
}

function getBookingsByEmail(email) {
  return selectBookingsByEmail.all(email);
}

function getBookingsByDate(date) {
  return selectBookingsByDate.all(date);
}

function updateStatus(id, status, email) {
  return changeBookingStatus.run(status, id, email).changes > 0;
}

module.exports = {
  createUser,
  getUserByEmail,
  createBooking,
  setStripeSessionId,
  getBookingByStripeSessionId,
  markBookingPaid,
  claimConfirmationEmailSend,
  releaseConfirmationEmailSend,
  getBookingsByEmail,
  getBookingsByDate,
  updateStatus,
};
