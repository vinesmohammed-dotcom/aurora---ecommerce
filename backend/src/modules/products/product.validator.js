const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const variantInputSchema = z.object({
  sku: z
    .string({ required_error: "Variant SKU is required" })
    .trim()
    .min(2, "SKU must be at least 2 characters")
    .toUpperCase(),
  attributes: z.record(z.string()).optional().default({}),
  price: z
    .number({ required_error: "Price is required" })
    .positive("Price must be greater than zero"),
  costPrice: z
    .number({ required_error: "Cost price is required" })
    .min(0, "Cost price cannot be negative"),
  stock: z
    .number({ required_error: "Stock count is required" })
    .int("Stock must be an integer")
    .min(0, "Stock cannot be negative"),
  images: z.array(z.string().trim()).optional().default([]),
  isActive: z.boolean().optional().default(true)
});

const createProductSchema = z.object({
  name: z
    .string({ required_error: "Product name is required" })
    .trim()
    .min(2, "Product name must be at least 2 characters")
    .max(120, "Product name cannot exceed 120 characters"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
    .optional(),
  description: z
    .string({ required_error: "Product description is required" })
    .trim()
    .min(10, "Description must be at least 10 characters long"),
  brand: z
    .string({ required_error: "Brand ID is required" })
    .regex(objectIdRegex, "Brand ID must be a valid 24-character hex ObjectId"),
  category: z
    .string({ required_error: "Category ID is required" })
    .regex(objectIdRegex, "Category ID must be a valid 24-character hex ObjectId"),
  images: z.array(z.string().trim()).optional().default([]),
  isActive: z.boolean().optional().default(false),
  variants: z
    .array(variantInputSchema)
    .min(1, "Product must have at least one variant before creation")
});

const updateProductSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
    .optional(),
  description: z.string().trim().min(10).optional(),
  brand: z.string().regex(objectIdRegex, "Invalid Brand ObjectId").optional(),
  category: z.string().regex(objectIdRegex, "Invalid Category ObjectId").optional(),
  images: z.array(z.string().trim()).optional(),
  isActive: z.boolean().optional()
});

const updateVariantSchema = z.object({
  sku: z.string().trim().min(2).toUpperCase().optional(),
  attributes: z.record(z.string()).optional(),
  price: z.number().positive("Price must be greater than zero").optional(),
  costPrice: z.number().min(0, "Cost price cannot be negative").optional(),
  stock: z.number().int().min(0, "Stock cannot be negative").optional(),
  images: z.array(z.string().trim()).optional(),
  isActive: z.boolean().optional()
});

const toggleProductStatusSchema = z.object({
  isActive: z.boolean({ required_error: "isActive status boolean is required" })
});

const SORT_OPTIONS = Object.freeze({
  NEWEST: "newest",
  PRICE_ASC: "price_asc",
  PRICE_DESC: "price_desc",
  NAME_ASC: "name_asc",
  NAME_DESC: "name_desc"
});

const queryProductSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStock: z.enum(["true", "false"]).optional(),
  sort: z
    .enum(Object.values(SORT_OPTIONS))
    .optional()
    .default(SORT_OPTIONS.NEWEST)
});

module.exports = {
  variantInputSchema,
  createProductSchema,
  updateProductSchema,
  updateVariantSchema,
  toggleProductStatusSchema,
  queryProductSchema,
  SORT_OPTIONS
};
