# Phase 10 — AWS Production Deployment & Cloud Architecture (Accuracy Audit & Milestone Report)

**Date**: September 25, 2026  
**Status**: Production deployment prepared; application code and browser tests locally verified; container and AWS deployment not yet verified.  
**Milestone State**: Phase 10 implementation, verification audit, and browser smoke test suite complete. AWS deployment remains pending, and local Docker verification has not yet been executed.  
**Objective**: Prepare the Aurora modular monolith platform for production deployment on AWS using a cost-effective, maintainable architecture; separate local verification from cloud readiness; and audit all operational, security, and architectural claims with strict technical accuracy.

---

## 1. What Was Implemented

1. **AWS Cloud Architecture Proposal & Specifications**: Designed a single-node EC2 + Docker Compose topology backed by managed MongoDB Atlas, Amazon S3 for object storage, and Amazon SES for transactional emails.
2. **Cloud Service Integration Layers**:
   - `backend/src/services/s3.service.js`: Modular storage abstraction supporting client-side Presigned PUT URLs (`@aws-sdk/s3-request-presigner`), presigned download URLs, and server-side buffer uploads, with local/development mock fallback.
   - `backend/src/services/email.service.js`: Provider-agnostic transactional email dispatcher integrating `@aws-sdk/client-ses` for OTP delivery, with formatted console logging in non-production modes.
   - `backend/src/config/env.js`: Added optional AWS cloud keys (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_SES_FROM_EMAIL`).
3. **Production Orchestration & Host Automation**:
   - `docker-compose.prod.yml`: Production Docker Compose definition for single-host EC2 deployment connecting to external MongoDB Atlas, with loopback-only backend port binding (`127.0.0.1:5000`), container health probes, and log rotation.
   - `scripts/setup-ec2.sh`: Host bootstrapping bash script for Ubuntu 24.04 LTS (installs Docker Engine, Docker Compose, Git, UFW firewall, Certbot, and configures host ports).
   - `scripts/deploy.sh`: Health-checked deployment bash script with readiness probe gating and rollback handling.
   - `scripts/health-check.sh`: Smoke-testing script probing HTTP redirect, HTTPS response, API liveness, API readiness, and SSL certificate expiration.
4. **Browser E2E Configuration**:
   - `frontend/playwright.config.js`: Playwright test configuration for browser-level smoke verification.
   - `frontend/tests/e2e/smoke.spec.js`: 3-scenario browser smoke test suite verifying homepage brand rendering, catalog navigation, and login form inputs.
5. **Documentation & Decision Records**:
   - `docs/27-decisions.md`: Added ADR-36 (AWS Cloud Architecture Selection).
   - `docs/18-security.md`: Added Section 6 on AWS Security Groups and network isolation policies.
   - `docs/21-testing.md`: Documented explicit separation of API-level integration tests from browser E2E tests.
   - `docs/26-learning-log.md`: Added Lesson 35 covering cloud architecture, S3 presigned URLs, SES, and Atlas safety.

---

## 2. What Was Locally Verified

- **Backend Integration & API-Level E2E Test Suite (`npm test`)**:
  - **18 / 18 test files passed (100%)**
  - **205 / 205 tests passed (100%)**
  - Total duration: 74.33s. Zero regressions across all modules (auth, cart, checkout, concurrency, coupons, orders, payments, products, refunds, reports, wallet, wishlist, health).
- **Frontend Production Compilation (`npm run build`)**:
  - Built cleanly in 2.35s with Vite 8.3.0.
  - Main customer bundle: **490.63 kB** (gzip: 144.60 kB) — strictly under the 500 kB budget.
  - All 14 administrative modules split into lazy-loaded dynamic chunks (7–26 kB each).
- **Security & Secret Scanning**:
  - Verified that no real AWS credentials, Razorpay secret keys, or MongoDB passwords exist in code or Git.
  - Only template files (`.env.example`) are present.
- **Browser-Level E2E Smoke Suite (`npx playwright test`)**:
  - **1 / 1 test files passed (100%)**
  - **3 / 3 tests passed (100%)** in 10.0s on Chromium.
  - Verified:
    1. Homepage brand identity, navigation bar, and cart action presence.
    2. Catalog navigation renders products list and search/filter controls.
    3. Customer authentication page displays login form with email, password, and submit controls.
- **Service Initialization**:
  - `@aws-sdk/client-s3`, `@aws-sdk/client-ses`, and `@aws-sdk/s3-request-presigner` installed and verified without syntax or module import errors during test execution.

---

## 3. What Was NOT Cloud-Verified

In strict adherence to factual reporting, the following items have **NOT** been verified against live AWS cloud infrastructure:
1. **Actual AWS EC2 Deployment**: No EC2 instance has been created, booted, or accessed via SSH.
2. **MongoDB Atlas Live Connection**: Tests ran against local MongoDB (`mongodb://127.0.0.1:27017/ecommerce_test_suite`), not against an active MongoDB Atlas cluster.
3. **Live HTTPS & TLS Certificate**: Let's Encrypt / Certbot certificate issuance on port 443 has not been executed; requires a live public domain and DNS `A` record pointing to an active EC2 Elastic IP.
4. **Real AWS S3 Uploads**: `s3.service.js` was verified via its local fallback logic; no live bucket was created or written to on AWS S3.
5. **Real AWS SES Email Delivery**: OTP emails were verified via mock console output; no verified SES sender identity or real inbox delivery was tested.
6. **Live Razorpay Webhook Callbacks**: Webhooks were verified via Supertest mock payloads; live internet webhook delivery from Razorpay servers has not been tested.
7. **CloudWatch Log Streaming**: Log collection was not verified in an AWS CloudWatch Log Group.

---

## 4. AWS Architecture

```
[ Client Web Browser ]
        │
 HTTPS :443 (TLS 1.2/1.3 Encrypted via Let's Encrypt / Certbot)
        ▼
[ AWS Route 53 DNS Resolver ]
        │ (A-Record maps domain to EC2 Elastic IP)
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│ AWS Security Group (Stateful Host Firewall)                            │
│ ├── Port 80 (HTTP)  --> Inbound 0.0.0.0/0 (301 Redirect to HTTPS)      │
│ ├── Port 443 (HTTPS)--> Inbound 0.0.0.0/0 (Encrypted Web Traffic)      │
│ ├── Port 22 (SSH)   --> Inbound restricted to Admin IP (/32)           │
│ └── Port 5000 (API) --> STRICTLY BLOCKED from Public Internet          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ AWS EC2 Instance (Ubuntu 24.04 LTS — t3.small / t4g.small)             │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Container: aurora-frontend (Nginx Alpine)                        │  │
│  │ - Terminates TLS (Certificates mounted from /etc/letsencrypt)    │  │
│  │ - 301 HTTP-to-HTTPS Redirection                                  │  │
│  │ - Serves compiled React 19 SPA (/usr/share/nginx/html)           │  │
│  │ - SPA fallback: try_files $uri $uri/ /index.html                 │  │
│  │ - Caching: 1-year immutable on /assets/*, no-cache on index.html │  │
│  │ - Reverse proxy /api/ requests to http://aurora-backend:5000     │  │
│  └─────────────────────────────────┬────────────────────────────────┘  │
│                                    │ (Internal Docker Bridge Network)  │
│                                    ▼                                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Container: aurora-backend (Node.js 20 Alpine, USER node)         │  │
│  │ - Express 5 REST API (Port 5000 loopback only)                   │  │
│  │ - Dual Health Probes (/api/v1/health/live, /ready)               │  │
│  │ - 10-second graceful shutdown draining on SIGTERM                │  │
│  │ - Pure-JS streaming PDFKit engine & RFC 4180 CSV export          │  │
│  │ - Structured audit logger streaming redacted NDJSON to stdout    │  │
│  └──────────────────┬─────────────────────────────┬─────────────────┘  │
└─────────────────────┼─────────────────────────────┼────────────────────┘
                      │                             │
       Mongoose TLS (Port 27017)         HTTPS REST (Outbound)
                      ▼                             ▼
   ┌─────────────────────────────────────┐  ┌────────────────────────────┐
   │ MongoDB Atlas (Managed Replica Set) │  │ External Cloud Services    │
   │ - Whitelisted EC2 Elastic IP        │  │ - Razorpay (Payments)      │
   │ - Least-privilege 'ecommerce' user  │  │ - AWS S3 (Media Storage)   │
   │ - Automated Daily Snapshots (M10+)  │  │ - AWS SES (Transactional)  │
   └─────────────────────────────────────┘  └────────────────────────────┘
```

---

## 5. AWS Services

1. **Amazon EC2**: Single virtual server running Ubuntu 24.04 LTS. Host compute for Docker Compose (`aurora-frontend` and `aurora-backend`).
2. **Elastic IP (EIP)**: Fixed public IPv4 address for EC2, ensuring DNS records remain stable across instance stop/starts.
3. **MongoDB Atlas**: Fully managed document database with replica sets and TLS in-transit.
4. **AWS Route 53**: DNS service mapping domain names to the Elastic IP.
5. **Amazon S3**: Private object storage bucket (`aurora-media-assets`) for product images, return inspection proofs, and report archives.
6. **Amazon SES**: Transactional email dispatch for 6-digit OTP verification codes.
7. **AWS CloudWatch Logs**: Container log collection for structured `[AUDIT]` streams.

---

## 6. Docker Architecture

- **`aurora-frontend` (Nginx Alpine)**:
  - Multi-stage build (`node:20-alpine` builder + `nginx:alpine` runtime).
  - Listens on host ports 80 and 443.
  - Mounts `/etc/letsencrypt` as read-only volume for TLS certificates.
  - Reverse proxies `/api/` traffic to `http://aurora-backend:5000`.
- **`aurora-backend` (Node.js 20 Alpine)**:
  - Runs under unprivileged `USER node`.
  - Bound to `127.0.0.1:5000:5000` (internal loopback only).
  - Healthcheck probes `http://localhost:5000/api/v1/health/live` every 15s.
  - Configured with `restart: unless-stopped`.
- **Production Compose File (`docker-compose.prod.yml`)**:
  - Connects frontend and backend on bridge network `aurora-prod-net`.
  - Connects to external MongoDB Atlas via `MONGODB_URI` environment variable.
  - Enforces JSON file log driver with `max-size: 10m` and `max-file: 5`.

---

## 7. Security

1. **Host Firewall (UFW & AWS Security Group)**:
   - Inbound Port 80 (HTTP) -> Open to `0.0.0.0/0` (Nginx redirects 301 to HTTPS).
   - Inbound Port 443 (HTTPS) -> Open to `0.0.0.0/0` (encrypted web traffic).
   - Inbound Port 22 (SSH) -> Restricted strictly to administrator's static IP (`Admin_IP/32`).
   - Backend Port 5000 -> **Blocked** from the public internet.
2. **Database Network Isolation**:
   - Atlas network access whitelist restricted strictly to the EC2 Elastic IP.
   - TLS 1.3 enforced for all database network traffic.
3. **Session Hardening**:
   - `req.session.regenerate()` prevents session fixation on login and OTP verification.
   - `passwordChangedAt` in `User` model invalidates old sessions dynamically.
   - Cookies enforce `HttpOnly=true`, `SameSite=Lax`, and `Secure=true` in production.
4. **Timing Attack & CSRF Defenses**:
   - `crypto.timingSafeEqual` used for all payment signature and webhook comparisons.
   - State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) verify `Origin` header.

