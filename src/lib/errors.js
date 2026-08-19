'use strict';

/**
 * Error de aplicación con código estable para el catálogo.
 * Cualquier módulo puede lanzarlo; solo app.js lo presenta al usuario.
 */
class AppError extends Error {
  constructor(code, message, options = {}) {
    super(message || 'Error de aplicación.');
    this.name = 'AppError';
    this.code = code;
    this.detail = options.detail !== undefined ? options.detail : undefined;
    if (options.cause) this.cause = options.cause;
  }
}

module.exports = { AppError };