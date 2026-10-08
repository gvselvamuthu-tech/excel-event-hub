const locks = new Map();

function withWorkbookLock(key, operation) {
  const previous = locks.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  locks.set(key, queued);

  return previous.then(operation).finally(() => {
    release();
    if (locks.get(key) === queued) locks.delete(key);
  });
}

module.exports = { withWorkbookLock };
