/**
 * Standard success envelope. Extra top-level fields (e.g. token, user,
 * pagination) can be merged in via `extra` - several frontend clients read
 * data both at the top level and nested under `data`.
 */
export function ok(res, { message = 'OK', data = null, extra = {}, status = 200 } = {}) {
  return res.status(status).json({ success: true, message, data, ...extra });
}

export function created(res, opts = {}) {
  return ok(res, { status: 201, message: 'Created', ...opts });
}

/**
 * Build a pagination object matching what the frontend expects:
 * { total, page, limit, total_pages }.
 */
export function paginate(total, page, limit) {
  return {
    total,
    page,
    limit,
    total_pages: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * Parse ?page= & ?limit= query params into safe integers.
 */
export function pageParams(query, defaultLimit = 20) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
