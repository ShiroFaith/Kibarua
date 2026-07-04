import ApiError from '../utils/apiError.js';
import config from '../config/index.js';

/** 404 handler for unmatched routes. */
export function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

/** Central error handler - turns thrown errors into the JSON envelope. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Uniqueness / FK violations from SQLite.
  if (err && typeof err.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) {
    return res.status(409).json({
      success: false,
      message: 'A record with those details already exists.',
    });
  }

  // File-upload errors from multer (size limit, unexpected field, …).
  if (err && err.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : 'File upload failed';
    return res.status(400).json({ success: false, message: msg });
  }

  const status = err instanceof ApiError ? err.statusCode : err.status || 500;
  const payload = {
    success: false,
    message: err.message || 'Internal server error',
  };
  if (err instanceof ApiError && err.errors) payload.errors = err.errors;
  if (config.env !== 'production' && status >= 500) payload.stack = err.stack;

  if (status >= 500) console.error('❌', err);

  res.status(status).json(payload);
}
