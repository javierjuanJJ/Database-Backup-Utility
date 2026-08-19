'use strict';

/**
 * Notificaciones Slack vía webhook usando el fetch global de Node.
 * El envío es best-effort: si falla se lanza AppError('NOTIFY_FAILED', ...)
 * y el servicio decide si abortar o continuar.
 */

const { AppError } = require('../errors');

const SEVERITY_EMOJI = {
  success: ':white_check_mark:',
  failed: ':x:',
  warn: ':warning:',
};

/**
 * Construye el texto plano del mensaje de Slack a partir de un resumen.
 * Nunca incluye credenciales.
 */
function buildSlackMessage(summary = {}) {
  const state = summary.status === 'success' ? 'success' : 'failed';
  const lines = [
    `${SEVERITY_EMOJI[state]} *Database Backup Utility*`,
    `• Base de datos: \`${summary.database || '?'}\` (\`${summary.dbName || '?'}\`)`,
    `• Tipo: ${summary.backupType || summary.operation || 'n/a'}`,
    `• Estado: ${state.toUpperCase()}`,
  ];
  if (summary.durationMs != null) lines.push(`• Duración: ${summary.durationMs}ms`);
  if (summary.sizeBytes != null) {
    const bytes = summary.sizeBytes;
    const mb = bytes / 1024 / 1024;
    lines.push(`• Tamaño: ${mb >= 1 ? mb.toFixed(2) + ' MB' : bytes + ' B'}`);
  }
  if (summary.file) lines.push(`• Archivo: \`${summary.file}\``);
  if (summary.storage && summary.storageKey) lines.push(`• Almacenado en: ${summary.storage} (\`${summary.storageKey}\`)`);
  if (summary.error) lines.push(`• Error: ${String(summary.error).slice(0, 300)}`);
  return lines.join('\n');
}

/**
 * Envía el mensaje al webhook de Slack. Resuelve { ok: true } en éxito.
 */
async function notifySlack(webhookUrl, summary) {
  if (!webhookUrl || !/^https:\/\//.test(webhookUrl)) {
    throw new AppError('NOTIFY_FAILED', 'Webhook de Slack inválido o ausente.', {
      detail: 'Use --slack-webhook o la variable de entorno SLACK_WEBHOOK_URL.',
    });
  }
  const text = buildSlackMessage(summary);
  let response;
  try {
    response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    throw new AppError('NOTIFY_FAILED', 'No se pudo contactar con el webhook de Slack.', {
      detail: err.message,
      cause: err,
    });
  }
  if (!response.ok) {
    throw new AppError('NOTIFY_FAILED', `Slack respondió con estado ${response.status}.`, {
      detail: await response.text().catch(() => ''),
    });
  }
  return { ok: true };
}

module.exports = Object.freeze({ buildSlackMessage, notifySlack });