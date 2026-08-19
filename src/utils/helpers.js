'use strict';

/**
 * Utilidades puras y reutilizables. No dependen de red ni de E/S salvo de
 * node:fs/node:path para operaciones triviales de sistema de archivos.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const CONSTS = require('../consts');

function pad(value, length = 2) {
  return String(value).padStart(length, '0');
}

function now() {
  return new Date();
}

function isoTimestamp(date = new Date()) {
  return date.toISOString();
}

/** Marca de tiempo legible para nombres de archivo: 2026-08-19_12-30-05 */
function clockStamp(date = new Date()) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  );
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return '0ms';
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${ms}ms`;
}

/** Elimina caracteres no seguros para nombres de archivo. */
function sanitizeFileName(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Expande ~ y normaliza una ruta relativa contra process.cwd(). */
function resolvePath(p) {
  if (!p) return p;
  const expanded = p === '~' ? os.homedir() : p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p;
  return path.resolve(expanded);
}

/** Asegura que un directorio exista y lo devuelve como ruta absoluta. */
function ensureDir(dir) {
  const abs = resolvePath(dir);
  fs.mkdirSync(abs, { recursive: true });
  return abs;
}

/** Genera el nombre de archivo del artefacto de backup. */
function buildBackupFileName({ database, dbName, backupType = 'full', stamp }) {
  const ts = stamp || clockStamp();
  const ext = backupType === 'full' ? '.sql' : `.${backupType}.sql`;
  return `${sanitizeFileName(database)}__${sanitizeFileName(dbName)}__${ts}${ext}`;
}

/** Verifica si un archivo empieza por la magic number de gzip (1f 8b). */
function isGzipFile(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(2);
    const read = fs.readSync(fd, buf, 0, 2, 0);
    return read === 2 && buf[0] === 0x1f && buf[1] === 0x8b;
  } finally {
    fs.closeSync(fd);
  }
}

/** Calcula el checksum sha256 de un archivo de forma incremental. */
function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/** Copia un archivo local con streams. */
function copyFile(source, dest) {
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(source);
    const ws = fs.createWriteStream(dest);
    rs.on('error', (err) => {
      ws.destroy();
      reject(err);
    });
    ws.on('error', (err) => reject(err));
    ws.on('finish', () => resolve(dest));
    rs.pipe(ws);
  });
}

/** Ejecuta un comando en un proceso hijo y resuelve con la salida capturada. */
function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, {
        stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
        ...options.spawn,
      });
    } catch (err) {
      reject(err);
      return;
    }
    let stdout = '';
    let stderr = '';
    if (child.stdout) child.stdout.on('data', (d) => (stdout += d.toString()));
    if (child.stderr) child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        const e = new Error(`Binario no encontrado: ${command}`);
        e.code = 'DB_CMD_NOT_FOUND';
        e.detail = err.message;
        reject(e);
        return;
      }
      reject(err);
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        const e = new Error(`El comando "${command}" terminó con código ${code}.`);
        e.code = options.errorCode || 'DUMP_FAILED';
        e.detail = stderr.trim() || stdout.trim();
        e.command = command;
        e.args = args;
        reject(e);
      }
    });
  });
}

/** Versión del mensaje de error con el catálogo de sugerencias aplicado. */
function formatError(err) {
  const catalog = CONSTS.ERROR_CATALOG;
  const code = err && err.code ? String(err.code) : 'UNKNOWN';
  const entry = catalog[code] || catalog.UNKNOWN;
  const lines = [];
  lines.push(`[ERROR] ${code}`);
  lines.push(`  ${err && err.message ? err.message : entry.message}`);
  if (err && err.detail) {
    const detail = String(err.detail).split('\n').slice(0, 5).join('\n  ');
    lines.push(`  Detalle: ${detail}`);
  }
  lines.push(`  Solución: ${entry.solution}`);
  return lines.join('\n');
}

module.exports = Object.freeze({
  pad,
  now,
  isoTimestamp,
  clockStamp,
  formatBytes,
  formatDuration,
  sanitizeFileName,
  resolvePath,
  ensureDir,
  buildBackupFileName,
  isGzipFile,
  sha256File,
  runProcess,
  copyFile,
  formatError,
});