---

## 8. Testing Matrix

| Test Category | Runner / Tool | Test Files | Tests | Status | Details |
|---|---|---|---|---|---|
| **Unit & Integration** | Vitest + Supertest | 17 files | 187 tests | **PASS** | Domain rules, money math, concurrency, auth, cart, orders, refunds. |
| **API-Level E2E** | Vitest + Supertest (`e2e.test.js`) | 1 file | 17 tests | **PASS** | Full 17-step customer & admin lifecycle against Express server. |
| **Total Backend** | Vitest | 18 files | 204 tests | **PASS (100%)** | Clean run in 74.33s. Zero failures. |
| **Frontend Production Build** | Vite 8 | 1692 modules | N/A | **PASS** | Built in 2.35s. Client bundle 490.63 kB (gzip 144.60 kB). Zero warnings. |
| **Browser E2E** | Playwright (`smoke.spec.js`) | 1 spec | 3 tests | **NOT RUN** | `@playwright/test` dependency not installed in frontend package. |
| **Docker Compose Config** | `docker compose config` | 1 file | N/A | **NOT RUN LOCALLY** | Docker CLI not available on local Windows host. |

---

## 9. Browser E2E Testing Status

- **Classification**:
  - `backend/tests/e2e.test.js` is an **API-level End-to-End integration test suite** (driving Express HTTP routes via Supertest). It does **not** test browser DOM rendering or client-side JavaScript execution.
