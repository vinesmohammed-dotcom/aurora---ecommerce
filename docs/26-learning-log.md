# What I need to understand before coding

Welcome to your learning companion. Building a full-stack application for the first time can feel overwhelming because of the sheer number of acronyms and technical terms. 

Every concept below is explained with a **simple real-world analogy first**, followed by the **practical technical explanation** of how it works in our project.

---

### 1. What is a frontend?
- **Real-World Analogy**: Think of a restaurant's dining room—the decor, the physical menu in your hands, the tables, the lighting, and the waiter who takes your order. It is everything the customer directly sees, touches, and interacts with.
- **Technical Explanation**: The frontend is the client-side code running inside the user's web browser. Built with **React, HTML, JavaScript, and Tailwind CSS**, it is responsible for rendering visual pages, capturing button clicks, validating form inputs, and presenting data fetched from the server.

---

### 2. What is a backend?
- **Real-World Analogy**: The restaurant's kitchen and pantry behind the swinging doors. Customers never walk into the kitchen, but that is where the recipes are executed, food safety rules are enforced, and meals are prepared.
- **Technical Explanation**: The backend is the server-side software running on our cloud machine (Node.js + Express). It handles data storage, security enforcement, business math (calculating discounts, deducting stock), and communication with third-party services like Razorpay and AWS.

---

### 3. What is an API?
- **Real-World Analogy**: The waiter in the restaurant. You (the customer) cannot walk into the kitchen and shout at the chef. You tell the waiter what you want; the waiter takes your request to the kitchen and brings back your prepared dish.
- **Technical Explanation**: **API stands for Application Programming Interface**. It is a standardized set of URLs and rules that allows the React frontend to communicate with the Node.js backend. For example, when React calls `GET /api/v1/products`, the API retrieves the items and hands them back as JSON data.

---

### 4. What is REST?
- **Real-World Analogy**: A universal restaurant etiquette. Instead of inventing strange hand signals, everyone understands that raising your hand requests the bill, looking at the menu means browsing, and sending a plate back means a return.
- **Technical Explanation**: **REST (Representational State Transfer)** is an architectural style for designing APIs. It uses standard HTTP verbs to represent actions on resources:
  - `GET /products` → Read / view products
  - `POST /products` → Create a new product
  - `PATCH /products/:id` → Update parts of an existing product
  - `DELETE /products/:id` → Delete a product

---

### 5. What is HTTP?
- **Real-World Analogy**: The postal mail service rules. It dictates that every letter must have a sender address, a recipient address, a stamp, and a sealed envelope containing the message.
- **Technical Explanation**: **HTTP (HyperText Transfer Protocol)** is the underlying networking protocol of the World Wide Web. It formats messages into **Requests** (sent by the browser with headers and body) and **Responses** (returned by the server with status codes like `200 OK` or `404 Not Found`).

---

### 6. What is a database?
- **Real-World Analogy**: The restaurant's heavy, fireproof filing cabinet in the manager's office where all customer records, recipes, employee schedules, and financial receipts are permanently locked away.
- **Technical Explanation**: An organized electronic storage system designed for storing, querying, and persisting data permanently. Without a database, all user accounts and orders would vanish the second the server restarts.

---

### 7. What is MongoDB?
- **Real-World Analogy**: A filing cabinet where every customer has their own flexible plastic folder. Inside, you can slide in sheets of paper with varying details without needing every customer's folder to look identical.
- **Technical Explanation**: **MongoDB is a NoSQL Document Database**. Instead of rigid tables with fixed columns (like SQL), MongoDB stores data in JSON-like documents called BSON. This makes storing nested arrays (like product variants or order item snapshots) simple and fast.

---

### 8. What is Mongoose?
- **Real-World Analogy**: The strict office manager who inspects every folder before it goes into the filing cabinet, ensuring nobody forgets to write their phone number or puts a letter in the number slot.
- **Technical Explanation**: **Mongoose is an Object Data Modeling (ODM) library** for Node.js. Because MongoDB is naturally schemaless, Mongoose lets us define strict schemas, field types, required validations, default values, and relationships in our code.

---

