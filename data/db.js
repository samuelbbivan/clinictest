const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const defaultDatabasePath = process.env.VERCEL
  ? path.join("/tmp", "lakeside.db")
  : path.join(__dirname, "lakeside.db");
const databasePath = path.resolve(process.env.DB_PATH || defaultDatabasePath);
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new DatabaseSync(databasePath);

db.exec(`
  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    specialty TEXT NOT NULL,
    doctor TEXT NOT NULL,
    appointmentDateTime TEXT NOT NULL,
    patientName TEXT NOT NULL,
    patientPhone TEXT NOT NULL,
    patientEmail TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Booked',
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmationEmailSentAt TEXT
  )
`);

const appointmentColumns = db.prepare("PRAGMA table_info(appointments)").all();
if (!appointmentColumns.some((column) => column.name === "stripeSessionId")) {
  db.exec("ALTER TABLE appointments ADD COLUMN stripeSessionId TEXT");
}
if (!appointmentColumns.some((column) => column.name === "confirmationEmailSentAt")) {
  db.exec("ALTER TABLE appointments ADD COLUMN confirmationEmailSentAt TEXT");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = db;
