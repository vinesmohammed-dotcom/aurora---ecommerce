# Modular Monolith Full-Stack E-Commerce Application

A professional, enterprise-grade full-stack e-commerce platform built with the **MERN** stack (MongoDB, Express, React, Node.js) and architected for deployment on AWS (EC2, Nginx, PM2, S3, SES).

> [!IMPORTANT]
> **Current Status**: **Phase 1 (Project Foundation) Completed.**
> **Business features (catalog browsing, cart, checkout, payments, orders, coupons, wallet, admin CRUD) are not implemented yet.** They belong to Phase 2 and subsequent phases. This repository currently provides the tested runtime infrastructure, security middlewares, session management, and design system foundation.

---

## Technology Stack

- **Frontend**: React 18, Vite, JavaScript, Tailwind CSS, React Router, Redux Toolkit, Axios, React Hook Form, Zod.
- **Backend**: Node.js, Express, JavaScript, Mongoose, MongoDB Atlas, `express-session`, `connect-mongo`.
- **Security**: Helmet, strict CORS origin whitelisting, `express-rate-limit`, `httpOnly` secure cookies.
- **Testing**: Vitest, Supertest.
- **Architecture**: Modular Monolith + Service Layer + Feature-Based Frontend.

---

## Directory Structure Overview

```
project-root/
├── backend/            # Express REST API application
│   ├── src/
│   │   ├── config/     # Environment, MongoDB, and session configurations
│   │   ├── constants/  # HTTP codes and error definitions
│   │   ├── middlewares/# Error handling, 404, rate limiting, logging
│   │   ├── modules/    # Domain modules (auth, cart, orders, etc.)
│   │   ├── routes/     # Versioned REST router (/api/v1)
│   │   ├── utils/      # AppError, asyncHandler, ApiResponse
│   │   ├── app.js      # Decoupled Express app setup (for testing)
│   │   └── server.js   # Server entry point, DB boot & graceful shutdown
│   └── tests/          # Integration & smoke tests
├── frontend/           # React + Vite Single Page Application
│   ├── src/
│   │   ├── app/        # Router and application shell
│   │   ├── components/ # Reusable UI components & layouts
│   │   ├── features/   # Domain-driven feature slices
│   │   ├── layouts/    # MainLayout, AuthLayout, AdminLayout
│   │   ├── pages/      # Route placeholder views
│   │   ├── services/   # Axios API client
│   │   ├── store/      # Redux Toolkit store & slices
│   │   └── utils/      # Formatters & parsers
├── docs/               # 29 Architectural blueprints, diagrams, and specs
├── PROJECT_STATUS.md   # Master roadmap and tracking board
├── .env.example        # Environment variable template
└── .gitignore
```

---

## Getting Started

### Prerequisites
- Node.js (v18+ or v20+ LTS recommended)
- npm (v9+)
- MongoDB running locally on `mongodb://127.0.0.1:27017` or a MongoDB Atlas connection URI.

### 1. Environment Setup
Copy `.env.example` to `backend/.env`:
```bash
cp .env.example backend/.env
```

### 2. Running the Backend
```bash
cd backend
npm install
npm run dev
```
The server will boot on `http://localhost:5000`. You can verify the health endpoint:
```bash
curl http://localhost:5000/api/v1/health
```

### 3. Running Backend Tests
```bash
cd backend
npm test
```

### 4. Running the Frontend
```bash
cd frontend
npm install
npm run dev
```
The frontend will start on `http://localhost:5173`.

### 5. Building for Production
```bash
cd frontend
npm run build
```

---

## Documentation
Refer to the [docs/](file:///c:/Users/vines/react%20first%20project/docs) directory for all specifications:
- [01-requirements.md](file:///c:/Users/vines/react%20first%20project/docs/01-requirements.md) — System requirements and feature prioritization.
- [02-system-architecture.md](file:///c:/Users/vines/react%20first%20project/docs/02-system-architecture.md) — Topology and responsibility boundaries.
- [07-database-design.md](file:///c:/Users/vines/react%20first%20project/docs/07-database-design.md) — 15 MongoDB collection schemas.
- [13-payment-flow.md](file:///c:/Users/vines/react%20first%20project/docs/13-payment-flow.md) — Razorpay integration & webhook idempotency.
- [26-learning-log.md](file:///c:/Users/vines/react%20first%20project/docs/26-learning-log.md) — 25 core concepts explained with analogies.
