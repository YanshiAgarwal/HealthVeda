/**
 * AppError - an error that is SAFE to show to the user.
 * Anything else that goes wrong shows only "Something went wrong"
 * (details stay in the server logs).
 */
export class AppError extends Error {
  constructor(status, message, code = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.expose = true;
  }
}

export const badRequest = (msg, code) => new AppError(400, msg, code);
export const unauthorized = (msg = "Please log in to continue", code = "UNAUTHORIZED") => new AppError(401, msg, code);
export const forbidden = (msg = "You are not allowed to do that") => new AppError(403, msg, "FORBIDDEN");
export const notFound = (msg = "Not found") => new AppError(404, msg, "NOT_FOUND");
