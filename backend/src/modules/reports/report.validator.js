const { z } = require("zod");

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const isValidCalendarDate = (dateString) => {
  if (!dateRegex.test(dateString)) return false;
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const salesReportQuerySchema = z
  .object({
    from: z
      .string()
      .trim()
      .refine(isValidCalendarDate, { message: "Invalid 'from' date. Must be YYYY-MM-DD format with valid calendar day." })
      .optional(),
    to: z
      .string()
      .trim()
      .refine(isValidCalendarDate, { message: "Invalid 'to' date. Must be YYYY-MM-DD format with valid calendar day." })
      .optional(),
    limit: z.coerce.number().int().positive().max(100).default(10).optional()
  })
  .refine(
    (data) => {
      if (data.from && data.to) {
        return new Date(data.from) <= new Date(data.to);
      }
      return true;
    },
    {
      message: "'from' date must be less than or equal to 'to' date.",
      path: ["from"]
    }
  );

module.exports = {
  salesReportQuerySchema
};
