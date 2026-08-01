// Local smoke test: exercises the conversation flow engine without hitting the
// real WhatsApp API (mocks sendText/sendButtons to print to console instead).
require("dotenv").config();

const wa = require("./src/utils/whatsapp");
wa.sendText = async (to, body) => console.log(`\n[TEXT -> ${to}]\n${body}`);
wa.sendButtons = async (to, body, buttons) =>
  console.log(`\n[BUTTONS -> ${to}]\n${body}\n(buttons: ${buttons.map((b) => b.title).join(" | ")})`);
wa.sendImage = async (to, imageUrl, caption) =>
  console.log(`\n[IMAGE -> ${to}] ${imageUrl} (caption: ${caption})`);

const { handleIncomingMessage } = require("./src/flows");

async function run() {
  const guest = "911111111111";
  const student = "919999999999"; // matches seeded demo student

  console.log("=== Guest says hi ===");
  await handleIncomingMessage(guest, { text: "hi", contactName: "Test Guest" });

  console.log("\n=== Guest taps 'Courses & Fees' ===");
  await handleIncomingMessage(guest, { buttonId: "MENU_ADMISSIONS" });

  console.log("\n=== Guest picks course 2 ===");
  await handleIncomingMessage(guest, { text: "2" });

  console.log("\n=== Guest taps 'Book a trial' ===");
  await handleIncomingMessage(guest, { buttonId: "MENU_BOOK" });

  console.log("\n=== Guest picks course 1 ===");
  await handleIncomingMessage(guest, { text: "1" });

  console.log("\n=== Guest picks slot 1 ===");
  await handleIncomingMessage(guest, { text: "1" });

  console.log("\n=== Guest gives name ===");
  await handleIncomingMessage(guest, { text: "Ravi Kumar" });

  console.log("\n=== Enrolled student says hi, checks their menu ===");
  await handleIncomingMessage(student, { text: "hi", contactName: "Aanya" });
  await handleIncomingMessage(student, { buttonId: "MENU_STUDENT" });

  console.log("\n=== Student checks timetable ===");
  await handleIncomingMessage(student, { buttonId: "STUDENT_TIMETABLE" });

  console.log("\n=== Student checks fees ===");
  await handleIncomingMessage(student, { buttonId: "STUDENT_FEES" });

  console.log("\n=== Guest asks for a human ===");
  await handleIncomingMessage(guest, { text: "menu" });
  await handleIncomingMessage(guest, { buttonId: "MENU_MORE" });
  await handleIncomingMessage(guest, { buttonId: "MENU_HUMAN" });

  console.log("\n=== Guest tries to chat further while handed off ===");
  await handleIncomingMessage(guest, { text: "are you there" });

  console.log("\n=== Guest types menu to resume bot ===");
  await handleIncomingMessage(guest, { text: "menu" });

  console.log("\n\n✅ Flow test finished without throwing.");
}

run().catch((err) => {
  console.error("❌ Flow test failed:", err);
  process.exit(1);
});
