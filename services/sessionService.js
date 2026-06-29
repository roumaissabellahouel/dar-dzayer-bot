const sessions = new Map();

function getSession(telephone) {
  return sessions.get(telephone) || null;
}

function setSession(telephone, data) {
  sessions.set(telephone, data);
}

function clearSession(telephone) {
  sessions.delete(telephone);
}

module.exports = { getSession, setSession, clearSession };
