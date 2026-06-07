/**
 * Schema V2 — log runtime invocazioni ConvAI → Express (omnia_dialog_step + gateway backend).
 */

'use strict';

/** @typedef {'omnia_dialog_step' | 'convai_webhook_gateway'} ConvaiRuntimeInvocationKind */

/** @readonly */
const SCHEMA_VERSION = 2;

/** @readonly */
const KIND = {
  OMNIA_DIALOG_STEP: 'omnia_dialog_step',
  CONVAI_WEBHOOK_GATEWAY: 'convai_webhook_gateway',
};

/** @readonly */
const DIALOG_STATUS = new Set(['ask', 'invalid', 'complete', 'error']);

module.exports = {
  SCHEMA_VERSION,
  KIND,
  DIALOG_STATUS,
};
