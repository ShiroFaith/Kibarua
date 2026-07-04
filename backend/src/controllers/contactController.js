import db from '../db/connection.js';
import { created } from '../utils/response.js';
import { isEmail } from '../utils/helpers.js';
import ApiError from '../utils/apiError.js';

// POST /contact/submit  - public contact / support form.
export async function submit(req, res) {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim().toLowerCase();
  const subject = String(b.subject || '').trim();
  const message = String(b.message || '').trim();

  const errors = {};
  if (!name) errors.name = 'Name is required';
  if (!isEmail(email)) errors.email = 'A valid email is required';
  if (message.length < 5) errors.message = 'Please enter a longer message';
  if (Object.keys(errors).length) throw ApiError.badRequest('Validation failed', errors);

  db.prepare(
    'INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
  ).run(name, email, subject, message);

  return created(res, { message: "Thank you for your message! We'll get back to you soon." });
}
