const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const express = require("express");
const session = require("express-session");
const bookingRouter = require("./routes/booking");
const authRouter = require("./routes/auth");
const myAppointmentsRouter = require("./routes/myAppointments");
const bookingSuccessRouter = require("./routes/bookingSuccess");

const app = express();
const port = process.env.PORT || 3000;
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set in .env or the server environment.");
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  },
}));
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});
app.use("/", authRouter);
app.use("/booking", bookingRouter);
app.use("/booking-success", bookingSuccessRouter);
app.use("/my-appointments", myAppointmentsRouter);

app.get("/", (_req, res) => {
  res.render("index", {
    clinicName: "Lakeside Medical Clinic",
    area: "JLT, Dubai",
    tagline: "Expert care, close to home",
    address: "Cluster X, JLT, Dubai",
    phone: "+971 4 555 0123",
  });
});

app.listen(port, () => {
  console.log(`Lakeside Medical Clinic is listening on http://localhost:${port}`);
});
