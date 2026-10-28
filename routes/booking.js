const express = require("express");
const appointmentService = require("../services/appointmentService");
const stripeService = require("../services/stripeService");

const router = express.Router();

const clinicName = "Lakeside Medical Clinic";
const area = "JLT, Dubai";
const specialties = {
  "General Physician": ["Dr. Sara Ahmed"],
  ENT: ["Dr. Lina Haddad"],
  Dentist: ["Dr. Omar Khan"],
  Cardiologist: ["Dr. Raj Mehta"],
};

const timeSlots = [];
for (let minutes = 9 * 60; minutes < 21 * 60; minutes += 30) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const remainder = String(minutes % 60).padStart(2, "0");
  timeSlots.push(`${hours}:${remainder}`);
}

function field(body, name) {
  return typeof body[name] === "string" ? body[name].trim() : "";
}

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renderBooking(res, { step, form = {}, errors = {}, review = false, confirmed = false, bookingId = null, status = 200 }) {
  res.status(status).render("booking", {
    clinicName,
    area,
    specialties,
    timeSlots,
    today: todayString(),
    step,
    form,
    errors,
    review,
    confirmed,
    bookingId,
  });
}

function validateSpecialty(form, errors) {
  if (!Object.hasOwn(specialties, form.specialty)) {
    errors.specialty = "Choose a specialty from the list.";
  }
}

function validateDoctor(form, errors) {
  validateSpecialty(form, errors);
  if (!errors.specialty && !specialties[form.specialty].includes(form.doctor)) {
    errors.doctor = "Choose a doctor for the selected specialty.";
  }
}

function validateAppointment(form, errors) {
  validateDoctor(form, errors);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
    errors.date = "Enter a valid appointment date.";
  } else {
    const [year, month, day] = form.date.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      errors.date = "Enter a valid appointment date.";
    } else if (form.date < todayString()) {
      errors.date = "Choose today or a future date.";
    } else if (date.getDay() === 0) {
      errors.date = "The clinic is closed on Sundays.";
    }
  }

  if (!timeSlots.includes(form.time)) {
    errors.time = "Choose an available 30-minute time slot.";
  }
}

function validatePatient(form, errors) {
  validateAppointment(form, errors);

  if (form.name.length < 2 || form.name.length > 100) {
    errors.name = "Enter your name (2 to 100 characters).";
  }

  const phoneDigits = form.phone.replace(/\D/g, "");
  if (!/^\+?[\d\s().-]+$/.test(form.phone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
    errors.phone = "Enter a valid phone number with 7 to 15 digits.";
  }

  if (form.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = "Enter a valid email address.";
  }
}

function getForm(body) {
  const form = {
    specialty: field(body, "specialty"),
    doctor: field(body, "doctor"),
    date: field(body, "date"),
    time: field(body, "time"),
    name: field(body, "name"),
    phone: field(body, "phone"),
    email: field(body, "email"),
  };
  if (form.date && form.time) {
    form.appointmentDateTime = `${form.date}T${form.time}:00`;
  }
  return form;
}

router.get("/", (req, res) => {
  renderBooking(res, {
    step: 1,
    errors: req.query.payment === "cancelled"
      ? { form: "Payment was not completed. Your appointment remains Pending until the deposit is paid." }
      : {},
    form: res.locals.currentUser ? {
      name: res.locals.currentUser.name,
      email: res.locals.currentUser.email,
    } : {},
  });
});

router.post("/", async (req, res) => {
  const step = field(req.body, "step");
  const form = getForm(req.body);
  if (req.session.user) {
    form.name = req.session.user.name;
    form.email = req.session.user.email;
  }
  const errors = {};

  if (step === "specialty") {
    validateSpecialty(form, errors);
    return renderBooking(res, { step: errors.specialty ? 1 : 2, form, errors });
  }

  if (step === "doctor") {
    validateDoctor(form, errors);
    return renderBooking(res, { step: errors.specialty ? 1 : errors.doctor ? 2 : 3, form, errors });
  }

  if (step === "appointment") {
    validateAppointment(form, errors);
    const hasAppointmentErrors = errors.specialty || errors.doctor || errors.date || errors.time;
    return renderBooking(res, {
      step: errors.specialty ? 1 : errors.doctor ? 2 : hasAppointmentErrors ? 3 : 4,
      form,
      errors,
    });
  }

  if (step === "patient") {
    validatePatient(form, errors);
    const firstInvalidStep = errors.specialty ? 1 : errors.doctor ? 2 : errors.date || errors.time ? 3 : 4;
    return renderBooking(res, {
      step: Object.keys(errors).length ? firstInvalidStep : 4,
      form,
      errors,
      review: Object.keys(errors).length === 0,
    });
  }

  if (step === "confirm") {
    validatePatient(form, errors);
    const hasErrors = Object.keys(errors).length > 0;
    const firstInvalidStep = errors.specialty ? 1 : errors.doctor ? 2 : errors.date || errors.time ? 3 : 4;
    if (!hasErrors) {
      let booking;
      try {
        booking = appointmentService.createBooking({
          specialty: form.specialty,
          doctor: form.doctor,
          appointmentDateTime: form.appointmentDateTime,
          patientName: form.name,
          patientPhone: form.phone,
          patientEmail: form.email,
        });
      } catch (error) {
        console.error("Unable to save pending appointment:", error);
        return renderBooking(res, {
          step: 4,
          form,
          review: true,
          errors: { form: "We couldn't save your appointment. Please try again." },
          status: 500,
        });
      }

      try {
        const checkout = await stripeService.createDepositCheckoutSession(booking);
        if (!checkout.url || !appointmentService.setStripeSessionId(booking.id, checkout.id)) {
          throw new Error("Stripe checkout session could not be linked to the pending appointment.");
        }
        return res.redirect(303, checkout.url);
      } catch (error) {
        console.error("Unable to create deposit checkout session:", error.message);
        return renderBooking(res, {
          step: 4,
          form,
          review: true,
          bookingId: booking.id,
          errors: {
            form: "Your appointment is saved as Pending, but payment checkout could not be started. Please contact the clinic for help.",
          },
          status: 503,
        });
      }
    }

    return renderBooking(res, {
      step: firstInvalidStep,
      form,
      errors,
    });
  }

  return renderBooking(res, {
    step: 1,
    form,
    errors: { form: "Your booking form expired. Please start again." },
    status: 400,
  });
});

module.exports = router;
