const { z } = require("zod");

const createCategorySchema = z.object({
  name: z
    .string({ required_error: "Category name is required" })
    .trim()
    .min(2, "Category name must be at least 2 characters long")
    .max(50, "Category name cannot exceed 50 characters"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
    .optional(),
  description: z.string().trim().max(500, "Description cannot exceed 500 characters").optional(),
  isActive: z.boolean().optional().default(true)
});

const updateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters long")
    .max(50, "Category name cannot exceed 50 characters")
    .optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
    .optional(),
  description: z.string().trim().max(500, "Description cannot exceed 500 characters").optional(),
  isActive: z.boolean().optional()
});

module.exports = {
  createCategorySchema,
  updateCategorySchema
};
