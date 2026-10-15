/**
 * Structured Logger for Darkgrid RPG
 * Produces compact, Cloud Logging-compatible structured logs in production
 * while avoiding noisy log volume to keep Cloud Logging costs at 0 ISK.
 */

const config = require('../config');

const recentSecurityLogs = [];
const MAX_RECENT_LOGS = 200;

function formatEntry(severity, eventType, message, meta = {}) {
  const entry = {
    severity,
    eventType,
    message,
    timestamp: new Date().toISOString(),
    ...meta
  };

  if (severity === 'WARNING' || severity === 'ERROR' || severity === 'CRITICAL' || eventType.startsWith('SECURITY_')) {
    recentSecurityLogs.push(entry);
    if (recentSecurityLogs.length > MAX_RECENT_LOGS) {
      recentSecurityLogs.shift();
    }
  }

  return entry;
}

function logInfo(eventType, message, meta = {}) {
  const entry = formatEntry('INFO', eventType, message, meta);
  if (config.nodeEnv === 'production') {
    console.log(JSON.stringify(entry));
  } else if (config.nodeEnv !== 'test') {
    console.log(`[INFO][${eventType}] ${message}`);
  }
  return entry;
}

function logSecurity(eventType, message, meta = {}) {
  const normalizedType = eventType.startsWith('SECURITY_') ? eventType : `SECURITY_${eventType}`;
  const entry = formatEntry('WARNING', normalizedType, message, meta);
  if (config.nodeEnv === 'production') {
    console.warn(JSON.stringify(entry));
  } else {
    console.warn(`[Security][${normalizedType}] ${message}`, Object.keys(meta).length ? meta : '');
  }
  return entry;
}

function logError(eventType, message, error = null, meta = {}) {
  const errMeta = error ? {
    errorName: error.name,
    errorMessage: error.message,
    status: error.status || 500
  } : {};
  const entry = formatEntry('ERROR', eventType, message, { ...errMeta, ...meta });
  if (config.nodeEnv === 'production') {
    console.error(JSON.stringify(entry));
  } else {
    console.error(`[Error][${eventType}] ${message}`, error || '');
  }
  return entry;
}

function getRecentSecurityLogs() {
  return [...recentSecurityLogs];
}

function clearRecentSecurityLogs() {
  recentSecurityLogs.length = 0;
}

module.exports = {
  logInfo,
  logSecurity,
  logError,
  getRecentSecurityLogs,
  clearRecentSecurityLogs
};
