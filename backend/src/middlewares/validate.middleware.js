const AppError = require("../utils/AppError");
const HTTP_CODES = require("../constants/httpCodes");
const ERROR_CODES = require("../constants/errorCodes");

/**
 * Zod Request Validation Middleware
 * Validates req.body, req.query, or req.params against a provided Zod schema.
 *
 * @param {import("zod").ZodSchema} schema - Zod validation schema
 * @param {"body" | "query" | "params"} source - Property on req to validate (default: "body")
 */
const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const formattedErrors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      }));

      return next(
        new AppError(
          "Validation failed on submitted fields",
          HTTP_CODES.UNPROCESSABLE_ENTITY,
          ERROR_CODES.VALIDATION_ERROR,
          formattedErrors
        )
      );
    }

    // Replace unvalidated source with sanitized, typed data from Zod
    req[source] = result.data;
    next();
  };
};

module.exports = validate;
