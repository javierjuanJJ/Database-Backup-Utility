import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  formatDuration,
  sanitizeFileName,
  buildBackupFileName,
  clockStamp,
  resolvePath,
} from '../src/utils/helpers.js';

describe('utils/helpers', () => {
  describe('formatBytes', () => {
    it('formatea bytes, KB, MB y GB', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(2048)).toMatch(/^2(\.\d+)? KB$/);
      expect(formatBytes(5 * 1024 * 1024)).toMatch(/MB$/);
      expect(formatBytes(3 * 1024 ** 3)).toMatch(/GB$/);
    });
  });

  describe('formatDuration', () => {
    it('formatea milisegundos, segundos y minutos', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(2500)).toMatch(/m|ms/);
      expect(formatDuration(90000)).toMatch(/m \d+s/);
    });
  });

  describe('sanitizeFileName', () => {
    it('reemplaza caracteres inseguros', () => {
      expect(sanitizeFileName('a/b:c*d')).toBe('a_b_c_d');
      expect(sanitizeFileName('my-db')).toBe('my-db');
    });
  });

  describe('buildBackupFileName', () => {
    it('construye nombre con motor, db, timestamp y extensión', () => {
      const name = buildBackupFileName({ database: 'mysql', dbName: 'app', backupType: 'full', stamp: '2026-01-01_00-00-00' });
      expect(name).toBe('mysql__app__2026-01-01_00-00-00.sql');
      const inc = buildBackupFileName({ database: 'postgres', dbName: 'app', backupType: 'differential', stamp: '2026-01-01' });
      expect(inc).toContain('.differential.sql');
    });
  });

  describe('clockStamp', () => {
    it('genera formato YYYY-MM-DD_HH-mm-ss', () => {
      expect(clockStamp(new Date(2026, 7, 19, 12, 30, 5))).toBe('2026-08-19_12-30-05');
    });
  });

  describe('resolvePath', () => {
    it('expande ~ y normaliza rutas', () => {
      const abs = resolvePath('./foo');
      expect(abs.startsWith('/') || /^[A-Za-z]:/.test(abs)).toBe(true);
      expect(abs.endsWith('/foo')).toBe(true);
    });
  });
});