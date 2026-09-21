const session = require("express-session");
const MongoStore = require("connect-mongo");
const env = require("./env");

/**
 * Configure Express session with MongoDB persistence
 */
const configureSession = () => {
  const storeOptions = env.isTest
    ? new session.MemoryStore()
    : MongoStore.create({
        mongoUrl: env.MONGODB_URI,
        collectionName: "sessions",
        ttl: 7 * 24 * 60 * 60, // 7 days in seconds
        autoRemove: "native",
        touchAfter: 24 * 3600 // Lazy session update once per 24 hours unless data changes
      });

  return session({
    name: "sessionId", // Avoid default connect.sid to prevent tech stack fingerprinting
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: storeOptions,
    cookie: {
      httpOnly: true, // Prevents client-side scripts from reading the cookie
      secure: env.isProduction, // In production HTTPS is mandatory; false in local dev
      sameSite: "lax", // Protects against CSRF on cross-site requests
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
    }
  });
};

module.exports = configureSession;
