// Real course data pulled from https://artisticrubans.com/ (2026-08-01).
//
// IMPORTANT — fees: the website does not publish prices anywhere (enrollment goes
// through a Google Form instead). fee_text is set to "Contact us for current fees"
// for every course below — replace with real numbers once you have them from Ruban.
//
// Trial slot dates are placeholders based on the recurring weekly windows listed on
// the site — adjust to actual upcoming dates before sharing with real prospects.
require("dotenv").config();
const db = require("./index");

const insertCourse = db.prepare(`
  INSERT INTO courses (name, category, age_group, description, fee_text, duration_text, mode_text, image_url)
  VALUES (@name, @category, @age_group, @description, @fee_text, @duration_text, @mode_text, @image_url)
`);

const insertSlot = db.prepare(`
  INSERT INTO trial_slots (course_id, label, capacity, booked_count)
  VALUES (@course_id, @label, @capacity, 0)
`);

const insertSchedule = db.prepare(`
  INSERT INTO class_schedule (course_id, day_of_week, time_label, room)
  VALUES (@course_id, @day_of_week, @time_label, @room)
`);

const insertStudent = db.prepare(`
  INSERT OR IGNORE INTO students (phone, name, course_id, status)
  VALUES (@phone, @name, @course_id, 'active')
`);

const insertFee = db.prepare(`
  INSERT INTO fee_reminders (student_id, amount_text, due_date, paid)
  VALUES (@student_id, @amount_text, @due_date, @paid)
`);

const alreadySeeded = db.prepare("SELECT COUNT(*) AS n FROM courses").get().n > 0;

if (alreadySeeded) {
  console.log("Courses already exist — skipping seed (delete the .db file to reset).");
  process.exit(0);
}

const CONTACT_FOR_FEE = "Contact us for current fees";
const ONLINE_OFFLINE = "Online & offline (Adyar studio) batches available";

