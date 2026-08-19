'use strict';

/**
 * Validador opcional de conexión basado en Prisma.
 *
 * Referencia del formato de URLs documentado por Prisma (ver prisma/schema.prisma):
 *   postgresql://user:pass@host:port/db?schema=public
 *   mysql://user:pass@host:port/db
 *
 * No es obligatorio para el flujo principal (los conectores nativos de src/lib/db
 * son los usados por el pipeline de backup/restore), pero permite validar conexiones
 * relacionales cuando la aplicación dispone de una DATABASE_URL compatible.
 */

const { AppError } = require('../errors');

async function testConnection(url, provider) {
  if (!url) {
    throw new AppError('INVALID_ARGUMENTS', 'testConnectionConPrisma requiere una URL de conexión (DATABASE_URL).', {
      detail: 'url y provider son obligatorios',
    });
  }
  let prisma;
  try {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient({
      datasources: { db: { url } },
    });
    await prisma.$connect();
  } catch (err) {
    throw new AppError('CONNECTION_FAILED', `No se pudo validar la conexión con Prisma (${provider}).`, {
      detail: err.message,
      cause: err,
    });
  } finally {
    if (prisma) {
      try {
        await prisma.$disconnect();
      } catch {
        /* cerrar de forma segura */
      }
    }
  }
  return { ok: true, provider };
}

module.exports = Object.freeze({ testConnection });