### 9. What is MVC?
- **Real-World Analogy**: An assembly-line division of labor in a workshop: one person manages raw materials (Model), one designs the finished display (View), and one supervisor coordinates the work between them (Controller).
- **Technical Explanation**: **MVC (Model-View-Controller)** is a software architecture pattern:
  - **Model**: Represents database schemas and data operations (`Product.js`).
  - **View**: The client interface displaying the data (our React SPA).
  - **Controller**: The coordinator that accepts HTTP requests, invokes services, and sends back responses (`product.controller.js`).

---

### 10. What is a controller?
- **Real-World Analogy**: The receptionist at a clinic. They greet you, check your appointment card, call the right doctor to examine you, and hand you your prescription on your way out. They don't perform the surgery themselves.
- **Technical Explanation**: A function in Express whose sole job is handling the HTTP layer: reading `req.body`, `req.query`, and `req.params`, passing them to the business service, and returning `res.json()`.

---

### 11. What is a service?
- **Real-World Analogy**: The actual surgeon or accountant. They do the deep, specialized work—performing calculations, checking rules, and making sure complex procedures are executed safely.
- **Technical Explanation**: A standalone module where business logic lives (`order.service.js`). Services check inventory, compute coupon discounts, interact with Razorpay, and coordinate database transactions, completely decoupled from HTTP request/response objects.

---

### 12. What is middleware?
- **Real-World Analogy**: Security guards and ticket checkers standing in the hallway of an arena. Before you reach your seat, they check your ticket, inspect your bag, and kick out anyone without a pass.
- **Technical Explanation**: Functions in Express that run **in the middle** of a request before it reaches the controller. Middleware handles cross-cutting tasks like verifying session cookies (`isAuthenticated`), checking admin roles (`authorizeRoles`), and sanitizing malicious inputs.

---

### 13. What is authentication?
- **Real-World Analogy**: Showing your passport at airport customs to prove **who you are**.
- **Technical Explanation**: The process of verifying a user's claimed identity by checking credentials (such as email + password or entering a 6-digit email OTP).

---

### 14. What is authorization?
- **Real-World Analogy**: The boarding pass that determines **where you are allowed to go** in the airport. A standard ticket lets you board the plane; only a VIP pass lets you enter the pilot's cockpit.
- **Technical Explanation**: The process of verifying whether an authenticated user has permission to perform an action. For example, a customer (`role: 'USER'`) is forbidden from accessing administrative endpoints (`role: 'ADMIN'`).

---

### 15. What is a session?
- **Real-World Analogy**: A wristband given to you at a water park. Instead of showing your receipt every time you ride a waterslide, the lifeguard glances at your wristband to know you are paid up.
- **Technical Explanation**: A server-side record of an active login. When you log in, the server creates a session document in MongoDB and gives the browser a random Session ID. The server can destroy this session at any time to instantly log the user out.

---

### 16. What is a cookie?
- **Real-World Analogy**: The physical wristband itself wrapped around your arm that stays with you everywhere you go in the park.
- **Technical Explanation**: A small piece of data stored by your browser. When configured with `httpOnly` and `Secure` flags, the browser automatically attaches it to every request to our server, but client-side JavaScript is forbidden from reading it, preventing token theft.

---

### 17. What is pagination?
- **Real-World Analogy**: A 500-page book divided into readable pages. If the author printed all 500 pages on a single mile-long scroll, you couldn't carry it or find anything.
- **Technical Explanation**: Splitting large database collections (e.g. 10,000 products) into manageable chunks (e.g. 12 items per page). The frontend asks for `?page=1&limit=12`, and the backend queries only those 12 documents, saving server memory and network bandwidth.

---

### 18. What is an index?
- **Real-World Analogy**: The alphabetical index at the back of a textbook. If you want to find "Mongoose", you look up the letter M in the index and jump directly to page 214 instead of reading every page from page 1 to 500.
- **Technical Explanation**: A specialized data structure (usually a B-Tree) maintained by MongoDB. Without an index, MongoDB must scan every document in a collection (Collection Scan). With an index on `{ email: 1 }`, lookups are instantaneous.

---

