import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import storage from '../src/lib/storage/index.js';

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbu-storage-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('storage/resolveStorageKind', () => {
  it('acepta local/s3/gcs/azure', () => {
    for (const k of ['local', 's3', 'gcs', 'azure']) {
      expect(storage.resolveStorageKind(k)).toBe(k);
    }
  });

  it('lanza STORAGE_UNSUPPORTED para tipos inválidos', () => {
    try {
      storage.resolveStorageKind('ftp');
    } catch (err) {
      expect(err.code).toBe('STORAGE_UNSUPPORTED');
    }
  });
});

describe('storage/buildStorageConfig', () => {
  it('configura local con directorio por defecto', () => {
    const cfg = storage.buildStorageConfig('local', {});
    expect(cfg.kind).toBe('local');
    expect(cfg.directory).toBeTruthy();
  });

  it('lee S3 desde el entorno', () => {
    const env = {
      AWS_ACCESS_KEY_ID: 'AKIA',
      AWS_SECRET_ACCESS_KEY: 'sk',
      AWS_REGION: 'eu-west-1',
      S3_BUCKET: 'bkt',
      S3_PREFIX: 'db/',
    };
    const cfg = storage.buildStorageConfig('s3', {}, env);
    expect(cfg.bucket).toBe('bkt');
    expect(cfg.accessKeyId).toBe('AKIA');
    expect(cfg.prefix).toBe('db/');
    expect(cfg.region).toBe('eu-west-1');
  });

  it('GCS usa keyFile y bucket', () => {
    const env = { GCS_BUCKET: 'g', GCS_KEY_FILE: '/tmp/key.json' };
    const cfg = storage.buildStorageConfig('gcs', {}, env);
    expect(cfg.bucket).toBe('g');
    expect(cfg.keyFile).toBe('/tmp/key.json');
  });

  it('Azure usa connectionString y container', () => {
    const env = { AZURE_STORAGE_CONNECTION_STRING: 'BlobEndpoint=...', AZURE_CONTAINER: 'c' };
    const cfg = storage.buildStorageConfig('azure', {}, env);
    expect(cfg.container).toBe('c');
    expect(cfg.connectionString).toBe('BlobEndpoint=...');
  });

  it('detecta credenciales de nube ausentes', () => {
    expect(() => storage.assertCredentials({ kind: 's3', bucket: 'b' })).toThrowError(
      expect.objectContaining({ code: 'MISSING_STORAGE_CREDENTIALS' })
    );
  });
});

describe('storage/buildKey', () => {
  it('aplica el prefijo al nombre del archivo', () => {
    const key = storage.buildKey({ prefix: 'prod/db-backups/' }, 'mysql__app__x.sql.gz');
    expect(key).toBe('prod/db-backups/mysql__app__x.sql.gz');
  });

  it('sin prefijo devuelve el nombre (eliminando barra inicial)', () => {
    expect(storage.buildKey({ prefix: '' }, 'file.gz')).toBe('file.gz');
    expect(storage.buildKey({ prefix: '' }, '/a/b/file.gz')).toBe('a/b/file.gz');
  });
});

describe('storage/local', () => {
  it('store + list + fetch funcionan en un directorio temporal', async () => {
    const src = path.join(tmpDir, 'artifact.sql.gz');
    fs.writeFileSync(src, 'data');
    const store = storage.getStore('local', { outDir: tmpDir });

    const uploaded = await store.store(src, 'artifact.sql.gz');
    expect(uploaded.key).toBe('artifact.sql.gz');

    const items = await store.list();
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.key === 'artifact.sql.gz')).toBe(true);

    const dest = path.join(tmpDir, 'restored.sql.gz');
    await store.fetch('artifact.sql.gz', dest);
    expect(fs.readFileSync(dest, 'utf8')).toBe('data');
  });
});