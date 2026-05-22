/**
 * Notifiche push in-process per canale review (SSE verso Omnia + webhook portale esterno).
 * Chiave: projectId + taskInstanceId.
 */

/** @type {Map<string, Set<import('http').ServerResponse>>} */
const subscribersByKey = new Map();

function channelKey(projectId, taskInstanceId) {
  return `${String(projectId || '').trim()}:${String(taskInstanceId || '').trim()}`;
}

/**
 * @param {string} projectId
 * @param {string} taskInstanceId
 * @param {{ audience?: string, updatedAt?: string, contentHash?: string, source?: string }} payload
 */
function publishReviewChannelEvent(projectId, taskInstanceId, payload = {}) {
  const key = channelKey(projectId, taskInstanceId);
  const set = subscribersByKey.get(key);
  if (!set || set.size === 0) return;
  const data = JSON.stringify({
    type: 'review_channel_updated',
    projectId,
    taskInstanceId,
    at: new Date().toISOString(),
    ...payload,
  });
  for (const res of set) {
    try {
      res.write(`event: review_channel_updated\n`);
      res.write(`data: ${data}\n\n`);
    } catch {
      set.delete(res);
    }
  }
}

/**
 * @param {string} projectId
 * @param {string} taskInstanceId
 * @param {import('http').ServerResponse} res
 */
function subscribeReviewChannelSse(projectId, taskInstanceId, res) {
  const key = channelKey(projectId, taskInstanceId);
  let set = subscribersByKey.get(key);
  if (!set) {
    set = new Set();
    subscribersByKey.set(key, set);
  }
  set.add(res);
  res.write(': connected\n\n');
}

/**
 * @param {import('http').ServerResponse} res
 */
function unsubscribeReviewChannelSse(res) {
  for (const set of subscribersByKey.values()) {
    set.delete(res);
  }
}

module.exports = {
  publishReviewChannelEvent,
  subscribeReviewChannelSse,
  unsubscribeReviewChannelSse,
};
