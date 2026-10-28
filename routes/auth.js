const bcrypt = require("bcryptjs");
const express = require("express");
const appointmentService = require("../services/appointmentService");

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function renderAuth(res, page, { errors = {}, form = {}, status = 200 } = {}) {
  res.status(status).render(page, {
    clinicName: "Lakeside Medical Clinic",
    area: "JLT, Dubai",
    errors,
    form,
  });
}

function startSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }
      req.session.user = { id: user.id, name: user.name, email: user.email };
      req.session.save((saveError) => saveError ? reject(saveError) : resolve());
    });
  });
}

router.get("/register", (_req, res) => renderAuth(res, "auth/register"));

router.post("/register", async (req, res) => {
  const name = text(req.body.name);
  const email = text(req.body.email).toLowerCase();
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const errors = {};

  if (name.length < 2 || name.length > 100) {
    errors.name = "Enter your name (2 to 100 characters).";
  }
  if (email.length > 254 || !emailPattern.test(email)) {
    errors.email = "Enter a valid email address.";
  }
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    errors.password = "Use a password between 8 and 72 characters.";
  }
  if (Object.keys(errors).length) {
    return renderAuth(res, "auth/register", {
      errors,
      form: { name, email },
      status: 400,
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = appointmentService.createUser({ name, email, passwordHash });
    await startSession(req, user);
    return res.redirect("/my-appointments");
  } catch (error) {
    if (error.code === "ERR_SQLITE_ERROR" && error.errcode === 2067) {
      return renderAuth(res, "auth/register", {
        errors: { email: "An account with this email already exists." },
        form: { name, email },
        status: 409,
      });
    }
    console.error("Unable to register patient:", error);
    return renderAuth(res, "auth/register", {
      errors: { form: "We couldn't create your account. Please try again." },
      form: { name, email },
      status: 500,
    });
  }
});

router.get("/login", (_req, res) => renderAuth(res, "auth/login"));

router.post("/login", async (req, res) => {
  const email = text(req.body.email).toLowerCase();
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!emailPattern.test(email) || password.length === 0 || Buffer.byteLength(password, "utf8") > 72) {
    return renderAuth(res, "auth/login", {
      errors: { form: "Email or password is incorrect." },
      form: { email },
      status: 400,
    });
  }

  try {
    const user = appointmentService.getUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return renderAuth(res, "auth/login", {
        errors: { form: "Email or password is incorrect." },
        form: { email },
        status: 401,
      });
    }

    await startSession(req, user);
    return res.redirect("/my-appointments");
  } catch (error) {
    console.error("Unable to log in patient:", error);
    return renderAuth(res, "auth/login", {
      errors: { form: "We couldn't log you in. Please try again." },
      form: { email },
      status: 500,
    });
  }
});

router.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

module.exports = router;
