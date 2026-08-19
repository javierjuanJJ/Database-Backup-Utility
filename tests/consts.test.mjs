import { describe, it, expect } from 'vitest';
import CONSTS from '../src/consts/index.js';

describe('src/consts', () => {
  it('expone motores, almacenamiento y tipos de backup soportados', () => {
    expect(CONSTS.SUPPORTED_DATABASES).toEqual(['mysql', 'postgres', 'mongodb', 'sqlite']);
    expect(CONSTS.STORAGE_TYPES).toEqual(['local', 's3', 'gcs', 'azure']);
    expect(CONSTS.BACKUP_TYPES).toEqual(['full', 'incremental', 'differential']);
  });

  it('todo código de error tiene sugerencia de solución', () => {
    for (const entry of Object.values(CONSTS.ERROR_CATALOG)) {
      expect(entry.message).toBeTruthy();
      expect(entry.solution).toBeTruthy();
    }
  });

  it('define códigos de salida OK y FAILURE', () => {
    expect(CONSTS.EXIT_CODES.OK).toBe(0);
    expect(CONSTS.EXIT_CODES.FAILURE).toBe(1);
  });
});