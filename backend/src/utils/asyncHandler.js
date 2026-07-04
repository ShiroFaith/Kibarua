/**
 * Wraps an async route handler so any thrown error (or rejected promise) is
 * forwarded to Express's error middleware instead of crashing the process.
 */
export default function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
