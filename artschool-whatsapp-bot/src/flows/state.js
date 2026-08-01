// Loads/saves the per-user conversation state + context used by the flow engine.
const db = require("../db");

const getRow = db.prepare("SELECT * FROM conversations WHERE phone = ?");
const insertRow = db.prepare(
  "INSERT INTO conversations (phone, state, context, needs_human) VALUES (?, 'MAIN_MENU', '{}', 0)"
);
const updateRow = db.prepare(
  "UPDATE conversations SET state = ?, context = ?, needs_human = ?, updated_at = datetime('now') WHERE phone = ?"
);

function getConversation(phone) {
  let row = getRow.get(phone);
  if (!row) {
    insertRow.run(phone);
    row = getRow.get(phone);
  }
  return {
    phone: row.phone,
    state: row.state,
    context: JSON.parse(row.context || "{}"),
    needsHuman: !!row.needs_human,
  };
}

function saveConversation(phone, { state, context, needsHuman }) {
  updateRow.run(state, JSON.stringify(context || {}), needsHuman ? 1 : 0, phone);
}

module.exports = { getConversation, saveConversation };
