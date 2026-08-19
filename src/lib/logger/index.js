'use strict';

/**
 * Logger estructurado. Doble salida:
 *   - Consola: texto plano legible.
 *   - Archivo: JSON Lines (logs/app-YYYY-MM-DD.jsonl).
 *
 * Eventos: START, END, ERROR, WARN con ts y durationMs.
 * NUNCA registra credenciales (ver redactSecrets).
 */

const fs = require('node:fs');
const path = require('node:path');
const helpers = require('../../utils/helpers');

const SECRET_KEYS = /(password|passwd|secret|token|api[_]?key|connstring|connection_string)/i;

/** Sustituye valores sensibles dentro de un objeto/string. */
function redactSecrets(value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    return value.replace(/("?(?:password|passwd|secret|token|key|conn ?string)"?\s*[:=]\s*"?)[^"\s,}]+/gi, '$1***');
  }
  if (Array.isArray(value)) return value.map((v) => redactSecrets(v));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEYS.test(k) ? '***' : redactSecrets(v);
    }
    return out;
  }
  return value;
}

function jsonlEntry(entry) {
  return JSON.stringify(entry);
}

function createLogger(options = {}) {
  const destDir = helpers.ensureDir(options.destDir || 'logs');
  const verbose = options.verbose !== false;
  const day = helpers.clockStamp().split('_')[0];
  const file = path.join(destDir, `app-${day}.jsonl`);

  function emit(level, event, message, context, startedMs) {
    const ts = new Date().toISOString();
    const entry = {
      ts,
      level,
      event,
      message,
      durationMs: startedMs ? Date.now() - startedMs : undefined,
      context: redactSecrets(context || {}),
    };
    try {
      fs.appendFileSync(file, jsonlEntry(entry) + '\n');
    } catch (err) {
      process.stderr.write(`[logger] no se pudo escribir ${file}: ${err.message}\n`);
    }
    if (verbose) {
      const line = `[${ts}] ${level.toUpperCase()} ${event}${startedMs ? ` (+${entry.durationMs}ms)` : ''}: ${message}`;
      process.stdout.write(line + '\n');
    }
    return entry;
  }

  return Object.freeze({
    file,
    redact: redactSecrets,
    start(event = 'OPERATION', message, context) {
      return emit('info', 'START', message || `Iniciando ${event}`, context);
    },
    ok(event = 'OPERATION', message, context, startedMs) {
      return emit('info', 'END', message || `${event} finalizado`, context, startedMs);
    },
    warn(event, message, context) {
      return emit('warn', 'WARN', message, context);
    },
    error(event, err, context, startedMs) {
      const message = err && err.message ? err.message : String(err);
      const ctx = { ...(context || {}), code: (err && err.code) || 'UNKNOWN' };
      return emit('error', 'ERROR', message, ctx, startedMs);
    },
  });
}

module.exports = Object.freeze({
  createLogger,
  redactSecrets,
  jsonlEntry,
});