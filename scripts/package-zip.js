'use strict';

/**
 * Genera database-backup-utility-spec.zip con toda la estructura del proyecto
 * (excluyendo node_modules, .git, artefactos y logs).
 *
 * Uso: npm run package
 */

const fs = require('node:fs');
const path = require('node:path');
const archiver = require('archiver');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'database-backup-utility-spec.zip');

const EXCLUDED = new Set([
  'node_modules',
  '.git',
  'backups',
  'logs',
  'dist',
  'coverage',
  'database-backup-utility-spec.zip',
]);

function collect(dir, basePath, acc) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.join(basePath, entry.name);
    if (entry.isDirectory()) collect(full, rel, acc);
    else acc.push({ full, rel });
  }
  return acc;
}

const files = collect(ROOT, '.', []);

const out = fs.createWriteStream(OUTPUT);
const archive = archiver('zip', { zlib: { level: 9 } });

out.on('close', () => {
  process.stdout.write(`[package] ${OUTPUT} generado (${files.length} archivos, ${archive.pointer()} bytes).\n`);
  process.exit(0);
});

archive.on('error', (err) => {
  process.stderr.write(`[package] Error al empaquetar: ${err.message}\n`);
  process.exit(1);
});

archive.pipe(out);

for (const f of files) {
  archive.file(f.full, { name: f.rel });
}

archive.finalize();