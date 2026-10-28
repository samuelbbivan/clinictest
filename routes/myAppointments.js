const express = require("express");
const appointmentService = require("../services/appointmentService");

const router = express.Router();

router.use((req, res, next) => {
  if (!req.session.user) {
    res.redirect("/login");
    return;
  }
  next();
});

router.get("/", (req, res, next) => {
  try {
    res.render("my-appointments", {
      clinicName: "Lakeside Medical Clinic",
      area: "JLT, Dubai",
      appointments: appointmentService.getBookingsByEmail(req.session.user.email),
      error: null,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/cancel", (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    res.status(400).send("Invalid appointment ID.");
    return;
  }

  try {
    const cancelled = appointmentService.updateStatus(id, "Cancelled", req.session.user.email);
    if (!cancelled) {
      res.status(404).send("Appointment not found or cannot be cancelled.");
      return;
    }
    res.redirect("/my-appointments");
  } catch (error) {
    next(error);
  }
});

module.exports = router;
