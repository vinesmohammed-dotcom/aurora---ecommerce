# 27 — Architectural Decision Records (ADRs) & Technology Trade-Offs

## 1. Decision Framework
Every technical choice in this project follows a rigorous 5-point architectural evaluation:
1. **Why we need it**
2. **What problem it solves**
3. **Why it is appropriate for this project**
4. **What simpler alternative exists**
5. **Why we are or are not choosing that alternative**

---

## 2. Architectural Decision Records (ADRs)

### ADR-01: React (Vite) as Frontend Framework
- **Why we need it**: A modern, reactive user interface for interactive catalog filtering, live cart drawers, and administrative dashboards.
- **Problem it solves**: Eliminates manual DOM manipulation, spaghetti event listeners, and full-page refreshes.
- **Why appropriate**: React is the most widely adopted frontend library in modern enterprise software, maximizing portfolio employability. Vite provides instantaneous ESM-based Hot Module Replacement (HMR).
- **Simpler alternative**: Plain Vanilla HTML/JavaScript or Multi-Page Application (MPA) rendered with EJS/Pug.
- **Why alternative rejected**: Server-rendered EJS templates cannot deliver seamless single-page checkout flows or rich interactive dashboards without writing brittle custom JavaScript. Next.js was evaluated but rejected to avoid server-side rendering (SSR) hydration complexity for a first portfolio project.

### ADR-02: Redux Toolkit for Global Client State
- **Why we need it**: Centralized state management for authenticated user status, cart item count badges, and global UI alerts.
- **Problem it solves**: Eliminates "prop drilling" (passing data through 5 intermediate component layers) and manages cross-cutting state predictably.
- **Why appropriate**: Redux Toolkit (RTK) eliminates legacy Redux boilerplate while integrating seamlessly with Redux DevTools.
- **Simpler alternative**: React Context API.
- **Why alternative rejected**: React Context triggers full re-renders of all consuming components whenever any value in the context object changes. RTK provides selector-level memoization (`useSelector`), optimizing rendering performance.

### ADR-03: Express.js & Node.js Runtime
- **Why we need it**: Asynchronous, non-blocking HTTP server environment for building our REST API.
- **Problem it solves**: High concurrency handling for I/O-heavy operations (database queries, network requests) on a single thread.
- **Why appropriate**: Enables full-stack JavaScript, sharing data structures, mental models, and validation rules across client and server.
- **Simpler alternative**: Python Flask / FastAPI or Ruby on Rails.
- **Why alternative rejected**: Introducing a second language increases cognitive load and context switching for a junior developer.

### ADR-04: Service Layer atop Express MVC
- **Why we need it**: Enforces a strict separation of concerns between HTTP routing/controllers and domain business rules.
- **Problem it solves**: Prevents "fat controllers" where database queries, discount math, payment calls, and HTTP responses are tangled in one massive file.
- **Why appropriate**: Mirrors enterprise architectural standards, making services easily unit-testable without mocking HTTP request/response objects.
- **Simpler alternative**: Pure two-layer Controller-Model structure.
- **Why alternative rejected**: Two-layer MVC degrades into unmaintainable spaghetti code as business rules (coupons, wallet, inventory checks) become complex.

### ADR-05: MongoDB with Mongoose ODM
- **Why we need it**: Document database providing flexible JSON-like storage for products, variants, and frozen order snapshots.
- **Problem it solves**: Relational SQL tables require complex migration scripts and normalized multi-table joins (`products`, `variants`, `attributes`, `images`) for varying catalog attributes.
- **Why appropriate**: Naturally supports embedding variants and preserving historical order snapshots as nested subdocuments without joins.
- **Simpler alternative**: SQLite or PostgreSQL.
- **Why alternative rejected**: Rigid relational schemas make managing dynamic product variants (e.g. clothing vs electronics) cumbersome for beginners without advanced EAV (Entity-Attribute-Value) patterns.

### ADR-06: Session-Based Authentication with `connect-mongo`
- **Why we need it**: Verifies user identity and protects administrative and customer endpoints.
- **Problem it solves**: Stateless JWTs stored in `localStorage` are vulnerable to XSS theft and cannot be revoked server-side on demand.
- **Why appropriate**: Grants the server 100% control to revoke sessions immediately (e.g. when an admin blocks a user or user logs out), while storing sessions in MongoDB avoids the operational cost of running a separate Redis instance.
- **Simpler alternative**: Stateless JWT in `localStorage`.
- **Why alternative rejected**: Security vulnerability (XSS exfiltration) and inability to invalidate compromised tokens immediately make JWTs inappropriate for serious commercial applications.

### ADR-07: Razorpay Payment Gateway
- **Why we need it**: Processes credit cards, debit cards, UPI, and net banking transactions securely.
- **Problem it solves**: Eliminates PCI-DSS compliance burdens; handles sensitive banking data externally.
- **Why appropriate**: Native Indian currency (INR) support, frictionless sandbox testing, and reliable HMAC webhook verification.
- **Simpler alternative**: Cash on Delivery (COD) only.
- **Why alternative rejected**: Pure COD does not showcase online payment integration skills to prospective employers.

### ADR-08: AWS S3 & AWS SES
- **Why we need it**: S3 stores media files and invoices; SES delivers transactional emails (OTPs, notifications).
- **Problem it solves**: Storing uploads on local EC2 storage exhausts disk space and fails when scaling horizontally; Gmail SMTP blocks server IPs and has strict daily sending caps.
- **Why appropriate**: Industry standard cloud primitives that demonstrate genuine AWS competence to interviewers.
- **Simpler alternative**: Local disk storage (`/public/uploads`) and Gmail SMTP.
- **Why alternative rejected**: Local disk storage breaks on server reboots or multi-instance deployments; Gmail SMTP is not production-viable.

### ADR-09: Single AWS EC2 Instance with Nginx & PM2
- **Why we need it**: Production hosting environment for frontend static assets and backend API daemon.
- **Problem it solves**: Heroku/Render free tiers sleep on inactivity, introduce severe cold starts, and hide real server administration.
- **Why appropriate**: Demonstrates real Linux systems administration, SSL termination (Let's Encrypt), reverse proxy routing, and process clustering.
- **Simpler alternative**: PaaS hosting (Vercel + Render).
- **Why alternative rejected**: PaaS hosting conceals fundamental infrastructure skills (Nginx, security groups, process daemons) that interviewers actively look for.

### ADR-10: Decoupling Express App (`app.js`) from Server Listener (`server.js`)
- **Why we need it**: Clean separation between application configuration (middlewares, routes, error handlers) and runtime network binding (port listener, database connection).
- **Problem it solves**: Calling `app.listen()` inside the same file that creates the Express app forces integration test runners (like Supertest) to bind to actual network ports, causing EADDRINUSE collisions during parallel test runs and preventing in-memory testing.
- **Why appropriate**: Standard industry practice for clean testability; allows importing `app` directly into Vitest/Supertest without booting live databases or HTTP servers.
- **Simpler alternative**: Single `server.js` containing both `app` creation and `app.listen()`.
- **Why alternative rejected**: Breaks automated integration testing and makes graceful shutdown management coupled to routing.
