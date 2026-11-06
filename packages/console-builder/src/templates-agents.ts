// Console builder — agent samples for many fields, each with 4 clear steps.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

import type { ConsoleTemplate } from "./templates";
import { agent, num, pick, say, text } from "./templates-more";

type Cmd = ConsoleTemplate["spec"]["commands"][number];
const setNext = (name: string, value: string, done: string, next: string): Cmd["actions"] => [
  { type: "set", name, value },
  say(done, "ok"),
  say(`Next: ${next}`, "muted"),
];
const inField = (field: string, t: ConsoleTemplate): ConsoleTemplate => ({ ...t, field });

export const FIELD_AGENTS: ConsoleTemplate[] = [
  inField("Health", agent("clinic-agent", "Clinic receptionist agent", "Register a patient, choose a doctor, price the visit with insurance and print the booking.", "I book a clinic visit in 4 steps.",
    ["patient Ahmed Ali", "doctor dentist", "fee 600 30", "booking"],
    [
      { name: "patient", summary: "Step 1: register the patient's name", args: [text("name")], examples: ["patient Ahmed Ali"], actions: setNext("patient", "{name}", "Patient: {name}", "doctor general|dentist|eyes|children") },
      { name: "doctor", summary: "Step 2: choose the doctor", args: [pick("type", ["general", "dentist", "eyes", "children"])], examples: ["doctor dentist"], actions: setNext("doctor", "{type}", "Doctor: {type}", "fee price insurance-%") },
      { name: "fee", summary: "Step 3: visit fee after the insurance share", args: [num("price"), num("insurance", "Percent paid by insurance")], examples: ["fee 600 30"], action: { type: "calc", expression: "price * (1 - insurance / 100)", label: "Patient pays", saveAs: "fee", decimals: 0 } },
      { name: "booking", summary: "Step 4: print the booking summary", actions: [{ type: "kv", pairs: [["Patient", "{$patient}"], ["Doctor", "{$doctor}"], ["Patient pays", "{$fee}"]] }, { type: "date", format: "local" }] },
    ], { patient: "(none)", doctor: "general", fee: "0" })),

  inField("Health", agent("pharmacy-agent", "Pharmacy agent", "Look up a medicine, compute the dose schedule, the price and a care reminder.", "I prepare a pharmacy order in 4 steps. Always follow the doctor's prescription.",
    ["medicine Paracetamol 500mg", "schedule 3 5", "price 15 2", "advice"],
    [
      { name: "medicine", summary: "Step 1: name the medicine", args: [text("name")], examples: ["medicine Paracetamol 500mg"], actions: setNext("med", "{name}", "Medicine: {name}", "schedule times-per-day days") },
      { name: "schedule", summary: "Step 2: total doses from times per day and days", args: [num("times"), num("days")], examples: ["schedule 3 5"], action: { type: "calc", expression: "times * days", label: "Total doses", decimals: 0 } },
      { name: "price", summary: "Step 3: order price from box price and boxes", args: [num("box"), num("boxes")], examples: ["price 15 2"], action: { type: "calc", expression: "box * boxes", label: "Total price", decimals: 2 } },
      { name: "advice", summary: "Step 4: care reminder for the customer", action: say("Take {$med} as prescribed, with water, and keep it away from children. Ask the pharmacist about other medicines you use.", "warn") },
    ], { med: "(none)" })),

  inField("Education", agent("teacher-agent", "Teacher agent", "Set a class, average test scores, pick homework and write a parent message.", "I help a teacher in 4 steps.",
    ["class Grade 5 A", "average 78 85 92", "homework", "parents"],
    [
      { name: "class", summary: "Step 1: set the class name", args: [text("name")], examples: ["class Grade 5 A"], actions: setNext("cls", "{name}", "Class: {name}", "average score1 score2 score3") },
      { name: "average", summary: "Step 2: average of three test scores", args: [num("a"), num("b"), num("c")], examples: ["average 78 85 92"], action: { type: "calc", expression: "(a + b + c) / 3", label: "Average", saveAs: "avg", decimals: 1 } },
      { name: "homework", summary: "Step 3: pick a homework task", action: { type: "choice", options: ["Read one chapter and write 5 lines", "Solve 10 practice problems", "Make a mind map of the lesson", "Interview a family member about the topic"] } },
      { name: "parents", summary: "Step 4: message to parents", action: say("Dear parents, class {$cls} finished this week's tests with an average of {$avg}. Thank you for your support at home.", "info") },
    ], { cls: "(none)", avg: "0" })),

  inField("Legal", agent("legal-agent", "Legal office agent", "Open a case, count days to a deadline, estimate fees and list documents.", "I organise a legal case in 4 steps. This is not legal advice.",
    ["case Rent dispute", "deadline 45 12", "fees 8 1500", "documents"],
    [
      { name: "case", summary: "Step 1: open the case with a short title", args: [text("title")], examples: ["case Rent dispute"], actions: setNext("case", "{title}", "Case opened: {title}", "deadline total-days days-used") },
      { name: "deadline", summary: "Step 2: days left before the deadline", args: [num("total"), num("used")], examples: ["deadline 45 12"], action: { type: "calc", expression: "total - used", label: "Days left", decimals: 0 } },
      { name: "fees", summary: "Step 3: fee estimate from hours and hourly rate", args: [num("hours"), num("rate")], examples: ["fees 8 1500"], action: { type: "calc", expression: "hours * rate", label: "Estimated fees", decimals: 0 } },
      { name: "documents", summary: "Step 4: documents to collect", action: { type: "table", columns: ["Document", "Why"], rows: [["ID copy", "Identity"], ["Contract", "The agreement"], ["Receipts", "Proof of payment"], ["Messages", "Proof of contact"]] } },
    ], { case: "(none)" })),

  inField("Real estate", agent("broker-agent", "Property broker agent", "Record a client, compare budget and price, compute commission and book a viewing.", "I handle a property client in 4 steps.",
    ["client Dina", "fit 2500000 2300000", "commission 2300000 2.5", "viewing"],
    [
      { name: "client", summary: "Step 1: client's name", args: [text("name")], examples: ["client Dina"], actions: setNext("client", "{name}", "Client: {name}", "fit budget price") },
      { name: "fit", summary: "Step 2: how much budget is left after the price", args: [num("budget"), num("price")], examples: ["fit 2500000 2300000"], action: { type: "calc", expression: "budget - price", label: "Budget left", decimals: 0 } },
      { name: "commission", summary: "Step 3: your commission from price and percent", args: [num("price"), num("percent")], examples: ["commission 2300000 2.5"], action: { type: "calc", expression: "price * percent / 100", label: "Commission", decimals: 0 } },
      { name: "viewing", summary: "Step 4: pick a viewing slot", action: { type: "choice", options: ["Saturday 11:00", "Sunday 17:00", "Monday 19:00", "Wednesday 12:00"], saveAs: "slot" } },
    ], { client: "(none)" })),

  inField("Restaurants", agent("kitchen-agent", "Restaurant manager agent", "Plan covers, food cost, staff needed and today's special.", "I plan a restaurant day in 4 steps.",
    ["covers 120", "foodcost 4200 12000", "staff 120 20", "special"],
    [
      { name: "covers", summary: "Step 1: expected guests today", args: [num("guests")], examples: ["covers 120"], actions: setNext("covers", "{guests}", "Expected guests: {guests}", "foodcost cost sales") },
      { name: "foodcost", summary: "Step 2: food cost % (good is under 35%)", args: [num("cost"), num("sales")], examples: ["foodcost 4200 12000"], action: { type: "calc", expression: "cost / sales * 100", label: "Food cost %", decimals: 1 } },
      { name: "staff", summary: "Step 3: waiters needed from guests and guests per waiter", args: [num("guests"), num("per")], examples: ["staff 120 20"], action: { type: "calc", expression: "ceil(guests / per)", label: "Waiters", decimals: 0 } },
      { name: "special", summary: "Step 4: choose today's special", action: { type: "choice", options: ["Grilled chicken", "Seafood rice", "Beef kofta", "Vegetable tagine"] } },
    ], { covers: "0" })),

  inField("E-commerce", agent("store-agent", "Online store agent", "Add a product, price it with shipping, check stock and write a product post.", "I prepare a product listing in 4 steps.",
    ["product Leather bag", "price 450 60 40", "stock 35 8", "post"],
    [
      { name: "product", summary: "Step 1: product name", args: [text("name")], examples: ["product Leather bag"], actions: setNext("product", "{name}", "Product: {name}", "price cost shipping margin-%") },
      { name: "price", summary: "Step 2: selling price from cost, shipping and margin %", args: [num("cost"), num("shipping"), num("margin")], examples: ["price 450 60 40"], action: { type: "calc", expression: "(cost + shipping) * (1 + margin / 100)", label: "Selling price", saveAs: "price", decimals: 0 } },
      { name: "stock", summary: "Step 3: days of stock left from units and daily sales", args: [num("units"), num("daily")], examples: ["stock 35 8"], action: { type: "calc", expression: "units / daily", label: "Days of stock", decimals: 1 } },
      { name: "post", summary: "Step 4: a ready product post", action: say("New in store: {$product}! Now only {$price}. Order today, delivery in 2-4 days.", "ok") },
    ], { product: "(none)", price: "0" })),

  inField("Logistics", agent("shipping-agent", "Shipping agent", "Create a shipment, compute weight cost, delivery time and tracking status.", "I prepare a shipment in 4 steps.",
    ["shipment Cairo to Aswan", "cost 12 18", "eta 880 60", "track"],
    [
      { name: "shipment", summary: "Step 1: route of the shipment", args: [text("route")], examples: ["shipment Cairo to Aswan"], actions: setNext("route", "{route}", "Shipment: {route}", "cost kg price-per-kg") },
      { name: "cost", summary: "Step 2: cost from weight and price per kg", args: [num("kg"), num("perkg")], examples: ["cost 12 18"], action: { type: "calc", expression: "kg * perkg", label: "Shipping cost", decimals: 2 } },
      { name: "eta", summary: "Step 3: driving hours from km and average speed", args: [num("km"), num("speed")], examples: ["eta 880 60"], action: { type: "calc", expression: "km / speed", label: "Hours on the road", decimals: 1 } },
      { name: "track", summary: "Step 4: current tracking status", actions: [say("Shipment {$route}:", "info"), { type: "choice", options: ["Picked up", "At the hub", "Out for delivery", "Delivered ✓"] }] },
    ], { route: "(none)" })),

  inField("Construction", agent("site-agent", "Construction site agent", "Name the job, compute area, materials and the labour cost.", "I estimate a building job in 4 steps.",
    ["job Kitchen tiling", "area 4.5 3.2", "tiles 14.4 0.36", "labour 3 4 450"],
    [
      { name: "job", summary: "Step 1: name the job", args: [text("name")], examples: ["job Kitchen tiling"], actions: setNext("job", "{name}", "Job: {name}", "area length width") },
      { name: "area", summary: "Step 2: floor area in m² from length and width", args: [num("length"), num("width")], examples: ["area 4.5 3.2"], action: { type: "calc", expression: "length * width", label: "Area m²", decimals: 2 } },
      { name: "tiles", summary: "Step 3: tiles needed (+10% waste) from area and tile size m²", args: [num("area"), num("tile")], examples: ["tiles 14.4 0.36"], action: { type: "calc", expression: "ceil(area / tile * 1.1)", label: "Tiles", decimals: 0 } },
      { name: "labour", summary: "Step 4: labour cost from workers, days and daily rate", args: [num("workers"), num("days"), num("rate")], examples: ["labour 3 4 450"], action: { type: "calc", expression: "workers * days * rate", label: "Labour cost", decimals: 0 } },
    ], { job: "(none)" })),

  inField("Agriculture", agent("farm-agent", "Farm agent", "Plan a crop: field size, seeds, water and expected harvest income.", "I plan a crop season in 4 steps.",
    ["crop Wheat", "seeds 5 60", "water 5 2500", "income 5 2.8 9000"],
    [
      { name: "crop", summary: "Step 1: choose the crop", args: [text("name")], examples: ["crop Wheat"], actions: setNext("crop", "{name}", "Crop: {name}", "seeds feddans kg-per-feddan") },
      { name: "seeds", summary: "Step 2: seed needed from area and kg per unit area", args: [num("area"), num("rate")], examples: ["seeds 5 60"], action: { type: "calc", expression: "area * rate", label: "Seed kg", decimals: 0 } },
      { name: "water", summary: "Step 3: water m³ per season from area and m³ per unit", args: [num("area"), num("perunit")], examples: ["water 5 2500"], action: { type: "calc", expression: "area * perunit", label: "Water m³", decimals: 0 } },
      { name: "income", summary: "Step 4: income from area, tons per unit and price per ton", args: [num("area"), num("tons"), num("price")], examples: ["income 5 2.8 9000"], action: { type: "calc", expression: "area * tons * price", label: "Expected income", decimals: 0 } },
    ], { crop: "(none)" })),

  inField("IT", agent("helpdesk-agent", "IT helpdesk agent", "Log a problem, run a quick fix checklist, measure downtime and close.", "I solve an IT ticket in 4 steps.",
    ["issue Laptop cannot connect to Wi-Fi", "checklist", "downtime 9.5 11", "solved"],
    [
      { name: "issue", summary: "Step 1: describe the problem", args: [text("text")], examples: ["issue Laptop cannot connect to Wi-Fi"], actions: setNext("issue", "{text}", "Logged: {text}", "checklist") },
      { name: "checklist", summary: "Step 2: quick fix checklist", action: { type: "table", columns: ["Try", "Done?"], rows: [["Restart the device", "☐"], ["Check cables / Wi-Fi switch", "☐"], ["Update the system", "☐"], ["Log out and in again", "☐"], ["Escalate to level 2", "☐"]] } },
      { name: "downtime", summary: "Step 3: downtime in minutes from start and end hour", args: [num("start"), num("end")], examples: ["downtime 9.5 11"], action: { type: "calc", expression: "(end - start) * 60", label: "Minutes down", decimals: 0 } },
      { name: "solved", summary: "Step 4: close the ticket", action: { type: "kv", pairs: [["Issue", "{$issue}"], ["Status", "Solved ✓"]] } },
    ], { issue: "(none)" })),

  inField("Security", agent("security-agent", "Cyber security agent", "Score a password policy, list risks, plan backups and write a staff tip.", "I run a basic security check in 4 steps.",
    ["company Nile Foods", "risk 3 4", "backup 500 7", "tip"],
    [
      { name: "company", summary: "Step 1: company to check", args: [text("name")], examples: ["company Nile Foods"], actions: setNext("company", "{name}", "Checking: {name}", "risk likelihood impact (1-5 each)") },
      { name: "risk", summary: "Step 2: risk score from likelihood × impact (1-5 each)", args: [num("likelihood"), num("impact")], examples: ["risk 3 4"], action: { type: "calc", expression: "likelihood * impact", label: "Risk score / 25", decimals: 0 } },
      { name: "backup", summary: "Step 3: backup storage from daily GB and days kept", args: [num("gb"), num("days")], examples: ["backup 500 7"], action: { type: "calc", expression: "gb * days / 1000", label: "Storage TB", decimals: 2 } },
      { name: "tip", summary: "Step 4: a security tip for staff", action: { type: "choice", options: ["Turn on two-step sign-in everywhere.", "Never share passwords in chat or email.", "Check the sender before clicking links.", "Lock your screen when you leave your desk."] } },
    ], { company: "(none)" })),

  inField("Accounting", agent("accountant-agent", "Accountant agent", "Record revenue and expenses, compute profit, tax and the profit margin.", "I close a month in 4 steps.",
    ["revenue 180000", "profit 125000", "tax 22.5", "margin"],
    [
      { name: "revenue", summary: "Step 1: month revenue", args: [num("amount")], examples: ["revenue 180000"], actions: setNext("revenue", "{amount}", "Revenue saved", "profit expenses") },
      { name: "profit", summary: "Step 2: profit after expenses", args: [num("expenses")], examples: ["profit 125000"], action: { type: "calc", expression: "revenue - expenses", label: "Profit", saveAs: "profit", decimals: 0 } },
      { name: "tax", summary: "Step 3: income tax from a percent", args: [num("percent")], examples: ["tax 22.5"], action: { type: "calc", expression: "profit * percent / 100", label: "Tax", decimals: 0 } },
      { name: "margin", summary: "Step 4: profit margin %", action: { type: "calc", expression: "profit / revenue * 100", label: "Margin %", decimals: 1 } },
    ], { revenue: "0", profit: "0" })),

  inField("Insurance", agent("insurance-agent", "Insurance agent", "Quote a car policy from value, rate and discounts, then list the cover.", "I quote an insurance policy in 4 steps.",
    ["customer Hassan", "premium 800000 3.5", "discount 28000 10", "cover"],
    [
      { name: "customer", summary: "Step 1: customer's name", args: [text("name")], examples: ["customer Hassan"], actions: setNext("cust", "{name}", "Customer: {name}", "premium value rate-%") },
      { name: "premium", summary: "Step 2: yearly premium from value and rate %", args: [num("value"), num("rate")], examples: ["premium 800000 3.5"], action: { type: "calc", expression: "value * rate / 100", label: "Yearly premium", decimals: 0 } },
      { name: "discount", summary: "Step 3: premium after a no-claims discount", args: [num("premium"), num("percent")], examples: ["discount 28000 10"], action: { type: "calc", expression: "premium * (1 - percent / 100)", label: "After discount", decimals: 0 } },
      { name: "cover", summary: "Step 4: what the policy covers", action: { type: "table", columns: ["Cover", "Included"], rows: [["Accident damage", "Yes"], ["Theft", "Yes"], ["Fire", "Yes"], ["Roadside help", "Yes"], ["Personal items", "No"]] } },
    ], { cust: "(none)" })),

  inField("Hospitality", agent("hotel-agent", "Hotel booking agent", "Take a guest booking, price the nights, add breakfast and confirm.", "I book a hotel stay in 4 steps.",
    ["guest Sara Salem", "nights 3 1800", "breakfast 2 3 150", "confirm"],
    [
      { name: "guest", summary: "Step 1: guest's name", args: [text("name")], examples: ["guest Sara Salem"], actions: setNext("guest", "{name}", "Guest: {name}", "nights count price-per-night") },
      { name: "nights", summary: "Step 2: room total from nights and price per night", args: [num("count"), num("price")], examples: ["nights 3 1800"], action: { type: "calc", expression: "count * price", label: "Room total", saveAs: "room", decimals: 0 } },
      { name: "breakfast", summary: "Step 3: breakfast from people, days and price", args: [num("people"), num("days"), num("price")], examples: ["breakfast 2 3 150"], action: { type: "calc", expression: "people * days * price", label: "Breakfast", decimals: 0 } },
      { name: "confirm", summary: "Step 4: booking confirmation", action: say("Dear {$guest}, your room is confirmed. Room total {$room}. We look forward to welcoming you!", "ok") },
    ], { guest: "(none)", room: "0" })),

  inField("Events", agent("event-agent", "Event planner agent", "Plan an event: guests, cost per guest, venue and the day checklist.", "I plan an event in 4 steps.",
    ["event Company dinner", "cost 80 350", "venue", "checklist"],
    [
      { name: "event", summary: "Step 1: name the event", args: [text("name")], examples: ["event Company dinner"], actions: setNext("event", "{name}", "Event: {name}", "cost guests cost-per-guest") },
      { name: "cost", summary: "Step 2: total from guests and cost per guest (+10%)", args: [num("guests"), num("each")], examples: ["cost 80 350"], action: { type: "calc", expression: "guests * each * 1.1", label: "Budget with 10% extra", decimals: 0 } },
      { name: "venue", summary: "Step 3: pick a venue type", action: { type: "choice", options: ["Hotel ballroom", "Garden venue", "Rooftop", "Restaurant private room"] } },
      { name: "checklist", summary: "Step 4: event day checklist", action: { type: "table", columns: ["Time", "Task"], rows: [["-1 week", "Confirm guests and menu"], ["-1 day", "Check sound and seating"], ["Day", "Welcome desk and name badges"], ["After", "Send thank-you message"]] } },
    ], { event: "(none)" })),

  inField("Fitness", agent("gym-agent", "Gym trainer agent", "Register a member, compute calories, set a weekly plan and price the membership.", "I set up a gym member in 4 steps.",
    ["member Omar", "calories 80 180 30", "plan", "membership 12 450 15"],
    [
      { name: "member", summary: "Step 1: member's name", args: [text("name")], examples: ["member Omar"], actions: setNext("member", "{name}", "Member: {name}", "calories kg cm age") },
      { name: "calories", summary: "Step 2: daily calories (men's formula, light activity)", args: [num("kg"), num("cm"), num("age")], examples: ["calories 80 180 30"], action: { type: "calc", expression: "(10 * kg + 6.25 * cm - 5 * age + 5) * 1.375", label: "Calories per day", decimals: 0 } },
      { name: "plan", summary: "Step 3: weekly training plan", action: { type: "table", columns: ["Day", "Training"], rows: [["Sat", "Upper body"], ["Mon", "Lower body"], ["Wed", "Cardio 30 min"], ["Thu", "Full body"]] } },
      { name: "membership", summary: "Step 4: membership price from months, monthly fee and discount %", args: [num("months"), num("fee"), num("discount")], examples: ["membership 12 450 15"], action: { type: "calc", expression: "months * fee * (1 - discount / 100)", label: "Total", decimals: 0 } },
    ], { member: "(none)" })),

  inField("Nonprofit", agent("charity-agent", "Charity agent", "Set a campaign, track the donation goal, count families helped and thank donors.", "I run a donation campaign in 4 steps.",
    ["campaign Winter blankets", "progress 64000 100000", "families 64000 400", "thanks"],
    [
      { name: "campaign", summary: "Step 1: name the campaign", args: [text("name")], examples: ["campaign Winter blankets"], actions: setNext("camp", "{name}", "Campaign: {name}", "progress raised goal") },
      { name: "progress", summary: "Step 2: percent of the goal reached", args: [num("raised"), num("goal")], examples: ["progress 64000 100000"], action: { type: "calc", expression: "raised / goal * 100", label: "Goal reached %", decimals: 0 } },
      { name: "families", summary: "Step 3: families helped from money and cost per family", args: [num("raised"), num("each")], examples: ["families 64000 400"], action: { type: "calc", expression: "floor(raised / each)", label: "Families helped", decimals: 0 } },
      { name: "thanks", summary: "Step 4: thank-you message to donors", action: say("Thank you for supporting {$camp}! Your gift brings warmth to families this winter.", "ok") },
    ], { camp: "(none)" })),

  inField("Media", agent("creator-agent", "Content creator agent", "Pick a topic, plan posts, measure engagement and get a hook line.", "I plan content in 4 steps.",
    ["topic Healthy breakfast", "posts 4 3", "engagement 1200 30000", "hook"],
    [
      { name: "topic", summary: "Step 1: choose the topic", args: [text("name")], examples: ["topic Healthy breakfast"], actions: setNext("topic", "{name}", "Topic: {name}", "posts weeks posts-per-week") },
      { name: "posts", summary: "Step 2: posts needed from weeks and posts per week", args: [num("weeks"), num("perweek")], examples: ["posts 4 3"], action: { type: "calc", expression: "weeks * perweek", label: "Posts to make", decimals: 0 } },
      { name: "engagement", summary: "Step 3: engagement rate from interactions and views", args: [num("interactions"), num("views")], examples: ["engagement 1200 30000"], action: { type: "calc", expression: "interactions / views * 100", label: "Engagement %", decimals: 2 } },
      { name: "hook", summary: "Step 4: an opening hook line", action: { type: "choice", options: ["Stop scrolling: this changed my mornings.", "3 mistakes everyone makes with this.", "I tried it for 7 days. Here is what happened.", "The 1-minute version you will actually use."] } },
    ], { topic: "(none)" })),

  inField("Transport", agent("rental-agent", "Car rental agent", "Choose a car, price the days with a weekly discount, add insurance and show the contract.", "I rent a car in 4 steps.",
    ["car SUV", "days 9 1200", "insurance 9 150", "contract"],
    [
      { name: "car", summary: "Step 1: choose a car type", args: [pick("type", ["small", "sedan", "SUV", "van"])], examples: ["car SUV"], actions: setNext("car", "{type}", "Car: {type}", "days count price-per-day") },
      { name: "days", summary: "Step 2: rent with 15% off for 7 days or more", args: [num("count"), num("price")], examples: ["days 9 1200"], action: { type: "calc", expression: "count * price * (1 - 0.15 * min(1, floor(count / 7)))", label: "Rent", saveAs: "rent", decimals: 0 } },
      { name: "insurance", summary: "Step 3: insurance from days and daily insurance", args: [num("count"), num("daily")], examples: ["insurance 9 150"], action: { type: "calc", expression: "count * daily", label: "Insurance", decimals: 0 } },
      { name: "contract", summary: "Step 4: contract summary", action: { type: "kv", pairs: [["Car", "{$car}"], ["Rent", "{$rent}"], ["Deposit", "5000 (returned)"], ["Fuel", "Return full"]] } },
    ], { car: "small", rent: "0" })),
];
