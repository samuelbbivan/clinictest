const Stripe = require("stripe");

function getStripeClient() {
  const secretKey = process.env.STRIPE_API_KEY;
  if (!secretKey || !secretKey.startsWith("sk_test_")) {
    throw new Error("Set a Stripe test secret key in STRIPE_API_KEY to enable deposit checkout.");
  }
  return new Stripe(secretKey);
}

function getBaseUrl() {
  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    throw new Error("Set BASE_URL to the public base URL of this application.");
  }

  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("BASE_URL must be a valid absolute URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("BASE_URL must use HTTP or HTTPS.");
  }

  return url.origin.replace(/\/+$/, "");
}

function createDepositCheckoutSession(booking) {
  const stripe = getStripeClient();
  const baseUrl = getBaseUrl();

  return stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: booking.patientEmail,
    client_reference_id: String(booking.id),
    metadata: {
      appointmentId: String(booking.id),
    },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "aed",
        unit_amount: 10000,
        product_data: {
          name: "Refundable consultation deposit",
          description: "AED 100 refundable deposit for your clinic consultation.",
        },
      },
    }],
    success_url: `${baseUrl}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/booking?payment=cancelled`,
  }, {
    idempotencyKey: `appointment-deposit-${booking.id}`,
  });
}

function retrieveCheckoutSession(sessionId) {
  return getStripeClient().checkout.sessions.retrieve(sessionId);
}

module.exports = {
  createDepositCheckoutSession,
  retrieveCheckoutSession,
};
