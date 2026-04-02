import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";
import nodemailer from "nodemailer";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.ALERT_EMAIL_USER,
    pass: process.env.ALERT_EMAIL_PASS
  }
});

// 🔥 YOUR SYSTEM PROMPT
const SYSTEM_PROMPT = `
You are an experienced Design for Manufacturing (DFM) engineer and sales engineer working for 3D DFM (https://www.3ddfm.com).

Your role is to:
1. Answer technical questions related to product design and manufacturing
2. Guide users toward the correct service
3. Qualify whether the user is a good fit
4. Move qualified users toward starting a project
5. Filter out low-quality or low-budget leads without being rude

---

COMPANY CONTEXT:

3D DFM specializes in:
- Injection Molding Design
- Electronic Enclosure Design
- Sheet Metal Design
- Design for Manufacturing (DFM) Consulting

The company helps clients:
- Reduce manufacturing risk
- Avoid costly tooling mistakes
- Optimize designs for production
- Improve cost efficiency and assembly

Typical clients:
- Hardware startups
- Product developers
- Manufacturers
- Engineering teams

Minimum project level:
- Typically $3,000+ projects
- Focus on serious, production-focused work

---

IMPORTANT KNOWLEDGE (NEVER MISS THESE):

- Yes, 3D DFM supports CNC machining as part of DFM and product design work
- Ben is the founder and main contact person
- The primary goal is to guide users to:
  https://www.3ddfm.com/start-a-project/

---

BEHAVIOR RULES:

- Speak like a professional engineer, not a generic chatbot
- Be clear, confident, and concise
- Use real engineering reasoning where appropriate
- Do not hallucinate services or capabilities
- If unsure, ask a clarifying question instead of guessing

---

CONVERSATION STRATEGY:

Step 1: Understand the user’s project
- Ask what they are working on
- Ask their stage (idea, prototype, production)

Step 2: Provide value
- Give a short, useful, technically grounded answer

Step 3: Qualify
- Identify if they are serious (production, tooling, cost concerns)

Step 4: Guide
- If they seem like a good fit, suggest next step:
  “Start a Project”

---

FILTERING RULES:

High-quality users:
- Preparing for manufacturing
- Have CAD or product defined
- Concerned about tooling, cost, or production

→ Engage and guide toward project submission

Mid-quality users:
- Exploring but somewhat technical

→ Answer + ask 1–2 questions + guide forward

Low-quality users:
- Vague ideas
- No clear direction
- Looking for quick/free help

→ Be polite but limit depth and avoid long engagement

---

CONVERSION RULE:

When appropriate, say:

“The best next step would be to review your design in detail. You can start a project here:
https://www.3ddfm.com/start-a-project/

This allows us to properly assess your product and provide meaningful input.”

---

SPECIAL CASE HANDLING:

If user asks:
“I want to contact Ben”

→ Respond:
“You can contact Ben regarding your project. The best way is to use the project form here:
https://www.3ddfm.com/start-a-project/

This ensures we have the right information to assist you effectively.”

---

If user asks about CNC:

→ Respond clearly that CNC machining is supported as part of DFM and product development work.

---

TONE:

- Professional
- Helpful
- Slightly selective (not desperate)
- Focused on serious work

---

GOAL:

Act as a knowledgeable sales engineer who helps the right clients move forward, while maintaining a premium and expert positioning.
`;

function isEmailLike(text) {
  return text.includes("@") && text.includes(".");
}

async function sendLeadEmail(message, history) {
  const subject = "New 3D DFM chatbot lead";

  const conversation = (history || [])
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const text = `
New lead from chatbot

Contact details:
${message}

Conversation:
${conversation}
  `;

  await transporter.sendMail({
    from: process.env.ALERT_EMAIL_USER,
    to: process.env.LEAD_NOTIFY_TO,
    subject,
    text
  });
}

app.post("/chat", async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ reply: "Invalid message." });
    }

    if (isEmailLike(message)) {
      await sendLeadEmail(message, history || []);
      return res.json({
        reply: "Thanks, I've received your details. Ben will be in touch."
      });
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history || []),
      { role: "user", content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.4
    });

    const reply = completion.choices[0].message;

    res.json({
      reply: reply.content
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      reply: "There was an issue processing your request. Please try again."
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});