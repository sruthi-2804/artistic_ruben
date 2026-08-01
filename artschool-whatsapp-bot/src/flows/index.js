// Conversation flow engine: given an inbound WhatsApp message, decides what to
// send back, using a simple per-phone-number state machine stored in SQLite.
const db = require("../db");
const { sendText, sendButtons, sendImage } = require("../utils/whatsapp");
const { getConversation, saveConversation } = require("./state");

const SCHOOL_NAME = process.env.SCHOOL_NAME || "the art school";

// ---------- shared queries ----------
const listActiveCourses = db.prepare("SELECT * FROM courses WHERE active = 1 ORDER BY id");
const getCourse = db.prepare("SELECT * FROM courses WHERE id = ?");
const listSlotsForCourse = db.prepare(
  "SELECT * FROM trial_slots WHERE course_id = ? AND active = 1 AND booked_count < capacity ORDER BY id"
);
const getSlot = db.prepare("SELECT * FROM trial_slots WHERE id = ?");
const bumpSlotBooking = db.prepare("UPDATE trial_slots SET booked_count = booked_count + 1 WHERE id = ?");
const insertBooking = db.prepare(
  "INSERT INTO bookings (name, phone, course_id, slot_id) VALUES (?, ?, ?, ?)"
);
const findStudentByPhone = db.prepare("SELECT * FROM students WHERE phone = ? AND status = 'active'");
const listScheduleForCourse = db.prepare(
  "SELECT * FROM class_schedule WHERE course_id = ? ORDER BY id"
);
const listUnpaidFees = db.prepare(
  "SELECT * FROM fee_reminders WHERE student_id = ? AND paid = 0 ORDER BY due_date"
);
const insertStaffAlert = db.prepare(
  "INSERT INTO staff_alerts (phone, name, message) VALUES (?, ?, ?)"
);

// ---------- helpers ----------
function courseLine(c, i) {
  return `${i + 1}. *${c.name}* (${c.age_group})\n   ${c.fee_text} · ${c.duration_text}`;
}