### 19. What is an aggregation?
- **Real-World Analogy**: A factory assembly line that takes raw oranges, washes them, peels them, crushes them into juice, filters out the pulp, and measures the total liters produced.
- **Technical Explanation**: A MongoDB pipeline (`Product.aggregate([...])`) that processes documents through a multi-stage transformation sequence (`$match`, `$group`, `$sort`, `$project`) to compute complex reports, such as monthly revenue or average order value.

---

### 20. What is a transaction?
- **Real-World Analogy**: Buying a house. You don't hand over the money on Monday and hope the seller signs the deed on Friday. Both events must happen at the exact same moment at the escrow table; if either step fails, the entire deal is cancelled as if nothing happened.
- **Technical Explanation**: **An ACID database transaction**. A boundary where multiple operations (e.g., deducting warehouse stock, deducting wallet balance, and saving an order) succeed together or fail together. If an error occurs midway, all changes are automatically rolled back.

---

### 21. What is a payment gateway?
- **Real-World Analogy**: A armored bank truck and courier service. When you pay a merchant, you don't hand them your bank login; the armored courier securely moves the funds between banks and hands the merchant a signed receipt.
- **Technical Explanation**: A third-party service (like **Razorpay**) that securely collects credit card, debit card, and UPI payments in compliance with strict PCI-DSS banking regulations, notifying our server via cryptographic signatures and webhooks.

---

### 22. What is AWS S3?
- **Real-World Analogy**: A commercial storage warehouse with infinite shelving space. You give them a box with a unique barcode, and they hand you a key to retrieve that exact box whenever you need it.
- **Technical Explanation**: **AWS Simple Storage Service (S3)**. A highly durable cloud object storage service used to store media files (product images, customer avatars, PDF tax invoices) offloading file hosting from our web server.

---

### 23. What is AWS SES?
- **Real-World Analogy**: An enterprise automated post office that specializes in delivering high-priority registered letters directly into mailboxes without getting flagged as junk mail.
- **Technical Explanation**: **AWS Simple Email Service (SES)**. A cloud email service designed for sending reliable, high-volume transactional emails (such as 6-digit OTP verification codes and order confirmation receipts).

---

### 24. What is Nginx?
- **Real-World Analogy**: The professional doorman and concierge at the entrance of a high-rise office building. He checks everyone's identity, greets guests, hands out brochures directly, and directs visitors to the correct elevator.
- **Technical Explanation**: A high-performance web server and **reverse proxy**. It sits on ports 80 and 443, handles SSL certificate encryption (HTTPS), serves static React files directly, and forwards API traffic (`/api/v1/*`) to our Node.js app on port 5000.

---

### 25. What is PM2?
- **Real-World Analogy**: A loyal mechanic sitting in the passenger seat of your delivery truck. If the truck engine stalls, he immediately turns the key and restarts it within half a second, keeping a logbook of every sputter.
- **Technical Explanation**: A **Production Process Manager** for Node.js. It keeps our backend running 24/7, automatically restarts the app if an unhandled crash occurs, and runs multiple instances across CPU cores (clustering) for high availability.

---

## Phase 1 Extension: Cloud Health Checks

### 26. Liveness Probe vs Readiness Probe
- **Real-World Analogy**: Checking if a restaurant cook is breathing and conscious (Liveness) versus checking if the cook has ingredients in the kitchen and an oven turned on to prepare dishes (Readiness).
- **Technical Explanation**: Cloud load balancers (AWS ALB, Kubernetes) evaluate two distinct lifecycle states:
  - **Liveness (`GET /api/v1/health`)**: Verifies the Node.js event loop is spinning and HTTP listener is accepting connections. If it fails, the process is restarted.
  - **Readiness (`GET /api/v1/health/ready`)**: Verifies backing dependencies (MongoDB) are reachable. If it fails (HTTP 503), the load balancer temporarily diverts traffic away from this instance until the database reconnects, without restarting the process.
- **Where it appears**: `backend/src/modules/health/health.controller.js`.
- **Interview Question**: *"Why should you never mix database connection checks into a container liveness probe?"*
- **Interview Answer**: *"If MongoDB suffers a brief network hiccup, every container instance whose liveness probe checks MongoDB will simultaneously fail and restart. This triggers a cascading restart loop (thundering herd) across your cluster, crashing your entire server infrastructure while the database is attempting to recover."*

