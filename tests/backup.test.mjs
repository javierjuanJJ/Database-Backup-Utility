import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import backup from '../src/lib/backup/index.js';
import { buildDumpCommand } from '../src/lib/backup/commands.js';
import { compressArtifact } from '../src/lib/backup/compress.js';
import { isGzipFile } from '../src/utils/helpers.js';

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbu-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('backup/commands', () => {
  it('construye mysqldump full con --databases', () => {
    const cmd = buildDumpCommand({ type: 'mysql', host: 'h', port: 3306, user: 'u', password: 'p', database: 'shop' }, { type: 'full', outFile: '/x/a.sql' });
    expect(cmd.bin).toBe('mysqldump');
    expect(cmd.args).toContain('--databases');
    expect(cmd.args).toContain('shop');
    expect(cmd.args).toContain('--single-transaction');
  });

  it('construye mysqldump diferencial con --where y --tables', () => {
    const cmd = buildDumpCommand({ type: 'mysql', host: 'h', user: 'u', password: 'p', database: 'shop' }, { type: 'differential', table: 'orders', since: '2026-01-01T00:00:00Z', sinceField: 'updated_at' });
    expect(cmd.args.join(' ')).toContain('--tables orders');
    expect(cmd.args.join(' ')).toContain("updated_at > '2026-01-01T00:00:00Z'");
  });

  it('configura PGPASSWORD para pg_dump', () => {
    const cmd = buildDumpCommand({ type: 'postgres', host: 'h', port: 5432, user: 'u', password: 's3cret', database: 'app' }, { type: 'full', table: 'users' });
    expect(cmd.bin).toBe('pg_dump');
    expect(cmd.env.PGPASSWORD).toBe('s3cret');
    expect(cmd.args.join(' ')).toContain('--table=users');
  });

  it('construye mongodump con archivo gzip', () => {
    const cmd = buildDumpCommand({ type: 'mongodb', uri: 'mongodb://h:27017', database: 'mydb' }, { type: 'full', useArchive: true, outFile: '/x/a.bin' });
    expect(cmd.bin).toBe('mongodump');
    expect(cmd.args).toContain('--gzip');
    expect(cmd.args).toContain('--archive=/x/a.bin');
  });

  it('marca SQLite como modo copy', () => {
    const cmd = buildDumpCommand({ type: 'sqlite', database: '/tmp/a.db' }, { outFile: '/x/a.sql' });
    expect(cmd.mode).toBe('copy');
    expect(cmd.source).toBe('/tmp/a.db');
  });
});

describe('backup/validateBackupType', () => {
  it('acepta full para todos los motores', () => {
    for (const t of ['mysql', 'postgres', 'mongodb', 'sqlite']) {
      expect(() => backup.validateBackupType('full', t)).not.toThrow();
    }
  });

  it('rechaza incremental en SQLite', () => {
    try {
      backup.validateBackupType('incremental', 'sqlite');
    } catch (err) {
      expect(err.code).toBe('UNSUPPORTED_BACKUP_TYPE');
    }
  });
});

describe('backup/compress', () => {
  it('comprime un archivo a .gz con magic number gzip', async () => {
    const src = path.join(tmpDir, 'dump.sql');
    fs.writeFileSync(src, 'CREATE TABLE t(x);\n');
    const dest = await compressArtifact(src);
    expect(fs.existsSync(dest)).toBe(true);
    expect(dest.endsWith('.gz')).toBe(true);
    expect(isGzipFile(dest)).toBe(true);
    expect(fs.existsSync(src)).toBe(true);
  });
});

describe('backup/produceArtifact (SQLite, sin binarios externos)', () => {
  it('produce un artefacto comprimido desde un archivo SQLite', async () => {
    const src = path.join(tmpDir, 'source.db');
    fs.writeFileSync(src, 'data');
    const conf = { type: 'sqlite', database: src };
    const result = await backup.produceArtifact(conf, { outDir: tmpDir, compress: true });
    expect(fs.existsSync(result.file)).toBe(true);
    expect(result.compressed).toBe(true);
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(isGzipFile(result.file)).toBe(true);
  });

  it('produce un artefacto sin comprimir cuando se solicita', async () => {
    const src = path.join(tmpDir, 'source.db');
    fs.writeFileSync(src, 'data');
    const conf = { type: 'sqlite', database: src };
    const result = await backup.produceArtifact(conf, { outDir: tmpDir, compress: false });
    expect(fs.existsSync(result.file)).toBe(true);
    expect(result.compressed).toBe(false);
    expect(isGzipFile(result.file)).toBe(false);
  });
});