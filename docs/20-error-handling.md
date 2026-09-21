# 20 — Centralized Error Handling Architecture

## 1. Operational Errors vs Programmer Bugs
In Node.js applications, errors fall into two distinct categories:

```
+-----------------------------------------------------------------------------+
| OPERATIONAL ERRORS (Expected Runtime Failures)                              |
| - Known conditions that happen in normal system operation.                  |
| - Examples: Invalid email format, incorrect password, expired OTP,          |
|   duplicate registration email, account suspended.                          |
| - Handling: Return clean, friendly HTTP 4xx errors with descriptive messages|
|   and machine-readable codes.                                               |
+-----------------------------------------------------------------------------+
                                      vs
+-----------------------------------------------------------------------------+
| PROGRAMMER BUGS (Unexpected System Exceptions)                              |
| - Unhandled failures caused by code bugs or infrastructural drops.          |
| - Examples: TypeError reading property of undefined, dropped database       |
|   connection mid-query, syntax error in template.                           |
| - Handling: Log full stack trace to server logs. Return a generic 500       |
|   "Internal Server Error" to the client without exposing internals.         |
+-----------------------------------------------------------------------------+
```

---

## 2. Custom Error Class: `AppError` (`backend/src/utils/AppError.js`)

```javascript
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.isOperational = true; // Flag distinguishing known operational errors

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
```

---

## 3. Zod Input Validation Middleware (`backend/src/middlewares/validate.middleware.js`)

Schema validation runs before controllers are invoked. When input validation fails, the middleware formats Zod issues into standardized field-level error objects and returns HTTP 422 (Unprocessable Entity):

```javascript
const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return next(new AppError('Validation failed. Please check your inputs.', 422, 'VALIDATION_ERROR', errors));
    }
    next(err);
  }
};
```

**Standard Validation Error Response (HTTP 422)**:
```json
{
  "success": false,
  "message": "Validation failed. Please check your inputs.",
  "code": "VALIDATION_ERROR",
  "errors": [
    { "field": "email", "message": "Please provide a valid email address" },
    { "field": "password", "message": "Password must be at least 8 characters long" }
  ]
}
```

---

## 4. Global Express Error Handler (`backend/src/middlewares/error.middleware.js`)

With Express 5, all rejected promises in async route handlers are caught natively and routed directly into this 4-argument middleware:

```javascript
const globalErrorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message || 'Internal Server Error';
  error.statusCode = err.statusCode || 500;
  error.code = err.code || 'INTERNAL_SERVER_ERROR';

  // 1. Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    error = new AppError(`Resource not found with ID: ${err.value}`, 404, 'NOT_FOUND');
  }

  // 2. Mongoose Duplicate Key Error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = new AppError(`A record with that ${field} already exists.`, 409, 'DUPLICATE_RESOURCE');
  }

  // 3. Information Leakage Protection: Dev vs Prod response
  const isDev = process.env.NODE_ENV === 'development';

  return res.status(error.statusCode).json({
    success: false,
    message: error.isOperational ? error.message : 'An unexpected server error occurred.',
    code: error.code,
    errors: error.errors || [],
    ...(isDev && { stack: err.stack }),
  });
};
```

---

## 5. Information Leakage Rules

| Data Element | Expose in Development? | Expose in Production? | Justification |
| :--- | :--- | :--- | :--- |
| **Friendly Message** ("Invalid email or password") | **Yes** | **Yes** | Required for UI display and customer feedback. |
| **Field Validation Errors** (`[{ field, message }]`) | **Yes** | **Yes** | Enables forms to map error messages to specific inputs. |
| **Database Column Names / Mongo Internals** | **Yes** | **NO** | Prevents disclosing schema internals for SQL/NoSQL injection crafting. |
| **Full Stack Trace** (`at Layer.handle ...`) | **Yes** | **NO** | Never expose server directory paths, dependencies, or runtime internals. |
| **Raw OTP Values / Password Hashes** | **NO** | **NO** | Secrets must never be transmitted in error payloads under any circumstance. |