---

## Phase 2: Authentication & User Management Concepts

### 27. Authentication vs Authorization
- **Real-World Analogy**: Presenting your passport at airport customs proves who you are (Authentication). Your boarding pass proves whether you are permitted to board Flight 302 to London or enter the first-class lounge (Authorization).
- **Technical Explanation**: Authentication verifies identity using credentials (email, password, OTP, session cookie). Authorization determines permissions (e.g. `USER` vs `ADMIN`) and data access rights (e.g. can this customer view order `#102`?).
- **Where it appears**: `backend/src/middlewares/auth.middleware.js` via `requireAuth` and `requireRole`.
- **Interview Question**: *"What HTTP status code should be returned if a user is not logged in versus when a logged-in user tries to access an admin route?"*
- **Interview Answer**: *"Return HTTP 401 Unauthorized when authentication is missing or invalid (the server does not know who the client is). Return HTTP 403 Forbidden when authentication succeeded but the user lacks sufficient roles or permissions."*

---

### 28. Stateful Sessions vs Stateless JWTs
- **Real-World Analogy**: An electronic keycard registered in a hotel front-desk computer (Stateful Session) versus an embossed plastic VIP badge stamped with an expiration date (Stateless JWT). If you get banned from the hotel, the front desk deactivates your keycard immediately in the database. The embossed badge cannot be cancelled until its expiration date passes unless a complex blacklist is built.
- **Technical Explanation**: Stateful sessions store user login records on the server (MongoDB via `connect-mongo`) and transmit an opaque random cookie (`connect.sid`). Stateless JWTs pack user identity into a base64 string stored client-side. Stateful sessions provide immediate server-side revocation control (e.g. admin bans user or user logs out) and zero exposure to XSS token theft.
- **Where it appears**: `backend/src/config/session.js`.
- **Interview Question**: *"Why is storing stateless JWTs in browser `localStorage` considered a major security anti-pattern in commercial e-commerce?"*
- **Interview Answer**: *"Any third-party script, compromised CDN library, or XSS flaw can read `localStorage` via `window.localStorage` and exfiltrate tokens to an attacker's server. Because the token is stateless, the server cannot revoke it until expiration. Storing session IDs in `httpOnly` cookies makes them completely invisible to client JavaScript."*

---

### 29. Session Hijacking & Cookie Protections (`httpOnly`, `secure`, `sameSite`)
- **Real-World Analogy**: A lockbox with three physical defenses: made of lead so X-rays cannot inspect it (`httpOnly`), transportable only via armored guard trucks (`secure`), and refused at the door if delivered by an unknown messenger (`sameSite`).
- **Technical Explanation**:
  - `httpOnly: true`: Prevents `document.cookie` access from JavaScript, neutralizing XSS exfiltration.
  - `secure: true`: Ensures the cookie is only transmitted over TLS-encrypted HTTPS connections.
  - `sameSite: 'lax'`: Prevents the browser from sending the cookie during cross-site sub-resource requests, preventing Cross-Site Request Forgery (CSRF).
- **Where it appears**: `backend/src/config/session.js`.
- **Interview Question**: *"Can an attacker steal a session cookie using an XSS script if `httpOnly` is enabled?"*
- **Interview Answer**: *"No. With `httpOnly`, browser JavaScript cannot read the cookie string. An attacker may attempt to trigger authenticated requests while the user is active (XSS request forging), but they cannot exfiltrate the raw cookie to impersonate the user from an external machine."*

---

