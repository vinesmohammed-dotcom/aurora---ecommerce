# 20 — Centralized Error Handling Architecture

## 1. Operational Errors vs Programmer Bugs
In Node.js applications, errors fall into two distinct categories:

```
+-----------------------------------------------------------------------------+
| OPERATIONAL ERRORS (Expected Runtime Failures)                              |
| - Known conditions that happen in normal system operation.                  |
| - Examples: Invalid user input, expired coupon, item out of stock,          |
|   invalid credentials, rate-limit reached.                                   |
| - Handling: Return clean, friendly HTTP 4xx errors with descriptive messages|
|   and machine-readable codes.                                               |
+-----------------------------------------------------------------------------+
                                      vs
+-----------------------------------------------------------------------------+
| PROGRAMMER BUGS (Unexpected System Exceptions)                              |
| - Unhandled failures caused by code bugs or infrastructural drops.          |
| - Examples: Reading undefined property, database connection dropped,        |
|   syntax error in calculation.                                              |
| - Handling: Log full stack trace to server logs / PM2. Return a generic     |
|   500 "Internal Server Error" to the client without exposing code internals.|
+-----------------------------------------------------------------------------+
```

---

## 2. Custom Error Class: `AppError` (`utils/AppError.js`)

```javascript
class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_SERVER_ERROR", errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.isOperational = true; // Flag distinguishing from runtime bugs

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
```

---

## 3. Global Express Error Handling Middleware (`middlewares/error.middleware.js`)

```javascript
const AppError = require("../utils/AppError");

const globalErrorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;
  error.code = err.code || "INTERNAL_SERVER_ERROR";

  // 1. Handle Mongoose Bad ObjectId (CastError)
  if (err.name === "CastError") {
    error = new AppError(`Resource not found with id: ${err.value}`, 404, "NOT_FOUND");
  }

  // 2. Handle Mongoose Duplicate Key Error (Code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = new AppError(`A record with this ${field} already exists.`, 409, "DUPLICATE_FIELD");
  }

  // 3. Handle Mongoose Schema Validation Error
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((el) => ({
      field: el.path,
      message: el.message
    }));
    error = new AppError("Invalid input data", 400, "VALIDATION_ERROR", errors);
  }

  // 4. Handle Zod Validation Errors
  if (err.name === "ZodError") {
    const errors = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message
    }));
    error = new AppError("Validation failed", 400, "VALIDATION_ERROR", errors);
  }

  // 5. Leakage Prevention: Send Sanitized Response
  const isDev = process.env.NODE_ENV === "development";

  return res.status(error.statusCode).json({
    success: false,
    message: error.isOperational ? error.message : "Something went wrong on our servers. Please try again later.",
    code: error.code,
    errors: error.errors || [],
    ...(isDev && { stack: err.stack }) // NEVER leak stack trace in production!
  });
};

module.exports = globalErrorHandler;
```

---

## 4. Information Leakage Rules

| Data Element | Expose to Client in Dev? | Expose to Client in Prod? | Justification |
| :--- | :--- | :--- | :--- |
| **Friendly Message** ("Invalid email or password") | **Yes** | **Yes** | Necessary for customer usability. |
| **Validation Error List** (`{ field: "phone", message: "..." }`) | **Yes** | **Yes** | Enables form inputs to highlight error states. |
| **Database Column Names / MongoDB internals** | **Yes** | **NO** | Attackers use schema internals to craft targeted injection exploits. |
| **Full Stack Trace** (`at Layer.handle ... /src/services/auth.js:42`) | **Yes** | **NO** | Stack traces reveal file system paths, library versions, and server architecture. |
| **Third-Party API Secrets / Raw Gateway Responses** | **NO** | **NO** | Must remain strictly server-side; log internally only. |
