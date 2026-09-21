const { z } = require("zod");

const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(50, "Name cannot exceed 50 characters").optional(),
  phone: z.string().trim().regex(/^\d{10}$/, "Phone number must be exactly 10 digits").optional()
});

module.exports = {
  updateProfileSchema
};
