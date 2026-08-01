// Thin wrapper around the Meta WhatsApp Cloud API (Graph API) for sending messages.
const axios = require("axios");

const GRAPH_VERSION = "v20.0";

function client() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneNumberId || !token) {
    throw new Error(
      "Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_TOKEN — set them in .env (see .env.example)."
    );
  }
  return axios.create({
    baseURL: `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}`,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    timeout: 15000,
  });
}

/** Send a plain text message to a WhatsApp user. */
async function sendText(to, body) {
  try {
    await client().post("/messages", {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body, preview_url: false },
    });
  } catch (err) {
    logSendError(to, err);
  }
}

/**
 * Send an interactive reply-buttons message (max 3 buttons, each title <= 20 chars).
 * buttons: [{ id: 'BOOK_TRIAL', title: 'Book a trial' }, ...]
 */
async function sendButtons(to, bodyText, buttons) {
  try {
    await client().post("/messages", {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.slice(0, 3).map((b) => ({
            type: "reply",
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      },
    });
  } catch (err) {
    logSendError(to, err);
  }
}

/**
 * Send an image by public URL, with an optional caption.
 * WhatsApp fetches the image from imageUrl itself — it must be publicly reachable
 * (no auth), which is true for the artisticrubans.com uploads used in the seed data.
 */
async function sendImage(to, imageUrl, caption) {
  if (!imageUrl) return;
  try {
    await client().post("/messages", {
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link: imageUrl, caption },
    });
  } catch (err) {
    logSendError(to, err);
  }
}

/** Mark an inbound message as read (optional, but nice UX). */
async function markRead(messageId) {
  try {
    await client().post("/messages", {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    });
  } catch (err) {
    // Non-critical — don't let a failed read-receipt break the flow.
    console.warn("markRead failed:", err.response?.data || err.message);
  }
}

function logSendError(to, err) {
  console.error(
    `Failed to send WhatsApp message to ${to}:`,
    err.response?.data ? JSON.stringify(err.response.data) : err.message
  );
}

module.exports = { sendText, sendButtons, sendImage, markRead };
