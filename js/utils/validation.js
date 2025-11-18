/**
 * @file validation.js
 * @description Form validation utilities using Zod
 * @version 2.0.0
 */

import { z } from 'zod';

/**
 * Email validation schema
 */
export const emailSchema = z.string().email('Invalid email address');

/**
 * Phone validation schema (Indian format)
 */
export const phoneSchema = z.string().regex(
  /^[6-9]\d{9}$/,
  'Invalid phone number (10 digits starting with 6-9)'
);

/**
 * Contact form validation schema
 */
export const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: emailSchema,
  phone: phoneSchema.optional(),
  message: z.string().min(10, 'Message must be at least 10 characters')
});

/**
 * Product validation schema
 */
export const productSchema = z.object({
  name: z.string().min(3, 'Product name must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.number().positive('Price must be positive'),
  category: z.enum(['sarees', 'kurtis', 'lehengas', 'accessories']),
  stock: z.number().int().nonnegative('Stock must be non-negative'),
  images: z.array(z.string().url()).min(1, 'At least one image required')
});

/**
 * FAQ validation schema
 */
export const faqSchema = z.object({
  question: z.string().min(5, 'Question must be at least 5 characters'),
  answer: z.string().min(10, 'Answer must be at least 10 characters'),
  order: z.number().int().nonnegative().optional()
});

/**
 * Newsletter validation schema
 */
export const newsletterSchema = z.object({
  email: emailSchema
});

/**
 * Helper function to validate data against schema
 */
export function validate(schema, data) {
  try {
    return {
      success: true,
      data: schema.parse(data),
      errors: null
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
    };
  }
}

/**
 * Helper to validate single field
 */
export function validateField(schema, field, value) {
  try {
    const fieldSchema = schema.shape[field];
    if (!fieldSchema) {
      throw new Error(`Field ${field} not found in schema`);
    }
    fieldSchema.parse(value);
    return { valid: true, error: null };
  } catch (error) {
    return {
      valid: false,
      error: error.errors[0]?.message || 'Validation failed'
    };
  }
}

export default {
  emailSchema,
  phoneSchema,
  contactSchema,
  productSchema,
  faqSchema,
  newsletterSchema,
  validate,
  validateField
};