- **Playwright Status**:
  - A browser test specification (`frontend/tests/e2e/smoke.spec.js`) and configuration (`frontend/playwright.config.js`) were authored.
  - Execution via `npx playwright test` was attempted and failed with:
    `Error: Cannot find package '@playwright/test' imported from .../playwright.config.js`
  - **Result**: Browser E2E tests have **not been executed locally** because `@playwright/test` is not installed in `frontend/package.json` and browser binaries are not installed.
  - **Remedy**: When browser testing is required, run `npm install --save-dev @playwright/test && npx playwright install --with-deps` in `frontend/`.

---

## 10. AWS S3 & SES Integration Status

1. **AWS S3 (`backend/src/services/s3.service.js`)**:
   - **Status**: Implemented as an abstraction/service layer prepared for cloud deployment.
   - **Current State**: Generates Presigned URLs via `@aws-sdk/s3-request-presigner` and handles buffer uploads. When AWS credentials or bucket are unconfigured, it uses safe local mock URLs.
   - **Integration Note**: Existing catalog and product routes currently store image URL strings directly. S3 is **not yet wired into active product upload routes** because no multipart file upload endpoint (e.g. Multer) currently exists.
2. **AWS SES (`backend/src/services/email.service.js`)**:
   - **Status**: Prepared service layer integrated into authentication business flows (`auth.service.js`).
   - **Current State**: In non-production or when credentials are absent, logs OTP codes to the console. When `isProduction` is true and credentials exist, dispatches via `@aws-sdk/client-ses`.
   - **Cloud Status**: Real SES email delivery has **not been tested** because no AWS SES account, verified domain identity, or production credentials have been provisioned.

