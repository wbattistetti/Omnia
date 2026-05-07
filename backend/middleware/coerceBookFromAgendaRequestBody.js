'use strict';

const { coerceBookFromAgendaRequestBody } = require('../utils/openApiBodyCoerce');

/**
 * Normalizza i tipi JSON del body POST BookFromAgenda secondo `bookFromAgenda.openapi.json`
 * (es. `"true"` → `true`) prima di {@link normalizeBookFromAgendaIncomingBody} e del solver.
 */
function coerceBookFromAgendaRequestBodyMiddleware(req, res, next) {
  try {
    const b = req.body;
    if (b === undefined || b === null) return next();
    req.body = coerceBookFromAgendaRequestBody(b);
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  coerceBookFromAgendaRequestBodyMiddleware,
};
