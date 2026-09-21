const { z } = require("zod");

const createBrandSchema = z.object({
  name: z
    .string({ required_error: "Brand name is required" })
    .trim()
    .min(2, "Brand name must be at least 2 characters long")
    .max(50, "Brand name cannot exceed 50 characters"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
    .optional(),
  logoUrl: z.string().trim().url("Logo URL must be a valid URL").optional().or(z.literal("")),
  description: z.string().trim().max(500, "Description cannot exceed 500 characters").optional(),
  isActive: z.boolean().optional().default(true)
});

const updateBrandSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Brand name must be at least 2 characters long")
    .max(50, "Brand name cannot exceed 50 characters")
    .optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
    .optional(),
  logoUrl: z.string().trim().url("Logo URL must be a valid URL").optional().or(z.literal("")),
  description: z.string().trim().max(500, "Description cannot exceed 500 characters").optional(),
  isActive: z.boolean().optional()
});

const toggleBrandStatusSchema = z.object({
  isActive: z.boolean({ required_error: "isActive status boolean is required" })
});

module.exports = {
  createBrandSchema,
  updateBrandSchema,
  toggleBrandStatusSchema
};
