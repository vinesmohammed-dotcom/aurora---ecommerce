# Executive Report — Phase 0: Requirements, Architecture & Project Blueprint

## 1. Executive Summary
Phase 0 establishes the complete technical foundation, architectural blueprints, database models, payment state machines, and pedagogical explanations for the full-stack MERN e-commerce application. The project is designed as a **production-grade Modular Monolith** targeting an AWS cloud environment, optimized for code maintainability, concurrency safety, and senior-level portfolio review.

In accordance with Phase 0 constraints, **zero application feature code was written**. Instead, 29 comprehensive specifications were authored in `docs/` and `PROJECT_STATUS.md`.

---

## 2. Synthesis of Phase 0 Dimensions

### 2.1 Requirements Analyzed & Prioritized
- Categorized all requested features into **15 Core (Must Have)** MVP requirements, **9 Secondary (Should Have)** post-MVP requirements, and **5 Optional (Could Have)** enhancements using the MoSCoW framework.
- Core features include full email OTP registration, session-based authentication, product variant browsing, server-verified cart, atomic checkout, Razorpay payments, admin catalog CRUD, and order fulfillment.

### 2.2 Missing Requirements Identified & Integrated
- Added critical production requirements missing from basic tutorials: Server-side price recalculation, atomic inventory conditional updates (`$gte: quantity`), payment retry engine for failed transactions, webhook idempotency guards, historical immutable order snapshots, centralized operational error handling, and API rate limiting.

### 2.3 System Architecture Selected
- Selected a **Modular Monolith** architecture over microservices to eliminate distributed transaction failures, network serialization latency, and DevOps complexity.
- Clear separation across React Single Page Application, Nginx reverse proxy, Node.js/Express REST API on PM2, MongoDB Atlas replica set, AWS S3 for object storage, and AWS SES for transactional email.

### 2.4 Database & Schema Design
- Designed 15 distinct collections with exact typing, validation rules, references, and indexes.
- **Key Decision**: Adopted **Embedded Variants** in `Product` with unique SKU index, enabling atomic single-document inventory updates and eliminating expensive `$lookup` joins on product detail views.

### 2.5 API Architecture & Response Standards
- Defined versioned endpoints under `/api/v1` across 16 resource domains using semantic HTTP methods (`GET`, `POST`, `PATCH`, `DELETE`).
- Standardized all responses into unified JSON envelopes (`{ success, message, data, meta }`) with machine-readable error codes.

### 2.6 Authentication & Authorization Design
- Replaced vulnerable stateless JWTs in `localStorage` with **Session-Based Authentication** using `express-session` and `connect-mongo`.
- Employs `httpOnly`, `secure`, `sameSite: 'lax'` cookies, completely mitigating XSS token theft while providing instant server-side session revocation.

### 2.7 Payment Architecture
- Designed end-to-end Razorpay integration with HMAC-SHA256 constant-time signature verification.
- Integrated dual-channel confirmation: synchronous client return and asynchronous webhook safety net with idempotency checks to prevent double-fulfillment.

### 2.8 Security Threat Model
- Comprehensive Defense in Depth: Rate limiting on authentication and OTP endpoints, `express-mongo-sanitize` for NoSQL injection prevention, Zod input validation, strict CORS origin whitelisting, and S3 least-privilege IAM policies.

### 2.9 UI / Visual Design System
- Modern, minimalist, editorial aesthetic using Tailwind CSS tokens, generous whitespace, 8pt spatial rhythm, and responsive layouts. Defined complete states: loading skeletons, empty state illustrations, and error banners.

### 2.10 AWS Cloud Deployment Strategy
- Single Ubuntu EC2 instance running Nginx (SSL termination & reverse proxy) and Node.js on PM2 cluster mode.
- Port 5000 is blocked from the public internet; traffic enters strictly via HTTPS on port 443.

### 2.11 Testing Strategy
- Defined a testing pyramid using **Vitest** for domain unit tests (discount math, state machine transitions) and **Supertest** for API integration tests (concurrent checkout race conditions, auth session enforcement).

### 2.12 Key Architectural Decisions (ADRs)
- 9 formal ADRs documented, justifying choices like React+Vite over Next.js, Redux Toolkit for global client state, MongoDB over SQL, and session cookies over JWTs.

---

## 3. Risk Register & Mitigation Strategy

| Risk Factor | Probability | Impact | Mitigation Plan |
| :--- | :--- | :--- | :--- |
| **Inventory Overselling during Flash Sales** | Medium | Critical | Atomic conditional decrement `{ "variants.stock": { $gte: qty } }` at the database level. |
| **Razorpay Webhook Dropped / Delayed** | Medium | High | Dual verification: Synchronous verification on redirect plus asynchronous webhook processing with idempotency guards. |
| **AWS Free Tier Billing Surprises** | Low | Medium | AWS Budget alerts configured at $5 threshold; SES sandbox used during early development. |
| **State Bloat in Redux** | High | Medium | Strict state boundaries enforced: catalog data and forms kept in local state; Redux reserved exclusively for auth, cart badge, and global toasts. |

---

## 4. What the Developer Should Learn Before Phase 1
1. **HTTP Basics**: Request methods (`GET`, `POST`, `PATCH`, `DELETE`), headers, status codes (200, 201, 400, 401, 403, 404, 409, 500).
2. **Asynchronous JavaScript**: Promises, `async/await`, and why database/network calls cannot be synchronous.
3. **MongoDB Document Model**: How JSON-like BSON documents work, and how subdocuments and embedded arrays differ from relational SQL tables.
4. **The Express Middleware Pattern**: How `(req, res, next)` chains operate sequentially.
5. Review the complete beginner explanations in [26-learning-log.md](file:///c:/Users/vines/react%20first%20project/docs/26-learning-log.md).