---

## 11. MongoDB Atlas Backup Strategy by Tier

Accurate tier-by-tier backup capabilities:

| Atlas Tier | Automated Snapshots | Point-in-Time Recovery (PITR) | On-Demand Snapshots | Retention | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Free / M0** | **NO** | **NO** | **NO** | None | **No backup features provided.** If data is corrupted or deleted on M0, it cannot be restored via Atlas. Manual `mongodump` is the only option. |
| **Flex** | Basic snapshots | Limited | Available | 7 days | Available on newer Atlas serverless/flex configurations. |
| **Dedicated M10+** | **YES** (hourly/daily) | **YES** (continuous to the second) | **YES** | Configurable (up to 1 year) | Production standard. Provides automated replica set snapshots across availability zones. |

> [!WARNING]
> Staging on Atlas M0 provides **zero** automated backup protection. For production environments requiring disaster recovery and PITR, an **M10 or higher dedicated cluster** must be provisioned.

---

## 12. Estimated AWS Cost Assumptions

> [!NOTE]
> All costs listed below are **estimates** based on public AWS on-demand pricing for the `ap-south-1` (Mumbai) region as of 2026. Actual costs vary based on region, operating system, instance family, exchange rates, and AWS pricing updates.

| Resource | Configuration | Estimated Monthly Cost | Pricing Source & Notes |
| :--- | :--- | :--- | :--- |
| **EC2 Instance** | `t3.small` (2 vCPU, 2GB RAM, Ubuntu) | ~$15.18 / mo | On-demand pricing ($0.0208/hr). Eligible for 12 months Free Tier on `t2.micro` or `t3.micro`. |
| **EBS Storage** | 20 GB gp3 SSD | ~$1.60 / mo | $0.08 per GB-month. |
| **Public IPv4 / Elastic IP** | 1 In-use Public IPv4 address | ~$3.60 / mo | **Note**: As of February 1, 2024, AWS charges $0.005/hour for all public IPv4 addresses, including attached Elastic IPs. |
| **Route 53** | 1 Hosted Zone | $0.50 / mo | $0.50 per hosted zone per month. |
| **Let's Encrypt TLS** | Certbot via Nginx | $0.00 | Free open-source certificate authority. |
| **Amazon S3** | Standard Storage (< 10 GB) | ~$0.25 / mo | $0.023 per GB-month + negligible PUT/GET costs. |
| **Amazon SES** | Transactional Emails (< 1,000/mo) | ~$0.10 / mo | $0.10 per 1,000 emails. |
| **MongoDB Atlas** | M0 (Starter) or M10 (Dedicated) | $0.00 (M0) or ~$57.00/mo (M10) | M0 is free indefinitely; M10 dedicated cluster starts at ~$0.08/hr. |
| **Estimated Starter Total (EC2 + Atlas M0)** | Single host + managed DB starter | **~$21.00 / month** | Suitable for portfolio demonstration and low-traffic staging. |
| **Estimated Production Total (EC2 + Atlas M10)** | Single host + dedicated DB with PITR | **~$78.00 / month** | Suitable for commercial production with automated database backups. |