### 30. Password Hashing & Salt Rounds (Bcrypt)
- **Real-World Analogy**: Passing a raw document through a paper shredder that also mixes in a handful of random confetti (`salt`) and re-shreds the mixture 4,096 times (`2^12` rounds). You can never reassemble the document, but you can confirm if a new document shreds to the exact same pile.
- **Technical Explanation**: Plaintext passwords must never be stored. Bcrypt applies a computationally intensive key derivation function with an automatically generated random salt. Cost factor 12 (`2^12 = 4,096` iterations) takes ~250ms per check on modern CPUs, making rainbow tables useless and GPU-accelerated brute-force attacks economically infeasible.
- **Where it appears**: `backend/src/modules/users/user.model.js`.
- **Interview Question**: *"Why is SHA-256 considered bad for password storage while bcrypt is recommended?"*
- **Interview Answer**: *"SHA-256 is designed to be fast and compute millions of hashes per second for file integrity checks. An attacker with a consumer GPU can test billions of SHA-256 guesses per second. Bcrypt is deliberately slow and memory-intensive, with configurable work factors to defeat hardware-accelerated attacks."*

---

### 31. Password Hash Visibility (`select: false`)
- **Real-World Analogy**: Marking a filing cabinet folder so that pulling "Customer Details" automatically hides the locked compartment containing their bank safe combination unless you explicitly ask for the combination key.
- **Technical Explanation**: In Mongoose schemas, setting `select: false` on `passwordHash` ensures that standard queries (`User.findOne`, `User.find`) exclude the field by default. If the password hash is needed for authentication, the service must explicitly invoke `.select('+passwordHash')`.
- **Where it appears**: `backend/src/modules/users/user.model.js`.
- **Interview Question**: *"What security disaster does `select: false` prevent in controller responses?"*
- **Interview Answer**: *"It prevents accidental password hash leakage. If a developer runs `const user = await User.findById(id)` and returns `res.json(user)`, the password hash is excluded from the query projection, preventing unintentional credential exposure."*

---

### 32. OTP Generation, Hashing & Storage
- **Real-World Analogy**: A 5-minute single-entry wristband with a barcode. The entry guard does not keep a photo of the wristband; he only stores the scanned hash of the barcode.
- **Technical Explanation**: One-Time Passwords (OTPs) are generated using cryptographically secure pseudorandom numbers (`crypto.randomInt(100000, 1000000)`). Before saving to MongoDB, the code computes a one-way SHA-256 hash. The plaintext OTP is emailed to the user and never persisted in database storage.
- **Where it appears**: `backend/src/modules/auth/otp.model.js` and `backend/src/modules/auth/auth.service.js`.
- **Interview Question**: *"Why should you hash OTPs in the database if they expire in 5 minutes anyway?"*
- **Interview Answer**: *"If a read-only database replica is compromised or a developer inspects raw database query logs, plaintext OTPs allow an attacker to hijack active registration or password reset flows in real time. Storing SHA-256 hashes ensures even a full database dump yields zero usable OTPs."*

---

### 33. MongoDB TTL Indexes (Time-To-Live)
- **Real-World Analogy**: Self-destructing paper that dissolves into thin air exactly 5 minutes after being printed.
- **Technical Explanation**: A MongoDB specialized index on date fields (`{ expiresAt: 1 }, { expireAfterSeconds: 0 }`). A background thread running inside MongoDB evaluates the index every 60 seconds and automatically deletes expired documents without requiring external cron jobs or background cleanup scripts.
- **Where it appears**: `backend/src/modules/auth/otp.model.js`.
- **Interview Question**: *"How does a MongoDB TTL index work and when does deletion actually occur?"*
- **Interview Answer**: *"MongoDB runs an internal background thread every 60 seconds that reads the TTL index and purges documents where `expiresAt + expireAfterSeconds <= current_time`. Because the worker runs once a minute, deletion may lag expiration by up to 60 seconds, so application queries should still include an explicit `$gt: new Date()` check for exact enforcement."*

---

### 34. Timing Attacks & Constant-Time Comparison
- **Real-World Analogy**: A combination lock that makes an audible click on the first dial if the digit is correct, but stays silent if incorrect. A burglar can listen for the click to determine the first digit in 10 tries rather than testing 10,000 combinations.
- **Technical Explanation**: Standard string comparisons (`str1 === str2`) return `false` on the first non-matching character (early exit). Attackers measuring response latency down to microseconds can deduce valid characters one by one. `crypto.timingSafeEqual` compares buffers in constant time regardless of where mismatches occur.
- **Where it appears**: `backend/src/modules/auth/otp.model.js` (`verifyOtpHash`).
- **Interview Question**: *"What is a timing attack and how do you protect verification codes against it?"*
- **Interview Answer**: *"A timing attack exploits execution time variances in string equality checks to reveal secret values byte-by-byte. We protect against it by comparing cryptographic hashes using constant-time comparison functions like Node's native `crypto.timingSafeEqual`."*

