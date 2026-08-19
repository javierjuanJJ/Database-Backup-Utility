import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { buildRestoreCommand } from '../src/lib/restore/commands.js';
import restore from '../src/lib/restore/index.js';
import { resolveSource, stagingDir } from '../src/services/restore.js';
import { runProcess } from '../src/utils/helpers.js';

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbu-restore-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function gzipData(file, content) {
  fs.writeFileSync(file, zlib.gzipSync(Buffer.from(content)));
  return file;
}

describe('restore/commands', () => {
  it('construye restauración MySQL por stdin', () => {
    const cmd = buildRestoreCommand({ type: 'mysql', host: 'h', port: 3306, user: 'u', password: 'p', database: 'shop' }, {}, '/tmp/x.sql');
    expect(cmd.bin).toBe('mysql');
    expect(cmd.mode).toBe('stdin');
    expect(cmd.inputFile).toBe('/tmp/x.sql');
    expect(cmd.args).toContain('shop');
  });

  it('construye restauración PostgreSQL con PGPASSWORD y --file', () => {
    const cmd = buildRestoreCommand({ type: 'postgres', host: 'h', port: 5432, user: 'u', password: 's3c', database: 'app' }, {}, '/tmp/x.sql');
    expect(cmd.bin).toBe('psql');
    expect(cmd.env.PGPASSWORD).toBe('s3c');
    expect(cmd.args.join(' ')).toContain('--file=/tmp/x.sql');
  });

  it('construye mongorestore selectivo con --nsInclude', () => {
    const cmd = buildRestoreCommand({ type: 'mongodb', uri: 'mongodb://h:27017', database: 'app' }, { collection: 'orders', archive: true }, '/tmp/a.bin');
    expect(cmd.bin).toBe('mongorestore');
    expect(cmd.args).toContain('--gzip');
    expect(cmd.args).toContain('--drop');
    expect(cmd.args).toContain('--nsInclude=app.orders');
    expect(cmd.args.join(' ')).toContain('--archive=/tmp/a.bin');
  });

  it('construye copia para SQLite', () => {
    const cmd = buildRestoreCommand({ type: 'sqlite', database: '/dest/app.db' }, {}, '/tmp/x.db');
    expect(cmd.mode).toBe('copy');
    expect(cmd.target).toBe('/dest/app.db');
  });
});

describe('runProcess inputFile', () => {
  it('alimenta stdin con el contenido de un archivo', async () => {
    const file = path.join(tmpDir, 'data.txt');
    fs.writeFileSync(file, 'hello-stdin');
    const { stdout } = await runProcess('cat', [], { inputFile: file });
    expect(stdout).toContain('hello-stdin');
  });
});

describe('restore/runRestore (SQLite, sin binarios externos)', () => {
  it('restaura un archivo gzip al destino SQLite', async () => {
    const gz = gzipData(path.join(tmpDir, 'dump.db.gz'), 'sqlite-content');
    const target = path.join(tmpDir, 'restored', 'app.db');
    const result = await restore.runRestore({ type: 'sqlite', database: target }, {}, gz);
    expect(result.mode).toBe('copy');
    expect(result.target).toBe(target);
    expect(fs.readFileSync(target, 'utf8')).toBe('sqlite-content');
  });
});

describe('services/restore resolveSource', () => {
  it('resuelve una ruta local existente', async () => {
    const f = path.join(tmpDir, 'x.gz');
    fs.writeFileSync(f, 'data');
    const r = await resolveSource(f, {});
    expect(r.kind).toBe('local');
    expect(r.file).toBe(f);
  });

  it('resuelve local:// e indica archivo inexistente', async () => {
    const missing = path.join(tmpDir, 'no.db');
    try {
      await resolveSource(`local://${missing}`, {});
    } catch (err) {
      expect(err.code).toBe('FILE_NOT_FOUND');
    }
  });

  it('genera directorios de staging temporales', () => {
    const dir = stagingDir();
    expect(fs.existsSync(dir)).toBe(true);
  });
});