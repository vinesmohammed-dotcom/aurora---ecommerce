# 11 — Authentication & Session Management Architecture

## 1. Architectural Strategy: Session-Based Auth vs Stateless JWT
A frequent debate in web development is **Session-Based Authentication** vs **JWT (JSON Web Tokens)**.

```
+-------------------------------------------------------------------------------+
| SESSION-BASED AUTH (Chosen Strategy)                                          |
| - Server creates a session record in MongoDB (`connect-mongo`).               |
| - Sends an opaque, random session ID inside an `httpOnly`, `Secure` cookie.   |
| - On every request, browser automatically transmits the cookie.               |
| - Server looks up the session in the database.                                |
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
The session cookie (`connect.sid`) is configured with the highest industry protection flags:
- `httpOnly: true`: Prevents client-side JavaScript (`document.cookie`) from reading the cookie, blocking XSS token exfiltration.
- `secure: true`: In production, cookie is only transmitted over encrypted HTTPS connections.
- `sameSite: 'lax'`: Protects against Cross-Site Request Forgery (CSRF) by preventing the browser from sending the cookie on cross-site sub-resource requests (images, iframes) while allowing top-level navigation.
- `maxAge: 7 * 24 * 60 * 60 * 1000`: 7-day session lifetime with sliding expiration on activity.

---

## 3. Authentication Workflows

### 3.1 Registration & Email OTP Flow
```mermaid
sequenceDiagram
    autonumber
    actor User as New Customer
    participant React as React Frontend
    participant Server as Express Auth API
    participant SES as AWS SES / Email
    participant DB as MongoDB

    User->>React: Fill Registration Form (Name, Email, Password)
    React->>Server: POST /api/v1/auth/register
    Note over Server: 1. Validate inputs with Zod<br/>2. Check if email already exists<br/>3. Hash password with bcryptjs (12 salt rounds)<br/>4. Save User with isVerified: false
    Server->>DB: Insert User (isVerified: false)
    Note over Server: Generate cryptographically random 6-digit OTP<br/>Hash OTP and save in OTP collection (TTL: 5m)
    Server->>DB: Insert OTP { email, otpHash, purpose: "VERIFY_EMAIL" }
    Server->>SES: Send verification email containing 6-digit OTP
    Server-->>React: 201 Created { message: "OTP sent to email", email }
    React->>User: Display OTP Verification Screen
    
    User->>React: Enters 6-digit OTP
    React->>Server: POST /api/v1/auth/verify-otp { email, otp }
    Note over Server: Verify OTP against DB hash & check 5-minute expiry
    Server->>DB: Update User { isVerified: true }
    Server->>DB: Delete OTP record
    Note over Server: Create authenticated session (req.session.userId = user._id)
    Server-->>React: 200 OK (Set-Cookie: connect.sid; httpOnly)
    React->>User: Redirect to Storefront / Welcome Page
```

### 3.2 Login & Session Creation Flow
1. User posts `{ email, password }` to `/api/v1/auth/login`.
2. Server queries `User.findOne({ email })`.
3. Verifies `user.isBlocked === false` and `user.isVerified === true`.
4. Compares plain password with hashed password using `bcrypt.compare()`.
5. Establishes session:
   ```javascript
   req.session.userId = user._id;
   req.session.role = user.role;
   ```
6. Returns `200 OK` with user profile object and sets `connect.sid` cookie.

### 3.3 Logout Flow
1. User clicks "Logout".
2. React dispatches `POST /api/v1/auth/logout`.
3. Server destroys session:
   ```javascript
   req.session.destroy((err) => {
     res.clearCookie("connect.sid");
     res.status(200).json({ success: true, message: "Logged out successfully" });
   });
   ```
4. Session document is removed from MongoDB `sessions` collection.

### 3.4 Forgot & Reset Password Flow
1. User requests password reset for `email`.
2. Server verifies email exists, generates 6-digit OTP with `purpose: 'RESET_PASSWORD'`, and emails it via AWS SES.
3. User enters OTP along with `newPassword`.
4. Server verifies OTP, hashes new password with bcrypt, updates user document, and invalidates all existing sessions for that user.