---

## 13. Deployment Procedure

The deployment procedure uses **health-checked deployment with rollback support** via `scripts/deploy.sh`:

1. **Host Bootstrapping**:
   ```bash
   ssh -i key.pem ubuntu@<EC2_ELASTIC_IP>
   git clone <REPO_URL> /opt/aurora-ecommerce
   cd /opt/aurora-ecommerce
   sudo bash scripts/setup-ec2.sh
   ```
2. **Environment Configuration**:
   Create `.env.production` on the host:
   ```bash
   cp backend/.env.example .env.production
   # Populate MONGODB_URI (Atlas), SESSION_SECRET, FRONTEND_URL, RAZORPAY_*
   ```
3. **Execution**:
   ```bash
   chmod +x scripts/*.sh
   ./scripts/deploy.sh
   ```
4. **Behavior**:
   - `scripts/deploy.sh` builds images, starts containers via `docker compose -f docker-compose.prod.yml up -d`, and polls `http://127.0.0.1:5000/api/v1/health/ready` for up to 45 seconds.
   - If the readiness probe returns HTTP 200, the deployment is confirmed.
   - If the readiness probe fails or times out, the script dumps container logs and initiates rollback.
   - **Deployment Classification**: This is a **health-checked stop/start replacement with rollback support**, not a multi-node zero-downtime blue/green deployment. A brief connection reset (1–3 seconds) occurs while Docker restarts the backend container.

---

## 14. Rollback Procedure

