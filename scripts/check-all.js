'use strict';

/**
 * Valida la sintaxis de todos los archivos JavaScript del proyecto.
 * Se ejecuta con "npm run build".
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

const SKIP = new Set(['node_modules', '.git', 'dist', 'backups', 'logs', 'coverage']);

function walkJs(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJs(full, acc);
    else if (entry.name.endsWith('.js')) acc.push(full);
  }
  return acc;
}

const files = walkJs(ROOT);
let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(result.stderr || result.stdout);
    process.stderr.write(`\nSyntax error en ${path.relative(ROOT, file)}\n`);
  }
}

if (failed) {
  process.stderr.write('\n[build] Falló la validación de sintaxis.\n');
  process.exit(1);
}

process.stdout.write(`[build] Sintaxis validada correctamente en ${files.length} archivos.\n`);
process.exit(0);