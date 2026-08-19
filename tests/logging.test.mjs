import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLogger, redactSecrets } from '../src/lib/logger/index.js';
import { buildSlackMessage } from '../src/lib/logger/slack.js';

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbu-log-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('logger/redactSecrets', () => {
  it('oculta contraseñas en string', () => {
    expect(redactSecrets('password=supersecret&x=1')).not.toContain('supersecret');
  });

  it('oculta valores de claves sensibles en objetos', () => {
    const out = redactSecrets({ password: 'pw', name: 'ok', nested: { apikey: 'k' } });
    expect(out.password).toBe('***');
    expect(out.nested.apikey).toBe('***');
    expect(out.name).toBe('ok');
  });
});

describe('logger/createLogger', () => {
  it('escribe eventos START y END en el archivo JSONL', () => {
    const logger = createLogger({ destDir: tmpDir, verbose: false });
    const startedAt = Date.now();
    logger.start('BACKUP', 'Iniciando', { database: 'mysql' });
    logger.ok('BACKUP', 'Finalizado', { status: 'success' }, startedAt);
    const content = fs.readFileSync(logger.file, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).event).toBe('START');
    expect(JSON.parse(lines[1]).event).toBe('END');
    expect(JSON.parse(lines[1]).durationMs).toBeGreaterThanOrEqual(0);
  });

  it('registra ERROR con el código de la excepción', () => {
    const logger = createLogger({ destDir: tmpDir, verbose: false });
    logger.error('BACKUP', Object.assign(new Error('fallo'), { code: 'DUMP_FAILED' }));
    const content = fs.readFileSync(logger.file, 'utf8');
    const entry = JSON.parse(content.trim().split('\n')[0]);
    expect(entry.event).toBe('ERROR');
    expect(entry.level).toBe('error');
    expect(entry.context.code).toBe('DUMP_FAILED');
    expect(entry.message).toContain('fallo');
  });
});

describe('logger/slack buildSlackMessage', () => {
  it('construye mensaje con resumen sin credenciales', () => {
    const msg = buildSlackMessage({
      status: 'success',
      database: 'postgres',
      dbName: 'app',
      backupType: 'full',
      durationMs: 1234,
      sizeBytes: 2048,
      file: 'x.sql.gz',
      storage: 's3',
      storageKey: 'db/x.sql.gz',
    });
    expect(msg).toContain('postgres');
    expect(msg).toContain('full');
    expect(msg).toContain('s3');
    expect(msg).not.toMatch(/password|secret/i);
  });

  it('marca fallos con estado failed', () => {
    const msg = buildSlackMessage({ status: 'failed', database: 'mysql', dbName: 'x', error: 'boom' });
    expect(msg).toContain('FAILED');
    expect(msg).toContain('boom');
  });
});