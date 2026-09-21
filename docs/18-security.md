# 18 — Comprehensive Security Architecture & Threat Mitigation Plan

## 1. Security Philosophy: Defense in Depth
Security in a commercial e-commerce system cannot rely on a single defensive layer. We employ **Defense in Depth**—layering controls across network, transport, application, session, database, and cloud infrastructure.

---

## 2. Threat Modeling & Mitigation Matrix

| Attack Vector / Vulnerability | Threat Description | Architectural Mitigation Strategy |
| :--- | :--- | :--- |
| **Client-Side Price Manipulation** | Malicious user intercepts checkout HTTP call and modifies final payable amount from ₹5,000 to ₹1. | **Zero Client Trust**: Backend completely re-fetches product prices from MongoDB, recomputes discounts/coupons, and supplies the price directly to Razorpay's server API. |
| **Credential Stuffing & Brute Force** | Automated bot scripts firing thousands of password guesses against `/api/v1/auth/login`. | **Rate Limiting (`express-rate-limit`)**: Enforces max 5 login attempts per 15 minutes per IP. Progressive backoff and CAPTCHA support. |
| **OTP Flooding & SMS/Email Bombing** | Attackers abusing `/api/v1/auth/resend-otp` to rack up massive AWS SES bills and spam victims. | **Cooldown Enforcement**: Enforce a 60-second cooldown between OTP requests. Max 3 OTP generations per email per hour. Strict 5-minute TTL. |
| **Session Hijacking & XSS Token Theft** | Cross-Site Scripting (XSS) injecting scripts to steal auth tokens from browser storage. | **`httpOnly` + `Secure` Cookies**: Session cookies cannot be read by `document.cookie`. XSS cannot exfiltrate the session ID. Passwords hashed with bcrypt (12 salt rounds). |
| **Cross-Site Request Forgery (CSRF)** | Malicious site tricking a logged-in user's browser into executing unauthorized actions. | **`SameSite: 'lax'` + Custom Headers**: Cookies are blocked from being transmitted on cross-origin AJAX requests. Axios sends explicit `X-Requested-With` header. |
| **NoSQL / Mongo Injection** | Attacker submitting `{ "$gt": "" }` in login password field to bypass authentication. | **`express-mongo-sanitize` + Zod**: Sanitizes request inputs by stripping keys beginning with `$` or `.`. Zod guarantees password is a strict primitive string. |
| **Cross-Origin Resource Sharing (CORS)** | Unauthorized third-party web domains making API calls to our backend. | **Strict Origin Whitelist**: CORS middleware configured to accept requests ONLY from the explicit frontend production domain (`https://store.yourdomain.com`). |
| **Insecure Direct Object Reference (IDOR)**| Customer modifying URL from `/orders/101` to `/orders/102` to view someone else's order. | **`isOrderOwner` Middleware**: Server explicitly validates `order.user.equals(req.session.userId)` before returning any order or invoice data. |
| **Malicious File Uploads** | Attacker uploading an executable `.php` or `.sh` script disguised as a product image. | **Multer Memory Storage + Mime Check**: Server verifies magic byte MIME type (`image/jpeg`, `image/png`, `image/webp`). Files are assigned cryptographically random UUID names before upload to S3; never stored on EC2 disk. |
| **AWS S3 Bucket Leakage** | S3 bucket misconfigured with public write/delete permissions. | **IAM Least Privilege**: AWS IAM credentials granted only `s3:PutObject` and `s3:GetObject` on the specific bucket ARN. Bucket blocks public ACL writes. |
| **Payment Signature Forgery** | Attacker constructing fake Razorpay success callbacks to confirm unpaid orders. | **HMAC-SHA256 Constant-Time Verification**: Server calculates signature using secret key and validates with `crypto.timingSafeEqual`. Webhook signature strictly verified via `X-Razorpay-Signature`. |
| **Sensitive Data Logging** | Developer logging raw `req.body` containing plaintext passwords, credit cards, or OTPs. | **Log Sanitization**: Request loggers (Morgan/Winston) pass through a redactor middleware that strips `password`, `otp`, `cardNumber`, and `token` fields. |

---

## 3. Environment & Secret Governance
- **Git Protection**: `.env` is permanently added to `.gitignore`. A sanitized `.env.example` is committed with placeholder values.
- **Key Separation**: Razorpay Test Keys (`rzp_test_...`) and Production Keys (`rzp_live_...`) are isolated across development and production environments.
- **AWS Credentials**: Production EC2 instance uses AWS IAM Instance Roles whenever possible rather than static access keys hardcoded into configuration files.
