require("dotenv").config();
const express = require("express");
const webhookRouter = require("./routes/webhook");

// Make sure the DB + schema are initialised even if nothing else touches it yet.
require("./db");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send(`${process.env.SCHOOL_NAME || "Art School"} WhatsApp bot is running.`);
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/", webhookRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Art school WhatsApp bot listening on port ${port}`);
});