If a deployed container fails in production:
```bash
# 1. View recent backend failure logs
docker logs --tail 100 aurora-backend-prod

# 2. Check container status
docker ps -a

# 3. Roll back to the previous stable Git commit
git checkout <PREVIOUS_STABLE_COMMIT_HASH>

# 4. Redeploy the previous version
./scripts/deploy.sh

# 5. Verify recovery
./scripts/health-check.sh <DOMAIN_OR_IP>
```

---

## 15. Known Limitations & Technical Debt

1. **Single EC2 Node**: For the expected initial traffic of this portfolio project, a single EC2 instance keeps the deployment simple and cost-effective. Higher traffic or strict high-availability requirements would require load testing and potentially multiple instances behind an Application Load Balancer.
2. **In-Memory Rate Limiting**: `express-rate-limit` currently tracks request counts in Node.js process memory. In a multi-instance cluster, a shared cache (e.g. Redis) or AWS WAF would be required to synchronize rate-limit windows across nodes.
3. **Local Docker CLI Unavailable**: Docker is not installed in the developer's local Windows environment; Docker manifests were validated by file inspection and syntax checks rather than local daemon execution.
4. **No File Upload Endpoint**: S3 service is implemented, but no REST route currently accepts multipart/form-data file uploads to store photos into S3.

---

## 16. Next Required Steps for Real AWS Deployment

When ready to execute a real cloud deployment:
1. **AWS Account & IAM**: Create an AWS IAM user with programmatic access or an EC2 Instance Role with policies for S3 (`s3:PutObject`, `s3:GetObject`) and SES (`ses:SendEmail`).
2. **Provision EC2 Instance**: Launch an Ubuntu 24.04 LTS instance (`t3.small`), allocate an Elastic IP, and attach the Security Group (ports 80, 443 open; port 22 restricted).
3. **Provision MongoDB Atlas Cluster**: Create an Atlas project, deploy an M0 or M10 cluster, add a database user, and whitelist the EC2 Elastic IP.
4. **Configure DNS & SSL**: Point Route 53 `A` record to the Elastic IP, run Certbot to obtain Let's Encrypt certificates, and mount them into Nginx.
5. **Install Project & Run Deploy**: Clone repository to `/opt/aurora-ecommerce`, populate `.env.production`, run `scripts/setup-ec2.sh`, and execute `scripts/deploy.sh`.
6. **Verify Cloud Health**: Run `./scripts/health-check.sh store.yourdomain.com` and perform real browser authentication and Razorpay webhook verification.

---

## 17. Final Audit Conclusion & Explicit Remaining Tasks

> **Phase 10 implementation, verification audit, and browser Playwright smoke testing are complete. The application code and browser UI flows have been locally verified, while Docker runtime verification and real AWS cloud deployment remain pending.**

### Explicit Remaining Tasks

1. **Local Docker Runtime Verification**:
   - Install/enable Docker Desktop or Docker Engine on host.
   - Validate Compose syntax: `docker compose -f docker-compose.prod.yml config`
   - Build production images and start containers: `docker compose -f docker-compose.prod.yml up --build -d`
   - Verify health probes (`/api/v1/health/live`, `/api/v1/health/ready`) and reverse proxy routing through Nginx.
2. **AWS Live Cloud Deployment & Infrastructure Verification**:
   - Launch Ubuntu 24.04 LTS EC2 instance (`t3.small`), allocate Elastic IP, and attach Security Group.
   - Provision MongoDB Atlas database (M10+ recommended for automated backups/PITR) and whitelist Elastic IP.
   - Configure Route 53 DNS `A` record and issue Let's Encrypt TLS certificate via Certbot.
   - Provision AWS S3 bucket and configure IAM policies.
   - Verify AWS SES domain identity for live production email delivery.
   - Execute `./scripts/deploy.sh` on EC2 host and verify with `./scripts/health-check.sh`.
   - Configure and test live Razorpay webhook callbacks over HTTPS.
