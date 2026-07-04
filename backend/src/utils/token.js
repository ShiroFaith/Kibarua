import jwt from 'jsonwebtoken';
import config from '../config/index.js';

/**
 * Sign a JWT for a user. The payload deliberately includes several id aliases
 * (`user_id`, `id`, `sub`) because different frontend pages decode the token
 * client-side and read different claim names.
 */
export function signToken(user) {
  const payload = {
    user_id: user.id,
    id: user.id,
    sub: String(user.id),
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}