const seedAll = db.transaction(() => {
  const courses = [
    {
      name: "Tanjore Painting",
      category: "Traditional Art",
      age_group: "All ages · no experience needed",
      description:
        "Traditional South Indian art form featuring rich colours, intricate designs, and real gold foil work. Step-by-step guidance from scratch — all materials provided, and the artwork is yours to keep.",
      fee_text: CONTACT_FOR_FEE,
      duration_text: "6-8 month batch (track-dependent)",
      mode_text: ONLINE_OFFLINE,
      image_url: "https://artisticrubans.com/wp-content/uploads/2024/12/88-scaled.jpg",
    },
    {
      name: "Emerging Artist",
      category: "Drawing & Shading",
      age_group: "Beginners",
      description:
        '"Learning to see is the first step to learning to draw." Pencil shading, pen work and colour pencil techniques — building depth, contrast and control of light and shadow. The entry point into the school\'s art-tier program.',
      fee_text: CONTACT_FOR_FEE,
      duration_text: "Ongoing batch",
      mode_text: ONLINE_OFFLINE,
      image_url: "https://artisticrubans.com/wp-content/uploads/2025/08/1.png",
    },
    {
      name: "Skilled Artist",
      category: "Oil Pastels & Figure Drawing",
      age_group: "Intermediate (after Emerging Artist)",
      description:
        '"Art begins where technique ends." Oil pastels, human figure measurements and still life composition — sharpening observation and perspective. The transition from beginner to confident creator.',
      fee_text: CONTACT_FOR_FEE,
      duration_text: "Ongoing batch",
      mode_text: ONLINE_OFFLINE,
      image_url: "https://artisticrubans.com/wp-content/uploads/2025/08/1-1.png",
    },
    {
      name: "Versatile Artist",
      category: "Watercolour & Acrylic",
      age_group: "Basic & advanced levels",
      description:
        '"Painting is silent poetry." Watercolours and acrylics at foundational and advanced levels — colour theory, brush technique and multiple artistic styles across two mediums.',
      fee_text: CONTACT_FOR_FEE,
      duration_text: "Ongoing batch",
      mode_text: ONLINE_OFFLINE,
      image_url: "https://artisticrubans.com/wp-content/uploads/2025/08/Water-colour.jpg",
    },
    {
      name: "Master Artist",
      category: "Oil Painting & Mixed Media",
      age_group: "Advanced",
      description:
        "The pinnacle program: oil paints, knife techniques and mixed media. Students develop a personal style, work on professional projects, and are guided toward original, exhibition-ready art.",
      fee_text: CONTACT_FOR_FEE,
      duration_text: "Ongoing batch",
      mode_text: ONLINE_OFFLINE,
      image_url: "https://artisticrubans.com/wp-content/uploads/2025/08/1-2.png",
    },
  ];

  const courseIds = {};
  for (const c of courses) {
    const info = insertCourse.run(c);
    courseIds[c.name] = info.lastInsertRowid;
  }

  // A couple of representative "book a trial" slots per course, drawn from the
  // recurring weekly windows on the site. Swap in real upcoming dates.
  const slots = [
    { course: "Tanjore Painting", label: "Sat, 8 Aug · 6:00-8:00 AM (Online)", capacity: 6 },
    { course: "Tanjore Painting", label: "Fri, 7 Aug · 10:30 AM-1:00 PM (Adyar studio)", capacity: 6 },
    { course: "Emerging Artist", label: "Sun, 9 Aug · 11:00 AM-1:00 PM (Adyar studio)", capacity: 8 },
    { course: "Emerging Artist", label: "Sat, 8 Aug · 3:00-5:00 PM (Online)", capacity: 8 },
    { course: "Skilled Artist", label: "Sat, 8 Aug · 11:00 AM-1:00 PM (Adyar studio)", capacity: 6 },
    { course: "Versatile Artist", label: "Fri, 7 Aug · 11:00 AM-1:00 PM (Adyar studio)", capacity: 6 },
    { course: "Master Artist", label: "Sun, 9 Aug · 5:30-6:30 PM (Adyar studio)", capacity: 4 },
  ];
  for (const s of slots) {
    insertSlot.run({ course_id: courseIds[s.course], label: s.label, capacity: s.capacity });
  }

  const schedule = [
    { course: "Tanjore Painting", day_of_week: "Mon-Fri", time_label: "5:30 PM - 7:30 PM", room: "Online" },
    { course: "Tanjore Painting", day_of_week: "Friday", time_label: "10:30 AM - 1:00 PM", room: "Adyar studio" },
    { course: "Emerging Artist", day_of_week: "Sun / Fri / Sat", time_label: "11:00 AM - 1:00 PM", room: "Adyar studio" },
    { course: "Emerging Artist", day_of_week: "Daily", time_label: "5:30 PM - 7:30 PM", room: "Online" },
    { course: "Skilled Artist", day_of_week: "Sun / Fri / Sat", time_label: "11:00 AM - 1:00 PM", room: "Adyar studio" },
    { course: "Skilled Artist", day_of_week: "Mon-Fri", time_label: "5:30 PM - 7:30 PM", room: "Online" },
    { course: "Versatile Artist", day_of_week: "Fri & Sat", time_label: "11:00 AM - 1:00 PM", room: "Adyar studio" },
    { course: "Versatile Artist", day_of_week: "Mon-Fri", time_label: "5:30 PM - 7:30 PM", room: "Online" },
    { course: "Master Artist", day_of_week: "Fri & Sat", time_label: "11:00 AM - 1:00 PM", room: "Adyar studio" },
    { course: "Master Artist", day_of_week: "Mon, Tue, Thu, Fri", time_label: "5:30 PM - 7:30 PM", room: "Online" },
  ];
  for (const s of schedule) {
    insertSchedule.run({ course_id: courseIds[s.course], day_of_week: s.day_of_week, time_label: s.time_label, room: s.room });
  }

  // Placeholder enrolled student so the "My classes / fees" flow is demoable.
  // Replace with a real bulk import of Artistic Ruban's actual students before going live.
  // NOTE: phone must be digits only with country code, no "+", e.g. 919876543210
  const demoStudent = { phone: "919999999999", name: "Demo Student", course_id: courseIds["Versatile Artist"] };
  const info = insertStudent.run(demoStudent);
  const studentId = info.lastInsertRowid || db.prepare("SELECT id FROM students WHERE phone = ?").get(demoStudent.phone).id;

  insertFee.run({ student_id: studentId, amount_text: "Contact office for amount", due_date: "2026-08-10", paid: 0 });
});

seedAll();
console.log("Seed complete: 5 real Artistic Ruban's courses, trial slots, class schedule, 1 placeholder demo student.");