async function notifyStaff(phone, name, message) {
  const numbers = (process.env.STAFF_NOTIFY_NUMBERS || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  const text = `🔔 WhatsApp bot handoff\nFrom: ${name || "Unknown"} (${phone})\nMessage: ${message || "(asked for a human)"}\n\nReply to them directly on WhatsApp.`;
  await Promise.all(numbers.map((n) => sendText(n, text)));
}

async function sendMainMenu(phone) {
  await sendButtons(
    phone,
    `👋 Welcome to *${SCHOOL_NAME}*! How can I help you today?`,
    [
      { id: "MENU_ADMISSIONS", title: "Courses & Fees" },
      { id: "MENU_BOOK", title: "Book a trial class" },
      { id: "MENU_MORE", title: "More options" },
    ]
  );
}

async function sendMoreMenu(phone) {
  await sendButtons(phone, "A couple more options:", [
    { id: "MENU_STUDENT", title: "My classes / fees" },
    { id: "MENU_HUMAN", title: "Talk to a staff member" },
    { id: "MENU_MAIN", title: "⬅ Main menu" },
  ]);
}

// ---------- main entry point ----------
async function handleIncomingMessage(phone, { text, buttonId, contactName }) {
  const convo = getConversation(phone);
  const raw = (text || "").trim();
  const lower = raw.toLowerCase();
  const action = buttonId || raw; // interactive button id takes priority over typed text

  // Global resets, available from any state
  if (["hi", "hello", "hey", "menu", "start", "0", "MENU_MAIN"].includes(lower) || action === "MENU_MAIN") {
    convo.state = "MAIN_MENU";
    convo.context = {};
    convo.needsHuman = false;
    saveConversation(phone, convo);
    await sendMainMenu(phone);
    return;
  }

  if (convo.needsHuman) {
    // A staff member has been notified; keep the bot quiet on this thread except
    // for letting the user get back to the menu, so we don't talk over a human.
    if (lower === "menu") {
      convo.needsHuman = false;
      convo.state = "MAIN_MENU";
      saveConversation(phone, convo);
      await sendMainMenu(phone);
    } else {
      await sendText(
        phone,
        "A staff member has been notified and will reply here shortly. Type *menu* any time to use the bot again."
      );
    }
    return;
  }

  switch (convo.state) {
    case "MAIN_MENU":
      await routeMainMenu(phone, convo, action);
      break;
    case "ADMISSIONS_LIST":
      await routeAdmissionsList(phone, convo, action);
      break;
    case "ADMISSIONS_DETAIL":
      await routeAdmissionsDetail(phone, convo, action);
      break;
    case "BOOK_SELECT_COURSE":
      await routeBookSelectCourse(phone, convo, action);
      break;
    case "BOOK_SELECT_SLOT":
      await routeBookSelectSlot(phone, convo, action);
      break;
    case "BOOK_ASK_NAME":
      await routeBookAskName(phone, convo, raw, contactName);
      break;
    case "STUDENT_MENU":
      await routeStudentMenu(phone, convo, action);
      break;
    default:
      convo.state = "MAIN_MENU";
      saveConversation(phone, convo);
      await sendMainMenu(phone);
  }
}

// ---------- MAIN_MENU ----------
async function routeMainMenu(phone, convo, action) {
  if (action === "MENU_ADMISSIONS" || action === "1") return showAdmissionsList(phone, convo);
  if (action === "MENU_BOOK" || action === "2") return startBooking(phone, convo);
  if (action === "MENU_MORE" || action === "3") return sendMoreMenu(phone);
  if (action === "MENU_STUDENT") return showStudentMenu(phone, convo);
  if (action === "MENU_HUMAN") return escalateToHuman(phone, convo);
  await sendMainMenu(phone);
}

// ---------- Admissions / course info ----------
async function showAdmissionsList(phone, convo) {
  const courses = listActiveCourses.all();
  const lines = courses.map(courseLine).join("\n\n");
  convo.state = "ADMISSIONS_LIST";
  convo.context = { courseIds: courses.map((c) => c.id) };
  saveConversation(phone, convo);
  await sendText(
    phone,
    `🎨 *Courses at ${SCHOOL_NAME}*\n\n${lines}\n\nReply with a number to see details, or *menu* to go back.`
  );
}

async function routeAdmissionsList(phone, convo, action) {
  const idx = parseInt(action, 10) - 1;
  const courseId = convo.context.courseIds?.[idx];
  if (!courseId) {
    await sendText(phone, "Please reply with one of the course numbers above, or type *menu*.");
    return;
  }
  const course = getCourse.get(courseId);
  convo.state = "ADMISSIONS_DETAIL";
  convo.context = { courseId };
  saveConversation(phone, convo);
  const schedule = listScheduleForCourse
    .all(courseId)
    .map((s) => `• ${s.day_of_week}, ${s.time_label} (${s.room})`)
    .join("\n") || "Contact us for current timings.";
  if (course.image_url) {
    await sendImage(phone, course.image_url, course.name);
  }
  await sendButtons(
    phone,
    `*${course.name}*\n${course.description}\n\n💰 ${course.fee_text}\n🗓 ${course.duration_text}\n📍 ${course.mode_text}\n\nRegular class times:\n${schedule}`,
    [
      { id: "MENU_BOOK", title: "Book a trial" },
      { id: "MENU_ADMISSIONS", title: "⬅ All courses" },
      { id: "MENU_MAIN", title: "⬅ Main menu" },
    ]
  );
}

async function routeAdmissionsDetail(phone, convo, action) {
  if (action === "MENU_BOOK") return startBooking(phone, convo);
  if (action === "MENU_ADMISSIONS") return showAdmissionsList(phone, convo);
  convo.state = "MAIN_MENU";
  saveConversation(phone, convo);
  await sendMainMenu(phone);
}

// ---------- Trial booking ----------
async function startBooking(phone, convo) {
  const courses = listActiveCourses.all();
  const lines = courses.map(courseLine).join("\n\n");
  convo.state = "BOOK_SELECT_COURSE";
  convo.context = { courseIds: courses.map((c) => c.id) };
  saveConversation(phone, convo);
  await sendText(
    phone,
    `Great! Which course would you like to try?\n\n${lines}\n\nReply with a number, or *menu* to cancel.`
  );
}

async function routeBookSelectCourse(phone, convo, action) {
  const idx = parseInt(action, 10) - 1;
  const courseId = convo.context.courseIds?.[idx];
  if (!courseId) {
    await sendText(phone, "Please reply with one of the course numbers above, or type *menu*.");
    return;
  }
  const slots = listSlotsForCourse.all(courseId);
  if (slots.length === 0) {
    await sendText(
      phone,
      "Sorry, there are no open trial slots for that course right now. Type *menu* and choose 'Talk to a staff member' and we'll help you find a time."
    );
    convo.state = "MAIN_MENU";
    convo.context = {};
    saveConversation(phone, convo);
    return;
  }
  const lines = slots.map((s, i) => `${i + 1}. ${s.label} (${s.capacity - s.booked_count} spots left)`).join("\n");
  convo.state = "BOOK_SELECT_SLOT";
  convo.context = { courseId, slotIds: slots.map((s) => s.id) };
  saveConversation(phone, convo);
  await sendText(phone, `Available trial slots:\n\n${lines}\n\nReply with a number, or *menu* to cancel.`);
}

async function routeBookSelectSlot(phone, convo, action) {
  const idx = parseInt(action, 10) - 1;
  const slotId = convo.context.slotIds?.[idx];
  if (!slotId) {
    await sendText(phone, "Please reply with one of the slot numbers above, or type *menu*.");
    return;
  }
  convo.state = "BOOK_ASK_NAME";
  convo.context = { ...convo.context, slotId };
  saveConversation(phone, convo);
  await sendText(phone, "What name should we book the trial under?");
}

async function routeBookAskName(phone, convo, raw, contactName) {
  const name = raw || contactName || "Guest";
  const { courseId, slotId } = convo.context;
  const course = getCourse.get(courseId);
  const slot = getSlot.get(slotId);

  if (!course || !slot || slot.booked_count >= slot.capacity) {
    await sendText(phone, "Sorry, that slot just filled up. Type *menu* to try another one.");
    convo.state = "MAIN_MENU";
    convo.context = {};
    saveConversation(phone, convo);
    return;
  }

  insertBooking.run(name, phone, courseId, slotId);
  bumpSlotBooking.run(slotId);

  convo.state = "MAIN_MENU";
  convo.context = {};
  saveConversation(phone, convo);

  await sendText(
    phone,
    `✅ You're booked!\n\n*${course.name}* trial for *${name}*\n🗓 ${slot.label}\n\nWe'll see you there. Reply *menu* any time for other options.`
  );
}

// ---------- Enrolled student support ----------
async function showStudentMenu(phone, convo) {
  const student = findStudentByPhone.get(phone);
  if (!student) {
    await sendButtons(
      phone,
      "We couldn't find an enrolled-student record for this number. If you've just joined, it can take a day to show up here — or we can put you in touch with the office.",
      [
        { id: "MENU_HUMAN", title: "Talk to staff" },
        { id: "MENU_MAIN", title: "⬅ Main menu" },
      ]
    );
    convo.state = "MAIN_MENU";
    convo.context = {};
    saveConversation(phone, convo);
    return;
  }
  convo.state = "STUDENT_MENU";
  convo.context = { studentId: student.id };
  saveConversation(phone, convo);
  await sendButtons(phone, `Hi ${student.name}! What would you like to check?`, [
    { id: "STUDENT_TIMETABLE", title: "Class timetable" },
    { id: "STUDENT_FEES", title: "Fees due" },
    { id: "MENU_MAIN", title: "⬅ Main menu" },
  ]);
}

async function routeStudentMenu(phone, convo, action) {
  const student = db.prepare("SELECT * FROM students WHERE id = ?").get(convo.context.studentId);
  if (!student) {
    convo.state = "MAIN_MENU";
    convo.context = {};
    saveConversation(phone, convo);
    await sendMainMenu(phone);
    return;
  }

  if (action === "STUDENT_TIMETABLE" || action === "1") {
    const course = getCourse.get(student.course_id);
    const schedule = listScheduleForCourse
      .all(student.course_id)
      .map((s) => `• ${s.day_of_week}, ${s.time_label} (${s.room})`)
      .join("\n") || "No schedule on file — please check with the office.";
    await sendText(phone, `🗓 *Your timetable — ${course?.name || "your course"}*\n\n${schedule}`);
    return;
  }

  if (action === "STUDENT_FEES" || action === "2") {
    const fees = listUnpaidFees.all(student.id);
    const body = fees.length
      ? fees.map((f) => `• ${f.amount_text} due ${f.due_date}`).join("\n")
      : "You're all caught up — no pending fees. 🎉";
    await sendText(phone, `💰 *Fees*\n\n${body}`);
    return;
  }

  await sendText(phone, "Please choose an option above, or type *menu*.");
}

// ---------- Human handoff ----------
async function escalateToHuman(phone, convo) {
  const student = findStudentByPhone.get(phone);
  convo.needsHuman = true;
  saveConversation(phone, convo);
  insertStaffAlert.run(phone, student?.name || null, null);
  await notifyStaff(phone, student?.name, null);
  await sendText(
    phone,
    "Sure — I've let a staff member know and they'll message you here shortly. Type *menu* any time if you'd like to use the bot again in the meantime."
  );
}

module.exports = { handleIncomingMessage };
