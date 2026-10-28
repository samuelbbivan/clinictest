const express = require("express");
const appointmentService = require("../services/appointmentService");
const emailService = require("../services/emailService");
const stripeService = require("../services/stripeService");

const router = express.Router();

router.get("/", async (req, res) => {
  const sessionId = typeof req.query.session_id === "string" ? req.query.session_id : "";
  if (!sessionId || sessionId.length > 255) {
    res.status(400).render("booking-success", {
      clinicName: "Lakeside Medical Clinic",
      area: "JLT, Dubai",
      appointment: null,
      paid: false,
      message: "We couldn't verify the payment session. No appointment payment has been confirmed.",
    });
    return;
  }

  try {
    const appointment = appointmentService.getBookingByStripeSessionId(sessionId);
    if (!appointment) {
      res.status(404).render("booking-success", {
        clinicName: "Lakeside Medical Clinic",
        area: "JLT, Dubai",
        appointment: null,
        paid: false,
        message: "We couldn't find an appointment for this payment session.",
      });
      return;
    }

    const checkout = await stripeService.retrieveCheckoutSession(sessionId);
    const verifiedPayment = checkout.payment_status === "paid"
      && checkout.mode === "payment"
      && checkout.currency === "aed"
      && checkout.amount_total === 10000
      && checkout.metadata?.appointmentId === String(appointment.id)
      && checkout.client_reference_id === String(appointment.id);

    let paid = false;
    if (verifiedPayment) {
      paid = appointment.status === "Booked" || appointmentService.markBookingPaid(appointment.id, sessionId);
      let confirmedAppointment = appointmentService.getBookingByStripeSessionId(sessionId);
      if (!paid) {
        paid = confirmedAppointment?.status === "Booked";
      }

      if (paid && confirmedAppointment && !confirmedAppointment.confirmationEmailSentAt) {
        const claimedAt = new Date().toISOString();
        let emailClaimed = false;
        try {
          emailClaimed = appointmentService.claimConfirmationEmailSend(confirmedAppointment.id, claimedAt);
          if (emailClaimed) {
            await emailService.sendConfirmation(confirmedAppointment);
          }
        } catch (error) {
          console.error("Unable to send appointment confirmation email:", error.message);
          if (emailClaimed) {
            try {
              appointmentService.releaseConfirmationEmailSend(confirmedAppointment.id, claimedAt);
            } catch (releaseError) {
              console.error("Unable to release appointment email claim:", releaseError.message);
            }
          }
        }
      }
    }

    res.render("booking-success", {
      clinicName: "Lakeside Medical Clinic",
      area: "JLT, Dubai",
      appointment: appointmentService.getBookingByStripeSessionId(sessionId),
      paid,
      message: paid
        ? "Payment received. Your appointment is confirmed."
        : "Payment was not completed, so your appointment is still Pending.",
    });
  } catch (error) {
    console.error("Unable to verify Stripe checkout session:", error.message);
    res.status(503).render("booking-success", {
      clinicName: "Lakeside Medical Clinic",
      area: "JLT, Dubai",
      appointment: appointmentService.getBookingByStripeSessionId(sessionId),
      paid: false,
      message: "We couldn't verify your payment just now. Your appointment remains Pending until payment is confirmed.",
    });
  }
});

module.exports = router;
