/**
 * Typed error carrying an HTTP status code and optional field-level errors.
 * Throw this anywhere in a controller/service; the global error handler turns
 * it into a consistent JSON envelope.
 */
export default class ApiError extends Error {
  constructor(statusCode, message, errors = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors; // e.g. { email: 'Email already registered' }
  }

  static badRequest(message = 'Bad request', errors = null) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Conflict', errors = null) {
    return new ApiError(409, message, errors);
  }
}
