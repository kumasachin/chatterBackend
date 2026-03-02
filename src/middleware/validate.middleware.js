/**
 * validateBody(schema) — reusable Zod request body validation middleware.
 *
 * Usage in a route file:
 *   import { validateBody } from "../middleware/validate.middleware.js";
 *   import { loginSchema } from "../utils/schemas.js";
 *
 *   router.post("/login", validateBody(loginSchema), login);
 *
 * On failure: returns 400 with an array of field errors.
 * On success: attaches parsed (coerced + stripped) data to req.body.
 */
export const validateBody = schema => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map(e => ({
      field: e.path.join("."),
      message: e.message,
    }));
    return res.status(400).json({
      message: errors[0]?.message || "Validation failed",
      errors,
    });
  }

  // Replace req.body with parsed data (strips unknown fields, applies defaults)
  req.body = result.data;
  next();
};
