# 18 — Comprehensive Security Architecture & Threat Mitigation Plan

## 1. Security Philosophy: Defense in Depth
Security in our e-commerce platform relies on **Defense in Depth**—layering controls across transport, application, session, database, and operational boundaries.

---

## 2. Threat Modeling & Implementation Matrix

| Attack Vector / Vulnerability | Threat Description | Architectural Mitigation Strategy |
| :--- | :--- | :--- |
| **Credential Stuffing & Brute Force** | Automated bot scripts firing thousands of password guesses against `/api/v1/auth/login`. | **Tiered Rate Limiting (`express-rate-limit`)**: `authLimiter` limits authentication attempts to 10 requests per 15 minutes per IP. Sensitive OTP endpoints limited by `otpLimiter` (5 requests per 15 minutes). |
| **OTP Flooding & SMS/Email Bombing** | Attackers abusing OTP generation to spam victims and exhaust mail service quotas. | **Per-IP Rate Limits & TTL Invalidation**: `otpLimiter` throttles requests. Invalidation of prior active tokens on resend prevents token piling. 5-minute database TTL auto-purges expired tokens. |
| **Session Hijacking & XSS Token Theft** | Cross-Site Scripting (XSS) injecting JavaScript to steal auth tokens from browser storage. | **`httpOnly` + `Secure` + `SameSite` Cookies**: `httpOnly` prevents JavaScript from directly reading the cookie via `document.cookie`, stopping credential exfiltration. (Note: does not prevent scripts from making authenticated requests from the victim browser). `SameSite: 'lax'` reduces cross-site cookie sending, mitigating CSRF. `Secure: true` guarantees HTTPS transmission. |
| **Cross-Site Request Forgery (CSRF)** | Malicious site tricking authenticated browser into sending unauthorized commands. | **`SameSite: 'lax'` + Origin Checking**: Cookies are blocked from being transmitted on cross-origin subresource calls. CORS origin strictly validates allowed frontend origins. |
| **Timing Attacks on Verification Tokens** | Attackers measuring response times to deduce valid OTP digits character by character. | **Constant-Time String Comparison**: Verification uses `crypto.timingSafeEqual` between candidate hash buffer and stored hash buffer to guarantee uniform execution time. |
| **Account Enumeration** | Attackers probing password reset or registration endpoints to discover registered customer emails. | **Uniform Response Messages**: `POST /api/v1/auth/forgot-password` returns the exact same 200 OK message regardless of whether the user exists. |
| **Credential Exposure at Rest** | Database compromise or read replica leakage exposing customer credentials. | **`bcryptjs` (12 Salt Rounds) & `select: false`**: Bcrypt is an adaptive password-hashing algorithm with configurable computational cost, making guessing attacks expensive. Mongoose schema marks `passwordHash` as `select: false` and strips it in `toJSON()` serialization. |
| **Plaintext / Rainbow Table Token Leakage** | Database compromise exposing active one-time verification passwords via rainbow tables. | **Keyed HMAC-SHA256 at Rest**: 6-digit OTPs have only 1M combinations. We store `HMAC(serverSecret, OTP + ":" + purpose + ":" + email)`, defeating offline rainbow table and dictionary attacks even if the database is dumped. |
| **Insecure Direct Object Reference (IDOR)**| Customer modifying URL parameter to view or edit another customer's profile. | **Scoped Session Identity**: Profile and password update endpoints extract identity strictly from `req.user._id`, ignoring any client-supplied ID parameters. |
| **NoSQL / Mongo Injection** | Attacker submitting `{ "$gt": "" }` in password field to bypass query checks. | **Zod Schema Validation**: Input validator enforces strict primitive types (e.g. `z.string().min(8)`), throwing 422 errors if objects or operators are passed. |
| **Sensitive Data in Logs** | Plaintext credentials appearing in access logs or debugging output. | **Log Scrubbing**: Morgan logger is configured to log request metadata only (method, URL, status code, response time), omitting request bodies. |

---

## 3. Rate Limiting Configuration Registry (`backend/src/middlewares/rateLimiter.middleware.js`)

```javascript
// Global API Limiter: 100 req / 15 min (prod), 1000 req / 15 min (dev)
const apiRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: isDev ? 1000 : 100 });

// Auth Limiter (Login, Registration): 10 req / 15 min
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: "Too many authentication attempts..." });

// OTP Limiter (Verification, Resend, Reset): 5 req / 15 min
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: "Too many OTP requests..." });
```

---

## 4. Environment & Secret Governance
- **Git Protection**: `.env` is permanently ignored via `.gitignore`. `.env.example` documents required environment keys with safe placeholders.
- **Session Secrets**: `SESSION_SECRET` requires a minimum 32-character high-entropy string in production.
- **Fail-Fast Configuration**: `backend/src/config/environment.js` validates all critical environment variables on startup, terminating immediately with an informative error if variables are missing.