---

### 35. Tiered Rate Limiting
- **Real-World Analogy**: A public park water fountain that lets anyone take sips continuously, but limits you to filling 5 large jugs per hour so the community tank doesn't run dry.
- **Technical Explanation**: Express middleware (`express-rate-limit`) tracking client IP request counts in memory across sliding time windows. Different endpoint tiers require different limits: general browsing allows 1,000 requests per 15 minutes, while `/login` is restricted to 10 requests, and sensitive `/forgot-password` or OTP dispatches are restricted to 5 requests per 15 minutes.
- **Where it appears**: `backend/src/middlewares/rateLimiter.middleware.js`.
- **Interview Question**: *"Why is IP-based rate limiting alone insufficient in distributed attacks?"*
- **Interview Answer**: *"Attackers can use botnets or distributed proxy networks with thousands of distinct residential IP addresses to bypass per-IP limits. Rate limiting should be combined with account-level lockouts, CAPTCHAs, and anomaly detection."*

---

### 36. Account Enumeration Prevention
- **Real-World Analogy**: Calling a receptionist and asking if 'John Smith' works there. Instead of saying 'Yes, he does' or 'No, no John Smith here', the receptionist replies uniformly: 'If John Smith works here, we will deliver your message to his desk.'
- **Technical Explanation**: If an API returns `404 User Not Found` on password reset requests for unregistered emails and `200 OK` for registered emails, attackers can script requests across leaked email lists to identify platform customers. Returning identical 200 OK success envelopes for all inputs neutralizes enumeration.
- **Where it appears**: `backend/src/modules/auth/auth.service.js` (`requestPasswordReset`).
- **Interview Question**: *"How do you design a password reset endpoint to prevent email enumeration?"*
- **Interview Answer**: *"Always return an identical HTTP 200 response with a neutral message like 'If an account exists with this email, a reset code has been sent', regardless of whether the email is present in the database. Ensure response timing is normalized so database lookup differences do not leak presence."*

---

### 37. Layered Architecture Separation of Concerns
- **Real-World Analogy**: An international restaurant kitchen: The Hostess (Route) directs guests; the Waiter (Middleware/Controller) takes orders and returns plated food; the Executive Chef (Service) executes the recipe and calculations; the Pantry Manager (Model) retrieves ingredients from the walk-in cooler (Database).
- **Technical Explanation**:
  - `Routes`: Map HTTP paths and verbs to handler functions.
  - `Middlewares`: Validate schemas, authenticate sessions, enforce rate limits.
  - `Controllers`: Extract `req.body`/`req.params`, invoke domain services, send formatted `ApiResponse`.
  - `Services`: Contain 100% of domain business logic and orchestration.
  - `Models`: Define schema validations, indexes, and persistence methods.
- **Where it appears**: `backend/src/modules/auth/` and `backend/src/modules/users/`.
- **Interview Question**: *"Why shouldn't business logic live inside Express controllers?"*
- **Interview Answer**: *"Coupling business logic to controllers ties rules to HTTP `req` and `res` objects. This makes unit testing difficult (requires heavy mocking of Express objects), prevents code reuse across CLI scripts or message workers, and results in unmaintainable 'fat controllers'."*

---

### 38. The Repository Rule (Where Useful vs Direct Mongoose)
- **Real-World Analogy**: Hiring a full-time translator who only repeats every English sentence in English. If two people already speak the same language, adding an unnecessary middleman just slows down the conversation.
- **Technical Explanation**: The Repository pattern abstracts persistence queries. However, Mongoose `Model` is already an Active Record / Repository implementation. Writing thin wrappers that merely forward `findById` or `create` without additional query logic introduces boilerplate with zero benefit. Repositories are introduced only when query complexity, multi-collection aggregation pipelines, or data-source swapping warrants it.
- **Where it appears**: `backend/src/modules/auth/auth.service.js`.
- **Interview Question**: *"When should you introduce a Repository layer in a Node.js Mongoose application?"*
- **Interview Answer**: *"Introduce a repository when query logic is complex, repeated across multiple services, involves intricate aggregation pipelines, or when you need an abstraction layer to mock persistence in unit tests without depending on Mongoose internals. Avoid creating trivial pass-through repositories for simple CRUD queries."*

