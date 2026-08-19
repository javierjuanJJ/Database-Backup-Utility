'use strict';

/**
 * Fachada de operaciones de backup. Combina los builders de comandos con la
 * compresión para generar el artefacto de respaldo.
 */

const fs = require('node:fs');
const path = require('node:path');
const CONSTS = require('../../consts');
const { AppError } = require('../errors');
const helpers = require('../../utils/helpers');
const { buildDumpCommand, artifactRawName } = require('./commands');
const { compressArtifact } = require('./compress');

/** Valida que el tipo de backup sea aceptado para el motor. */
function validateBackupType(type, dbType) {
  if (!CONSTS.BACKUP_TYPES.includes(type)) {
    throw new AppError('UNSUPPORTED_BACKUP_TYPE', `Tipo de backup "${type}" no soportado.`, {
      detail: `Tipos: ${CONSTS.BACKUP_TYPES.join(', ')}`,
    });
  }
  if (dbType === 'sqlite' && type !== 'full') {
    throw new AppError('UNSUPPORTED_BACKUP_TYPE', `SQLite no soporta backups "${type}".`, {
      detail: 'SQLite solo admite backup full (copia del archivo con checkpoint WAL).',
    });
  }
  return type;
}

/** Directorio de trabajo temporal para el volcado antes de comprimir. */
function stageDir(outDir) {
  return helpers.ensureDir(path.join(outDir, '.staging'));
}

/** Elimina un archivo o directorio de forma segura. */
function safeRemove(target) {
  if (!target) return;
  try {
    if (fs.statSync(target).isDirectory()) fs.rmSync(target, { recursive: true, force: true });
    else fs.rmSync(target, { force: true });
  } catch {
    /* ignore */
  }
}

/** Copia un archivo local de forma robusta (SQLite). */
const copyFile = helpers.copyFile;

/**
 * Genera el artefacto de backup en outDir.
 * Devuelve { rawFile, file, sizeBytes, compressed } (sin checksum: lo añade el servicio).
 */
async function produceArtifact(config, options = {}) {
  const outDir = helpers.ensureDir(options.outDir || CONSTS.DEFAULTS.OUT_DIR);
  const staging = stageDir(outDir);
  const rawName = artifactRawName(config, options);
  const rawFile = path.join(staging, rawName);
  const command = buildDumpCommand(config, { ...options, outFile: rawFile });

  try {
    if (command.mode === 'copy') {
      await copyFile(command.source, rawFile);
    } else {
      await helpers.runProcess(command.bin, command.args, {
        env: { ...process.env, ...command.env },
        errorCode: 'DUMP_FAILED',
      });
    }
  } catch (err) {
    safeRemove(rawFile);
    if (err && err.code) throw err;
    throw new AppError('DUMP_FAILED', `No se pudo copiar el archivo ${command.source}.`, {
      detail: err.message,
      cause: err,
    });
  }

  let file = rawFile;
  let compressed = false;
  if (options.compress !== false) {
    file = await compressArtifact(rawFile);
    compressed = true;
  }

  // Mover el artefacto definitivo (comprimido o no) fuera del staging.
  const finalPath = path.join(outDir, path.basename(file));
  fs.renameSync(file, finalPath);
  safeRemove(staging);
  file = finalPath;

  const sizeBytes = fs.statSync(file).size;
  return { rawFile: file, file, sizeBytes, compressed };
}

module.exports = Object.freeze({
  validateBackupType,
  produceArtifact,
  copyFile,
});