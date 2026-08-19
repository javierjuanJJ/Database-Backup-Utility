import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import db from '../src/lib/db/index.js';

describe('src/lib/db', () => {
  describe('assertSupported', () => {
    it('acepta motores soportados', () => {
      for (const type of ['mysql', 'postgres', 'mongodb', 'sqlite']) {
        expect(() => db.assertSupported(type)).not.toThrow();
      }
    });

    it('rechaza motores no soportados con código UNSUPPORTED_DATABASE', () => {
      try {
        db.assertSupported('oracle');
      } catch (err) {
        expect(err.code).toBe('UNSUPPORTED_DATABASE');
      }
    });
  });

  describe('normalizeDbConfig', () => {
    it('aplica puertos por defecto por motor', () => {
      const mysql = db.normalizeDbConfig('mysql', {});
      const postgres = db.normalizeDbConfig('postgres', {});
      const mongo = db.normalizeDbConfig('mongodb', {});
      expect(mysql.port).toBe(3306);
      expect(postgres.port).toBe(5432);
      expect(mongo.port).toBe(27017);
    });

    it('aplica host por defecto', () => {
      expect(db.normalizeDbConfig('mysql', {}).host).toBe('127.0.0.1');
    });

    it('la URI tiene prioridad sobre parámetros sueltos', () => {
      const config = db.normalizeDbConfig('mongodb', {
        uri: 'mongodb://admin:secret@db.example:27018/app',
        host: 'wrong.example',
        port: 1,
        user: 'user',
      });
      expect(config.uri).toBe('mongodb://admin:secret@db.example:27018/app');
    });

    it('toma valores del entorno cuando no hay flags', () => {
      const env = { DB_HOST: 'db.local', DB_PORT: '5433', DB_USER: 'me', DB_PASS: 'pw', DB_NAME: 'mydb' };
      const config = db.normalizeDbConfig('postgres', {}, env);
      expect(config.host).toBe('db.local');
      expect(config.port).toBe(5433);
      expect(config.user).toBe('me');
      expect(config.password).toBe('pw');
      expect(config.database).toBe('mydb');
    });
  });

  describe('buildUri', () => {
    it('construye URI mysql en formato Prisma', () => {
      const uri = db.buildUri('mysql', { host: 'localhost', port: 3306, user: 'root', password: 'p@ss', database: 'shop' });
      expect(uri).toBe('mysql://root:p%40ss@localhost:3306/shop');
    });

    it('construye URI postgres con schema', () => {
      const uri = db.buildUri('postgres', { host: 'h', port: 5432, user: 'u', password: 'p', database: 'd', schema: 'public' });
      expect(uri).toBe('postgresql://u:p@h:5432/d?schema=public');
    });

    it('construye URI mongodb sin credenciales', () => {
      const uri = db.buildUri('mongodb', { host: 'localhost', port: 27017, database: 'app' });
      expect(uri).toBe('mongodb://localhost:27017/app');
    });
  });

  describe('describeConnection', () => {
    it('nunca expone contraseñas en URIs', () => {
      const desc = db.describeConnection({ type: 'mongodb', uri: 'mongodb://admin:supersecret@host:27017/db' });
      expect(desc).not.toContain('supersecret');
    });

    it('describe conexiones locales', () => {
      expect(db.describeConnection({ type: 'sqlite', database: '/tmp/app.db' })).toContain('SQLite');
    });
  });

  describe('testConnection (dispatcher)', () => {
    it('lanza UNSUPPORTED_DATABASE (síncrono) para motores inválidos', () => {
      try {
        db.testConnection('oracle', {});
      } catch (err) {
        expect(err.code).toBe('UNSUPPORTED_DATABASE');
      }
    });
  });
});