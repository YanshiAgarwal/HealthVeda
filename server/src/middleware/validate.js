/**
 * validate({ body, query, params }) - check request data against zod schemas.
 * Unknown fields are rejected, so attackers can't sneak in extra properties.
 * The cleaned values are stored in req.valid.body / .query / .params.
 */
import { AppError } from "../utils/AppError.js";

export function validate(schemas) {
  return (req, _res, next) => {
    req.valid = {};
    for (const part of ["params", "query", "body"]) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (!result.success) {
        const issue = result.error.issues[0];
        const field = issue.path.join(".");
        throw new AppError(400, field ? `${field}: ${issue.message}` : issue.message, "VALIDATION_ERROR");
      }
      req.valid[part] = result.data;
    }
    next();
  };
}
