const express = require("express");
const { handleIncomingMessage } = require("../flows");
const { markRead } = require("../utils/whatsapp");

const router = express.Router();

// --- Webhook verification (Meta calls this once when you save the webhook config) ---
router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("Webhook verified.");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// --- Incoming messages / status updates ---
router.post("/webhook", async (req, res) => {
  // Always ack quickly so Meta doesn't retry/backoff on us.
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const messages = change?.messages;
    if (!messages || messages.length === 0) return; // e.g. a delivery/read status update

    const contact = change.contacts?.[0];
    const contactName = contact?.profile?.name;

    for (const msg of messages) {
      const phone = msg.from; // e.g. "919876543210"
      markRead(msg.id).catch(() => {});

      let text = null;
      let buttonId = null;

      if (msg.type === "text") {
        text = msg.text?.body;
      } else if (msg.type === "interactive") {
        if (msg.interactive?.type === "button_reply") {
          buttonId = msg.interactive.button_reply.id;
          text = msg.interactive.button_reply.title;
        } else if (msg.interactive?.type === "list_reply") {
          buttonId = msg.interactive.list_reply.id;
          text = msg.interactive.list_reply.title;
        }
      } else {
        // Unsupported message type (image, audio, location, etc.)
        text = "";
      }

      await handleIncomingMessage(phone, { text, buttonId, contactName });
    }
  } catch (err) {
    console.error("Error handling webhook payload:", err);
  }
});

module.exports = router;
