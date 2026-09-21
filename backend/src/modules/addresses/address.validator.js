const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const phoneRegex = /^[0-9+ -]{10,15}$/;

const addressIdParamSchema = z.object({
  id: z
    .string({ required_error: "Address ID is required" })
    .regex(objectIdRegex, "Invalid Address ObjectId format")
});

const createAddressSchema = z.object({
  fullName: z
    .string({ required_error: "Recipient full name is required" })
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name cannot exceed 100 characters"),
  phone: z
    .string({ required_error: "Phone number is required" })
    .trim()
    .regex(phoneRegex, "Phone number must be between 10 and 15 digits/symbols"),
  addressLine1: z
    .string({ required_error: "Address line 1 is required" })
    .trim()
    .min(3, "Address line 1 must be at least 3 characters")
    .max(200, "Address line 1 cannot exceed 200 characters"),
  addressLine2: z
    .string()
    .trim()
    .max(200, "Address line 2 cannot exceed 200 characters")
    .optional()
    .default(""),
  city: z
    .string({ required_error: "City is required" })
    .trim()
    .min(2, "City name must be at least 2 characters")
    .max(100, "City name cannot exceed 100 characters"),
  state: z
    .string({ required_error: "State is required" })
    .trim()
    .min(2, "State name must be at least 2 characters")
    .max(100, "State name cannot exceed 100 characters"),
  postalCode: z
    .string({ required_error: "Postal code is required" })
    .trim()
    .min(3, "Postal code must be at least 3 characters")
    .max(20, "Postal code cannot exceed 20 characters"),
  country: z
    .string()
    .trim()
    .min(2, "Country name must be at least 2 characters")
    .optional()
    .default("India"),
  label: z
    .enum(["HOME", "WORK", "OTHER"], {
      errorMap: () => ({ message: "Label must be either HOME, WORK, or OTHER" })
    })
    .optional()
    .default("HOME"),
  isDefault: z.boolean().optional().default(false)
});

const updateAddressSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().regex(phoneRegex).optional(),
  addressLine1: z.string().trim().min(3).max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  state: z.string().trim().min(2).max(100).optional(),
  postalCode: z.string().trim().min(3).max(20).optional(),
  country: z.string().trim().min(2).optional(),
  label: z.enum(["HOME", "WORK", "OTHER"]).optional(),
  isDefault: z.boolean().optional()
});

module.exports = {
  addressIdParamSchema,
  createAddressSchema,
  updateAddressSchema
};