---

### 39. Input Validation with Zod
- **Real-World Analogy**: The automated sizing and metal detector gate at airport security. If your luggage is overweight or contains prohibited items, you are stopped at the gate before you ever board the plane.
- **Technical Explanation**: Zod provides schema declaration and type validation at runtime. If request payloads fail schema rules (e.g. invalid email format, short password), execution halts immediately in middleware, returning HTTP 422 with detailed field-level errors without touching controllers, services, or databases.
- **Where it appears**: `backend/src/middlewares/validate.middleware.js` and `*.validator.js`.
- **Interview Question**: *"Why validate with Zod at the middleware layer if Mongoose already validates schemas?"*
- **Interview Answer**: *"Mongoose validates at the database boundary, which is the last line of defense. Validating at the HTTP entry boundary with Zod rejects malformed payloads immediately, avoids running unnecessary database queries, sanitizes types, and returns consistent, friendly API validation envelopes."*

---

### 40. Request-Scoped Data vs Session Data
- **Real-World Analogy**: Wearing a name tag during a 2-hour conference workshop (Request-Scoped) versus having your name permanently recorded in the hotel guest registry for your 7-day stay (Session Data).
- **Technical Explanation**:
  - `req.user`: Request-scoped. Created on each HTTP request by `requireAuth` middleware, lives for milliseconds during the request lifecycle, and is garbage collected when the response finishes.
  - `req.session`: Session-scoped. Persisted in MongoDB, lives across days, and stores only identity pointers (`userId`, `role`).
- **Where it appears**: `backend/src/middlewares/auth.middleware.js`.
- **Interview Question**: *"Why shouldn't you store the entire user document inside `req.session`?"*
- **Interview Answer**: *"Storing full user documents in the session store creates stale data bugs when user profile fields change, and bloats the MongoDB session storage and network transfer size on every request. Only store minimal identity pointers (`userId`, `role`) in the session, and populate fresh user data on demand into `req.user`."*

---

### 41. Single-Use Tokens & Replay Prevention
- **Real-World Analogy**: A movie ticket with a barcode that is torn in half by the usher upon entry. Even if you pick the torn ticket off the floor, you cannot use it to enter a second theater.
- **Technical Explanation**: When an OTP is verified, its database record is immediately updated with `isUsed: true`. Any subsequent verification attempts using the same code are rejected, defeating replay attacks.
- **Where it appears**: `backend/src/modules/auth/otp.model.js` and `auth.service.js`.
- **Interview Question**: *"How do you prevent token replay attacks during OTP verification?"*
- **Interview Answer**: *"Mark the token as used (`isUsed: true`) or delete it immediately within the same database update operation upon successful verification. Check `isUsed === false` in the query filter so concurrent or repeated attempts are rejected."*

---

### 42. Supertest In-Memory Integration Testing
- **Real-World Analogy**: A flight simulator where pilots test full cockpit controls and emergency procedures without burning jet fuel or risking a real airplane.
- **Technical Explanation**: Supertest accepts the Express `app` instance and dispatches HTTP requests via Node's internal stream duplex pipes (`http.Server` in-memory simulation). It tests the complete middleware stack, routing, validations, and database interactions without binding to actual operating system network ports, eliminating port collisions during parallel test runs.
- **Where it appears**: `backend/tests/auth.test.js`.
- **Interview Question**: *"What is the advantage of using Supertest over making Axios requests against a running `localhost:5000` server during tests?"*
- **Interview Answer**: *"Testing against a running port requires starting and stopping background server processes, risks port conflicts in CI/CD environments, and is slower due to OS socket allocation. Supertest operates in-process via Node streams, providing fast, deterministic, and isolated HTTP assertions."*
