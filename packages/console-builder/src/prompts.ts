// Console builder — a library of ready text prompts for building agents and consoles.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

export interface PromptIdea {
  id: string;
  field: string;
  title: string;
  /** The text prompt to send to Claude (or any AI) to build the console. */
  prompt: string;
}

const steps = (who: string, list: string[]) =>
  `Build a ${who} agent console with a "start" command that shows the steps in a table, then one command per step:\n${list.map((s, i) => `Step ${i + 1}: ${s}`).join("\n")}\nEvery step prints what to type next. Use calc for every number.`;

export const PROMPT_LIBRARY: PromptIdea[] = [
  { id: "p-clinic", field: "Health", title: "Clinic booking agent", prompt: steps("clinic receptionist", ["register the patient name", "choose the doctor (general, dentist, eyes, children)", "visit fee after an insurance percent", "print a booking summary with the date"]) },
  { id: "p-diet", field: "Health", title: "Nutrition coach", prompt: steps("nutrition coach", ["save weight, height and age", "daily calories for light, medium or high activity", "split calories into protein, carbs and fat", "suggest a random healthy meal"]) },
  { id: "p-school", field: "Education", title: "School grades agent", prompt: steps("teacher", ["set the class name", "average of three test scores", "letter grade from the average (A 90+, B 80+, C 70+, D 60+)", "write a short message to parents"]) },
  { id: "p-quiz", field: "Education", title: "Exam practice agent", prompt: steps("exam practice", ["choose a subject", "give a random practice question from a list of 8", "show the answers table", "score as a percentage"]) },
  { id: "p-lawyer", field: "Legal", title: "Case organiser", prompt: steps("legal office", ["open a case with a title", "days left before a deadline", "fee estimate from hours and rate", "list of documents to collect"]) },
  { id: "p-sales", field: "Sales", title: "Lead qualifier", prompt: steps("sales", ["name the lead company", "score budget, need and timing out of 10", "deal value from seats and price", "summary and a suggested next action"]) },
  { id: "p-quote", field: "Sales", title: "Price quote maker", prompt: steps("price quote", ["customer name", "line total from quantity and unit price", "discount percent and 14% VAT", "print the quote with payment terms"]) },
  { id: "p-support", field: "Customer service", title: "Support ticket agent", prompt: steps("customer support", ["log the customer's problem", "set priority low, normal or high", "draft a polite reply", "close the ticket with a summary"]) },
  { id: "p-hr", field: "HR", title: "Onboarding agent", prompt: steps("HR onboarding", ["new hire name and role", "first-week checklist table", "net salary from gross with a deduction percent", "welcome message"]) },
  { id: "p-leave", field: "HR", title: "Leave balance agent", prompt: steps("leave balance", ["employee name", "days left from yearly days and days taken", "return date message from days requested", "approval summary"]) },
  { id: "p-market", field: "Marketing", title: "Campaign checker", prompt: steps("marketing", ["campaign name", "ROI from spend and revenue", "cost per lead", "random social post idea"]) },
  { id: "p-social", field: "Media", title: "Content planner", prompt: steps("content creator", ["topic", "number of posts from weeks and posts per week", "engagement rate from interactions and views", "random hook line"]) },
  { id: "p-shop", field: "E-commerce", title: "Online store helper", prompt: steps("online store", ["product name", "selling price from cost, shipping and margin", "days of stock left", "ready product post"]) },
  { id: "p-restaurant", field: "Restaurants", title: "Restaurant day planner", prompt: steps("restaurant manager", ["expected guests", "food cost percent", "waiters needed", "today's special"]) },
  { id: "p-hotel", field: "Hospitality", title: "Hotel booking agent", prompt: steps("hotel booking", ["guest name", "room total from nights and price", "breakfast cost", "confirmation message"]) },
  { id: "p-travel", field: "Travel", title: "Trip planner", prompt: steps("travel planner", ["destination", "total budget from days and cost per day plus 10%", "packing list", "trip summary"]) },
  { id: "p-ship", field: "Logistics", title: "Shipment agent", prompt: steps("shipping", ["route", "cost from weight and price per kg", "hours on the road from km and speed", "tracking status"]) },
  { id: "p-build", field: "Construction", title: "Building estimator", prompt: steps("construction", ["job name", "area from length and width", "materials with 10% waste", "labour cost from workers, days and rate"]) },
  { id: "p-farm", field: "Agriculture", title: "Crop planner", prompt: steps("farm", ["crop", "seed needed", "water per season", "expected income"]) },
  { id: "p-it", field: "IT", title: "Helpdesk agent", prompt: steps("IT helpdesk", ["describe the problem", "quick fix checklist", "downtime in minutes", "close the ticket"]) },
  { id: "p-sec", field: "Security", title: "Security check", prompt: steps("cyber security", ["company to check", "risk score from likelihood and impact", "backup storage needed", "random staff security tip"]) },
  { id: "p-acc", field: "Accounting", title: "Month close agent", prompt: steps("accountant", ["month revenue", "profit after expenses", "tax from a percent", "profit margin"]) },
  { id: "p-ins", field: "Insurance", title: "Policy quote agent", prompt: steps("insurance", ["customer name", "yearly premium from value and rate", "no-claims discount", "table of what is covered"]) },
  { id: "p-home", field: "Real estate", title: "Property broker", prompt: steps("property broker", ["client name", "budget left after price", "commission", "viewing slot"]) },
  { id: "p-mortgage", field: "Real estate", title: "Mortgage helper", prompt: steps("mortgage", ["property price", "down payment from a percent", "monthly payment from rate and years", "total interest paid"]) },
  { id: "p-event", field: "Events", title: "Event planner", prompt: steps("event planner", ["event name", "budget from guests and cost per guest", "venue choice", "day checklist"]) },
  { id: "p-gym", field: "Fitness", title: "Gym trainer", prompt: steps("gym trainer", ["member name", "daily calories", "weekly training plan", "membership price with discount"]) },
  { id: "p-charity", field: "Nonprofit", title: "Donation campaign", prompt: steps("charity", ["campaign name", "percent of goal reached", "families helped", "thank-you message"]) },
  { id: "p-budget", field: "Finance", title: "Family budget", prompt: steps("family budget", ["monthly income", "50/30/20 split", "months to a savings goal", "can I afford this purchase"]) },
  { id: "p-car", field: "Transport", title: "Car rental", prompt: steps("car rental", ["car type", "rent with a weekly discount", "insurance", "contract summary"]) },
];
