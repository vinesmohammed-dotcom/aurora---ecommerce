# 11 — Authentication & Session Management Architecture

## 1. Architectural Strategy: Session-Based Auth vs Stateless JWT
A frequent debate in modern web development is **Session-Based Authentication** vs **Stateless JWT (JSON Web Tokens)**. For our e-commerce platform, session-based authentication is the deliberate architectural choice:

```
+-------------------------------------------------------------------------------+
| SESSION-BASED AUTH (Chosen Strategy)                                          |
| - Server creates a session record in MongoDB (`connect-mongo`).               |
| - Sends an opaque, random session ID inside an `httpOnly`, `Secure` cookie.   |
| - On every request, browser automatically transmits the cookie.               |
| - Server looks up the session in MongoDB and verifies active status.          |
| - ADVANTAGE: 100% revocation control. If an admin blocks a malicious user,     |
|   or a user clicks "Logout from all devices", deleting the session record      |
|   instantly kicks them out. Completely immune to client-side XSS token theft! |
+-------------------------------------------------------------------------------+
                                      vs
+-------------------------------------------------------------------------------+
| STATELESS JWT IN LOCALSTORAGE (Rejected Anti-Pattern)                         |
| - Tokens stored in `localStorage` can be stolen by ANY injected JavaScript   |
|   (e.g. through a compromised NPM dependency or XSS vulnerability).           |
| - JWTs cannot be revoked until they expire. If a user is banned, their JWT    |
|   remains valid until the expiry timestamp!                                   |
+-------------------------------------------------------------------------------+
```

---

## 2. Cookie Security Attributes
The session cookie (`connect.sid`) is configured with strict security flags:
- `httpOnly: true`: Prevents client-side JavaScript (`document.cookie`) from reading the cookie, neutralizing XSS token exfiltration.
- `secure: process.env.NODE_ENV === 'production'`: In production, transmitted exclusively over encrypted HTTPS connections.
- `sameSite: 'lax'`: Protects against Cross-Site Request Forgery (CSRF) by preventing cross-origin subresource transmission while permitting safe top-level user navigations.
- `maxAge: 7 * 24 * 60 * 60 * 1000`: 7-day session lifetime with sliding expiration on user activity.

---

## 3. Implemented Authentication Endpoints (`/api/v1/auth`)

| Method | Endpoint | Purpose | Protection | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/register` | Validate credentials, create unverified user, send 6-digit OTP | Public | 10 req / 15 min |
| `POST` | `/verify-registration-otp`| Verify OTP, mark `isVerified: true`, create session & cookie | Public | 5 req / 15 min |
| `POST` | `/resend-registration-otp`| Invalidate old OTPs, generate & email fresh 6-digit OTP | Public | 5 req / 15 min |
| `POST` | `/login` | Authenticate email + password, create session & cookie | Public | 10 req / 15 min |
| `POST` | `/logout` | Destroy MongoDB session document & clear `connect.sid` cookie | Authenticated | Standard |
| `GET` | `/me` | Return authenticated user profile object (`req.user`) | Authenticated | Standard |
| `POST` | `/forgot-password` | Generate reset OTP (Constant generic response to prevent enumeration) | Public | 5 req / 15 min |
| `POST` | `/reset-password` | Verify reset OTP and update password with 12 bcrypt rounds | Public | 5 req / 15 min |
| `PUT` | `/change-password` | Validate current password and set new password | Authenticated | Standard |
| `POST` | `/request-email-change`| Dispatch verification OTP to the requested new email address | Authenticated | 5 req / 15 min |
| `POST` | `/verify-email-change` | Verify OTP and atomically update user email in database | Authenticated | 5 req / 15 min |

---

## 4. Authentication Workflows & Security Mechanics

### 4.1 Registration & Email OTP Flow
```mermaid
sequenceDiagram
    autonumber
    actor Client as Customer
    participant Route as Express Router
    participant Validate as Zod Validator
    participant Service as AuthService
    participant Model as UserModel
    participant OTP as OTPModel
    participant Email as EmailService
    participant Session as Connect-Mongo

    Client->>Route: POST /api/v1/auth/register { name, email, password, phone }
    Route->>Validate: Validate schema (name, email, strong password)
    Validate->>Service: registerUser(payload)
    Service->>Model: findOne({ email })
    alt Email already exists
        Service-->>Client: 409 Conflict ("Email is already registered")
    end
    Service->>Model: Hash password (bcrypt 12 rounds) & create user (isVerified: false)
    Service->>OTP: Invalidate prior OTPs & insert SHA-256 hashed OTP (TTL 5m)
    Service->>Email: sendOtpEmail({ email, otp, purpose: 'REGISTRATION' })
    Service-->>Client: 201 Created { message: "Registration initiated..." }

    Client->>Route: POST /api/v1/auth/verify-registration-otp { email, otp }
    Route->>Service: verifyRegistrationOtp({ email, otp })
    Service->>OTP: find active OTP & verify with crypto.timingSafeEqual
    Service->>Model: findByIdAndUpdate(userId, { isVerified: true })
    Service->>OTP: mark isUsed: true
    Service->>Session: req.session.userId = user._id; req.session.role = user.role
    Session-->>Client: 200 OK (Set-Cookie: connect.sid; httpOnly; Secure)
```

### 4.2 OTP Lifecycle & Storage Security
1. **Cryptographically Secure Generation**: Generated using `crypto.randomInt(100000, 1000000)`.
2. **SHA-256 Hashing at Rest**: OTP values are NEVER stored in plaintext. `crypto.createHash('sha256').update(plainOtp).digest('hex')` is stored in the `otps` collection.
3. **Database TTL Expiration**: MongoDB TTL index `{ expiresAt: 1 }, { expireAfterSeconds: 0 }` automatically purges expired records after 5 minutes.
4. **Attempt Limit Counter**: Each failed guess increments `attempts`. Upon reaching 5 attempts (`maxAttempts: 5`), the token is locked and invalidated (`isUsed: true`).
5. **Constant-Time Verification**: Uses `crypto.timingSafeEqual` between candidate buffer and stored hash buffer to defend against side-channel timing attacks.
6. **Single-Use Invalidation**: Immediately marked `isUsed: true` upon successful verification, preventing replay attacks.

### 4.3 Password Hashing Standards
- Stored in the `users` collection as `passwordHash`.
- Configured with `select: false` in Mongoose schema to prevent accidental serialization in `find()` queries.
- Hashed using `bcryptjs` with **12 salt rounds** (computationally secure cost factor).
- Custom `toJSON()` on the User schema explicitly strips `passwordHash` and `__v` before returning documents to the caller.

### 4.4 Account Enumeration Defense
- On `POST /api/v1/auth/forgot-password`, the endpoint returns the exact same 200 OK message regardless of whether the email exists in the database:
  `"If an account with that email exists, a password reset code has been sent."`
- Attackers cannot probe the endpoint to harvest registered email addresses.
