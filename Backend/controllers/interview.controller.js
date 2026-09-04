import fs from "fs";
import { askAi } from "../services/openRouter.service.js";
import User from "../models/user.model.js";
import Interview from "../models/interview.model.js";
// NEW (Feature: Custom Company JD Upload) — shared helper now used by
// both analyzeResume and the new parseJD endpoint.
import { extractTextFromPDF } from "../utils/pdfExtract.js";
// NEW (Feature: Email PDF Report)
import { sendReportEmail } from "../services/email.service.js";

export const analyzeResume = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Resume required" });
        }
        const filepath = req.file.path;

        // BUG FIX (refactor): this PDF-parsing loop used to be inline here
        // (and had a broken nested .map() call: `item.map(item => item.str)`,
        // which isn't valid — text-content items don't have a .map method).
        // Extracted into extractTextFromPDF() so the same fixed logic can
        // be reused for JD parsing below, instead of copy-pasting it.
        const resumeText = await extractTextFromPDF(filepath);

        const messages = [
            {
                role: "system",
                content: `
            Extract structured data from resumeText.

            Return strictly JSON:

            {
            "role": "string",
            "experience": "string",
            "projects": ["project1", "project2"],
            "skills": ["skill1", "skill2"]
            }
            `,
            },
            {
                role: "user",
                content: resumeText,
            },
        ];

        const aiResponse = await askAi(messages);
        const parsed = JSON.parse(aiResponse);

        fs.unlinkSync(filepath);

        res.json({
            role: parsed.role,
            experience: parsed.experience,
            projects: parsed.projects,
            skills: parsed.skills,
            resumeText,
        });
    } catch (error) {
        console.error(error);

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({ message: error.message });
    }
};

// NEW (Feature: Custom Company JD Upload)
// Lets the candidate upload a company's job description as a PDF and get
// back the extracted plain text, same pattern as analyzeResume. No AI
// call needed here — the raw JD text itself is what gets fed into the
// question-generation prompt later.
export const parseJD = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Job description file required" });
        }
        const filepath = req.file.path;

        const jdText = await extractTextFromPDF(filepath);

        fs.unlinkSync(filepath);

        // Cap length so an unusually long JD PDF doesn't blow up prompt
        // size/cost later in generateQuestion.
        const trimmedJD = jdText.slice(0, 4000);

        res.json({ jdText: trimmedJD });
    } catch (error) {
        console.error(error);

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({ message: error.message });
    }
};

export const generateQuestion = async (req, res) => {
    try {
        // BUG FIX: `resumeTextm` typo -> `resumeText`
        // NEW (Feature: Custom Company JD Upload): accept optional jdText
        let { role, experience, mode, resumeText, projects, skills, jdText } =
            req.body;

        // BUG FIX: `.trim` (no call) -> `.trim()`
        role = role?.trim();
        experience = experience?.trim();
        mode = mode?.trim();

        // BUG FIX: `!rolw` typo -> `!role`
        if (!role || !experience || !mode) {
            // BUG FIX: `.json{...}` -> `.json({...})`
            return res
                .status(400)
                .json({ message: "Role, Experience and Mode are required." });
        }

        // BUG FIX (critical): in the original file, everything below this
        // point (user lookup, credit check, AI call, interview creation)
        // was accidentally nested INSIDE the `if (!role...)` block above —
        // meaning it only ran when validation FAILED, and never ran on the
        // happy path. It's now correctly placed after the guard clause,
        // at the top level of the function.

        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        if (user.credits < 50) {
            return res
                .status(400)
                .json({ message: "Not enough credits. Minimum 50 required." });
        }

        // BUG FIX: `.json(", ")` -> `.join(", ")` (Array has no .json method)
        const projectText =
            Array.isArray(projects) && projects.length
                ? projects.join(", ")
                : "None";

        const skillsText =
            Array.isArray(skills) && skills.length ? skills.join(", ") : "None";

        const safeResume = resumeText?.trim() || "None";
        // NEW (Feature: Custom Company JD Upload)
        const safeJD = jdText?.trim() ? jdText.trim().slice(0, 4000) : "";

        const userPrompt = `
            Role:${role}
            Experience:${experience}
            InterviewMode:${mode}
            Projects:${projectText}
            Skills:${skillsText}
            Resume:${safeResume}
            ${safeJD ? `TargetJobDescription:${safeJD}` : ""}
            `;

        if (!userPrompt.trim()) {
            return res.status(400).json({ message: "Prompt content is empty." });
        }

        // NEW (Feature: Coding Round Mode) — DSA/coding problems need a
        // completely different generation format from spoken interview
        // questions: they're multi-line (problem statement + example +
        // constraints), so splitting the AI response by "\n" (like the
        // normal questions below) would shred each problem into garbage
        // fragments. We ask the AI to separate problems with an explicit
        // "@@@" delimiter instead, and split on that.
        const isCodingRound = mode === "Coding";

        const messages = isCodingRound
            ? [
                {
                    role: "system",
                    content: `
You are a technical interviewer setting up a coding round for a candidate.

Generate exactly 5 coding problems appropriate for the candidate's role and experience level.

Strict Rules:
- Separate each problem with this EXACT delimiter on its own line: @@@
- The FIRST line of each problem must be exactly: Topic: <topic name>
  (e.g. "Topic: Arrays", "Topic: Dynamic Programming", "Topic: Strings",
  "Topic: Trees", "Topic: Sorting & Searching", "Topic: Recursion")
- After the Topic line, include: a short title, a clear problem
  statement, one example input, one example output, and any constraints.
- Keep each problem to 5-7 lines total (including the Topic line).
- Do NOT number the problems.
- Do NOT add any text before the first problem or after the last one.
- Do NOT wrap problems in markdown code blocks.

Difficulty progression:
Problem 1 -> easy
Problem 2 -> easy
Problem 3 -> medium
Problem 4 -> medium
Problem 5 -> hard

Base problems on the candidate's role, experience, projects, and skills where relevant (e.g. arrays/strings for freshers, system-design-adjacent coding for experienced candidates).

If a TargetJobDescription is provided below, prioritize it: lean the problems toward the specific technologies, data structures, or problem domains that job description emphasizes, over generic role-based guessing.
`,
                },
                { role: "user", content: userPrompt },
            ]
            : [
                {
                    role: "system",
                    content: `
You are a real human interviewer conducting a professional interview.

Speak in simple, natural English as if you are directly talking to the candidate.

Generate exactly 5 interview questions.

Strict Rules:
- Each question must contain between 15 and 25 words.
- Each question must be a single complete sentence.
- Each question MUST start with a topic tag in square brackets, then the
  question, like this: [Topic Name] Question text here.
  (e.g. "[Data Structures] Can you explain...", "[Communication Skills]
  Tell me about...", "[DBMS] How would you...", "[Projects] Walk me
  through...", "[System Design] How would you design...")
- Pick short, consistent topic names (2-3 words max) so they can be
  grouped later - things like "Data Structures", "OOP Concepts", "DBMS",
  "System Design", "Communication Skills", "Projects", "HR & Behavioral".
- Do NOT number them.
- Do NOT add explanations.
- Do NOT add extra text before or after.
- One question per line only.
- Keep language simple and conversational.
- Questions must feel practical and realistic.

Difficulty progression:
Question 1 -> easy
Question 2 -> easy
Question 3 -> medium
Question 4 -> medium
Question 5 -> hard

Make questions based on the candidate's role, experience, interviewMode, projects, skills, and resume details.

If a TargetJobDescription is provided below, prioritize it: ask about the specific skills, responsibilities, and requirements mentioned in that job description rather than generic questions for the role. Reference concrete technologies/requirements from it where natural.
`,
                },
                { role: "user", content: userPrompt },
            ];

        const aiResponse = await askAi(messages);

        if (!aiResponse || !aiResponse.trim()) {
            return res.status(500).json({ message: "AI returned empty response." });
        }

        const questionsArray = isCodingRound
            ? aiResponse
                .split("@@@")
                .map((q) => q.trim())
                .filter((q) => q.length > 0)
                .slice(0, 5)
            : aiResponse
                .split("\n")
                .map((q) => q.trim())
                .filter((q) => q.length > 0)
                .slice(0, 5);

        if (questionsArray.length === 0) {
            return res.status(500).json({ message: "AI failed to generate questions." });
        }

        // NEW (Feature: Weak-Topic Tracker) — pull the AI-assigned topic
        // tag out of each raw block so it can be stored separately and
        // aggregated later. If the AI ever forgets the tag (LLMs aren't
        // 100% obedient to format instructions), fall back to "General"
        // instead of crashing or losing the question.
        const parseTopic = (raw) => {
            if (isCodingRound) {
                // First line should be "Topic: <name>"
                const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
                const topicMatch = lines[0]?.match(/^Topic:\s*(.+)$/i);
                if (topicMatch) {
                    return {
                        topic: topicMatch[1].trim(),
                        text: lines.slice(1).join("\n"),
                    };
                }
                return { topic: "General", text: raw };
            }

            // Spoken interview: "[Topic Name] Question text..."
            const bracketMatch = raw.match(/^\[(.+?)\]\s*(.*)$/);
            if (bracketMatch) {
                return { topic: bracketMatch[1].trim(), text: bracketMatch[2].trim() };
            }
            return { topic: "General", text: raw };
        };

        const parsedQuestions = questionsArray.map(parseTopic);

        // BUG FIX: `user.credits = -50` was OVERWRITING credits with -50
        // every time, instead of deducting 50 from the existing balance.
        user.credits -= 50;
        await user.save();

        // NEW: coding problems need much longer per-question time limits
        // than spoken answers (writing + testing code takes minutes, not
        // seconds) - 5/5/10/10/15 minutes vs 60/60/90/90/120 seconds.
        const timeLimits = isCodingRound
            ? [300, 300, 600, 600, 900]
            : [60, 60, 90, 90, 120];

        const interview = await Interview.create({
            userId: user._id,
            role,
            experience,
            mode,
            resumeText: safeResume,
            // NEW (Feature: Custom Company JD Upload)
            jdText: safeJD || undefined,
            questions: parsedQuestions.map((parsed, index) => ({
                question: parsed.text,
                topic: parsed.topic,
                // BUG FIX: array only had 4 items ["easy","easy","medium","hard"]
                // for 5 questions (index 4 would be undefined). Matches the
                // stated difficulty progression now.
                difficulty: ["easy", "easy", "medium", "medium", "hard"][index],
                timeLimit: timeLimits[index],
            })),
        });

        res.json({
            interviewId: interview._id,
            creditsLeft: user.credits,
            userName: user.name,
            // NEW: frontend needs this to decide whether to render the
            // voice-based Step2Interview flow or the CodingRound editor.
            mode: interview.mode,
            // NEW (Feature: Custom Company JD Upload)
            isJDBased: !!safeJD,
            questions: interview.questions,
        });
    } catch (error) {
        return res.status(500).json({ message: `Failed to create interview: ${error}` });
    }
};

export const submitAnswer = async (req, res) => {
    try {
        const {
            interviewId,
            questionIndex,
            answer,
            timeTaken,
            codeLanguage,
            // NEW (Feature: Webcam Confidence Detection)
            eyeContactPercentage,
            dominantExpression,
        } = req.body;

        const interview = await Interview.findById(interviewId);
        const question = interview.questions[questionIndex];

        // If no answer
        if (!answer) {
            question.score = 0;
            question.feedback = "You did not submit an answer";
            question.answer = "";

            await interview.save();

            return res.json({ feedback: question.feedback });
        }

        // BUG FIX: in the original file, this "time exceeded" check and
        // everything after it (AI evaluation, save, response) was nested
        // INSIDE the `if (!answer)` block above, so it only ran when there
        // was NO answer — which is backwards. It's now at the top level,
        // running for every submitted answer.

        // If time exceeded
        if (timeTaken > question.timeLimit) {
            question.score = 0;
            question.feedback = "Time limit exceeded. Answer not evaluated.";
            question.answer = answer;

            await interview.save();

            return res.json({ feedback: question.feedback });
        }

        // NEW (Feature: Coding Round Mode): filler-word/pace analysis only
        // makes sense for spoken answers, not submitted code. Skip it
        // entirely when this interview is a coding round.
        const isCodingRound = interview.mode === "Coding";

        let fillerWordCount = 0;
        let pace = "unknown";
        let wordsPerMinute = 0;

        if (!isCodingRound) {
            // ---------- Filler-word & Pace Analysis ----------
            // Deterministic (not AI-based) so it's fast, free, and consistent.
            const FILLER_WORDS = [
                "um",
                "umm",
                "uh",
                "uhh",
                "like",
                "you know",
                "actually",
                "basically",
                "literally",
                "kind of",
                "sort of",
                "i mean",
            ];

            const lowerAnswer = answer.toLowerCase();
            fillerWordCount = FILLER_WORDS.reduce((count, phrase) => {
                // \b word-boundary regex so "like" doesn't match inside "likely"
                const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const regex = new RegExp(`\\b${escaped}\\b`, "g");
                const matches = lowerAnswer.match(regex);
                return count + (matches ? matches.length : 0);
            }, 0);

            const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
            const minutesTaken = timeTaken > 0 ? timeTaken / 60 : 0;
            wordsPerMinute = minutesTaken > 0 ? wordCount / minutesTaken : 0;

            // Typical interview speaking-pace guideline: ~110-160 WPM is
            // considered clear and confident for spoken (not read) answers.
            if (wordsPerMinute > 0) {
                if (wordsPerMinute < 100) pace = "too slow";
                else if (wordsPerMinute > 170) pace = "too fast";
                else pace = "ideal";
            }
            // --------------------------------------------------------
        }

        // NEW (Feature: Coding Round Mode): completely different AI
        // evaluation prompt for code submissions. The (confidence,
        // communication, correctness) score triad is reused so the rest
        // of the schema/report pipeline doesn't need extra fields — for
        // coding rounds those three are re-purposed as
        // (efficiency, code quality, correctness). The frontend relabels
        // them based on `report.mode` (see Step3Report.jsx).
        const messages = isCodingRound
            ? [
                {
                    role: "system",
                    content: `
You are a senior software engineer reviewing a candidate's code submission in a technical interview.

Evaluate the submitted code fairly and realistically.

Score these areas (0 to 10):

1. confidence -> Efficiency: Is the time/space complexity reasonable for the problem?
2. communication -> Code Quality: Is the code readable, well-named, and reasonably structured?
3. correctness -> Correctness: Does the logic actually solve the problem, including edge cases?

Rules:
- Be realistic and unbiased. Do not give random high scores.
- If the code has bugs or wrong logic, score correctness low.
- If the code is messy or has no meaningful structure, score code quality low.
- If the code has poor time/space complexity for the problem size, score efficiency low.

Calculate:
finalScore = average of confidence, communication, and correctness (rounded to nearest whole number).

Feedback Rules:
- Write natural, constructive code-review feedback.
- 15 to 25 words.
- Briefly mention the Big-O time complexity you observe.
- Can suggest one concrete improvement if needed.
- Do NOT repeat the problem statement.
- Keep tone professional and honest.

Return ONLY valid JSON in this format:

{
  "confidence": number,
  "communication": number,
  "correctness": number,
  "finalScore": number,
  "feedback": "short code review feedback"
}
`,
                },
                {
                    role: "user",
                    content: `
Problem: ${question.question}
Language: ${codeLanguage || "Not specified"}
Submitted Code:
${answer}
`,
                },
            ]
            : [
                {
                    role: "system",
                    content: `
You are a professional human interviewer evaluating a candidate's answer in a real interview.

Evaluate naturally and fairly, like a real person would.

Score the answer in these areas (0 to 10):

1. Confidence - Does the answer sound clear, confident, and well-presented?
2. Communication - Is the language simple, clear, and easy to understand?
3. Correctness - Is the answer accurate, relevant, and complete?

Rules:
- Be realistic and unbiased.
- Do not give random high scores.
- If the answer is weak, score low.
- If the answer is strong and detailed, score high.
- Consider clarity, structure, and relevance.

Calculate:
finalScore = average of confidence, communication, and correctness (rounded to nearest whole number).

Feedback Rules:
- Write natural human feedback.
- 10 to 15 words only.
- Sound like real interview feedback.
- Can suggest improvement if needed.
- Do NOT repeat the question.
- Do NOT explain scoring.
- Keep tone professional and honest.

Follow-up Question Rule (NEW):
- If, and ONLY if, the answer is weak or incomplete (roughly finalScore
  below 6), write ONE short, natural follow-up question that a real
  interviewer would ask to probe deeper on the SAME topic - e.g. asking
  for a concrete example, clarifying a vague point, or asking "why" about
  something they said.
- The follow-up must be 10-20 words, a single sentence, conversational.
- If the answer is already strong (finalScore 6 or above), set
  "followUpQuestion" to an empty string "" - do NOT force a follow-up on
  a good answer.

Return ONLY valid JSON in this format:

{
  "confidence": number,
  "communication": number,
  "correctness": number,
  "finalScore": number,
  "feedback": "short human feedback",
  "followUpQuestion": "short follow-up question, or empty string"
}
`,
                },
                {
                    role: "user",
                    content: `
Question: ${question.question}
Answer: ${answer}
Filler words detected: ${fillerWordCount}
Speaking pace: ${pace}${wordsPerMinute > 0 ? ` (~${Math.round(wordsPerMinute)} words per minute)` : ""}
${eyeContactPercentage !== undefined && eyeContactPercentage !== null
                            ? `Eye contact with camera: ${eyeContactPercentage}% of the time\nFacial expression while answering: ${dominantExpression || "unknown"}`
                            : ""
                        }

If filler words are high (3+) or pace is "too fast"/"too slow", you may briefly mention it in the feedback as a natural coaching tip. If eye contact is notably low (under 50%) or the expression suggests nervousness (e.g. "fearful", "sad"), you may briefly and kindly mention it too. Otherwise don't force any of this in.
`,
                },
            ];

        const aiResponse = await askAi(messages);
        const parsed = JSON.parse(aiResponse);

        question.answer = answer;
        question.confidence = parsed.confidence;
        question.communication = parsed.communication;
        question.correctness = parsed.correctness;
        question.score = parsed.finalScore;
        question.feedback = parsed.feedback;
        // NEW: save the deterministic filler-word/pace metrics (0/"unknown"
        // for coding rounds, real values for spoken interviews)
        question.fillerWordCount = fillerWordCount;
        question.pace = pace;
        // NEW (Feature: Webcam Confidence Detection) — only meaningful for
        // spoken interviews (candidate is facing the camera), and only
        // present if the candidate granted camera permission client-side.
        if (!isCodingRound) {
            question.eyeContactPercentage =
                eyeContactPercentage !== undefined ? eyeContactPercentage : null;
            question.dominantExpression = dominantExpression || null;
        }
        // NEW (Feature: AI Follow-up Questions) — only spoken-interview
        // answers get follow-ups (coding rounds already get deep,
        // structured code review, so a follow-up there is redundant).
        if (!isCodingRound && parsed.followUpQuestion && parsed.followUpQuestion.trim()) {
            question.followUp = { question: parsed.followUpQuestion.trim() };
        }
        // NEW: which language the candidate coded in (only for Coding mode)
        if (isCodingRound) {
            question.codeLanguage = codeLanguage || "unknown";
        }

        await interview.save();

        return res.status(200).json({
            feedback: parsed.feedback,
            fillerWordCount,
            pace,
            // NEW (Feature: AI Follow-up Questions)
            followUpQuestion: question.followUp?.question || null,
        });
    } catch (error) {
        return res.status(500).json({ message: `Failed to submit answer: ${error}` });
    }
};

// NEW (Feature: AI Follow-up Questions)
// Evaluates the candidate's response to the AI-generated follow-up
// question (only exists when submitAnswer decided the original answer
// was weak enough to probe deeper). Kept as a lightweight, separate
// evaluation — it does NOT affect the main finalScore/report averages,
// it's a supplementary "here's how you did when pushed further" insight.
export const submitFollowUp = async (req, res) => {
    try {
        const { interviewId, questionIndex, answer } = req.body;

        const interview = await Interview.findById(interviewId);
        if (!interview) {
            return res.status(404).json({ message: "Interview not found" });
        }

        const question = interview.questions[questionIndex];
        if (!question || !question.followUp || !question.followUp.question) {
            return res
                .status(400)
                .json({ message: "No follow-up question exists for this answer." });
        }

        if (!answer || !answer.trim()) {
            question.followUp.answer = "";
            question.followUp.feedback = "You did not answer the follow-up question.";
            question.followUp.score = 0;
            await interview.save();
            return res.json({ feedback: question.followUp.feedback });
        }

        const messages = [
            {
                role: "system",
                content: `
You are a professional interviewer who just asked a candidate a follow-up
question to probe deeper on something they said earlier.

Evaluate how well the follow-up answer clarifies or improves on their
original response.

Score correctness/depth (0 to 10).

Feedback Rules:
- 10 to 15 words, natural and encouraging but honest.
- Do NOT repeat the question.

Return ONLY valid JSON in this format:
{
  "score": number,
  "feedback": "short feedback"
}
`,
            },
            {
                role: "user",
                content: `
Original Question: ${question.question}
Original Answer: ${question.answer}
Follow-up Question: ${question.followUp.question}
Follow-up Answer: ${answer}
`,
            },
        ];

        const aiResponse = await askAi(messages);
        const parsed = JSON.parse(aiResponse);

        question.followUp.answer = answer;
        question.followUp.feedback = parsed.feedback;
        question.followUp.score = parsed.score;

        await interview.save();

        return res.status(200).json({ feedback: parsed.feedback });
    } catch (error) {
        return res
            .status(500)
            .json({ message: `Failed to submit follow-up answer: ${error}` });
    }
};

export const finishInterview = async (req, res) => {
    try {
        const { interviewId } = req.body;
        const interview = await Interview.findById(interviewId);
        if (!interview) {
            return res.status(400).json({ message: "Failed to find interview" });
        }

        // BUG FIX: schema field is `questions` (plural), not `question`.
        const totalQuestions = interview.questions.length;

        let totalScore = 0;
        let totalConfidence = 0;
        let totalCommunication = 0;
        let totalCorrectness = 0;

        // BUG FIX: original re-declared `let totalScore` etc. INSIDE the
        // forEach callback, which shadows the outer variables — so the
        // outer totals stayed 0 forever no matter what. Now using `+=`
        // on the outer variables without re-declaring them.
        interview.questions.forEach((q) => {
            totalScore += q.score || 0;
            totalConfidence += q.confidence || 0;
            totalCommunication += q.communication || 0;
            totalCorrectness += q.correctness || 0;
        });

        const finalScore = totalQuestions ? totalScore / totalQuestions : 0;
        const avgConfidence = totalQuestions ? totalConfidence / totalQuestions : 0;
        const avgCorrectness = totalQuestions ? totalCorrectness / totalQuestions : 0;
        const avgCommunication = totalQuestions
            ? totalCommunication / totalQuestions
            : 0;

        interview.finalScore = finalScore;
        interview.status = "completed";

        await interview.save();

        return res.status(200).json({
            finalScore: Number(finalScore.toFixed(1)),
            confidence: Number(avgConfidence.toFixed(1)),
            // BUG FIX: stray semicolon instead of comma inside object literal
            communication: Number(avgCommunication.toFixed(1)),
            correctness: Number(avgCorrectness.toFixed(1)),
            // NEW: frontend needs `mode` to relabel Confidence/Communication
            // as Efficiency/Code Quality for coding-round reports.
            mode: interview.mode,
            questionWinScore: interview.questions.map((q) => ({
                question: q.question,
                score: q.score || 0,
                feedback: q.feedback || "",
                confidence: q.confidence || 0,
                communication: q.communication || 0,
                correctness: q.correctness || 0,
                fillerWordCount: q.fillerWordCount || 0,
                pace: q.pace || "unknown",
                // NEW (Feature: Webcam Confidence Detection)
                eyeContactPercentage: q.eyeContactPercentage ?? null,
                dominantExpression: q.dominantExpression || null,
                // NEW: include the submitted code + language so the report
                // can display what the candidate actually wrote.
                answer: q.answer || "",
                codeLanguage: q.codeLanguage || "",
                // NEW (Feature: AI Follow-up Questions)
                followUp: q.followUp?.question
                    ? {
                        question: q.followUp.question,
                        answer: q.followUp.answer || "",
                        feedback: q.followUp.feedback || "",
                        score: q.followUp.score,
                    }
                    : null,
            })),
        });
    } catch (error) {
        return res.status(500).json({ message: `Failed to finish interview: ${error}` });
    }
};

export const getMyInterviews = async (req, res) => {
    try {
        // BUG FIX: `Status` -> `status` (case-sensitive field name from schema)
        const interviews = await Interview.find({ userId: req.userId })
            .sort({ createdAt: -1 })
            .select("role experience mode finalScore status createdAt");

        // BUG FIX: variable was declared as `interview` but the response
        // referenced `interviews` (undefined) -> ReferenceError.
        return res.status(200).json(interviews);
    } catch (error) {
        return res
            .status(500)
            .json({ message: `Failed to find current user's interviews: ${error}` });
    }
};

export const getInterviewReport = async (req, res) => {
    try {
        // BUG FIX: route is `/report/:id`, so the param is `req.params.id`,
        // not `req.params.difficulty` (which doesn't exist on this route).
        const interview = await Interview.findById(req.params.id);

        if (!interview) {
            return res.status(404).json({ message: "Interview not found" });
        }

        // BUG FIX: `interview.question` -> `interview.questions`
        const totalQuestions = interview.questions.length;

        let totalConfidence = 0;
        let totalCommunication = 0;
        let totalCorrectness = 0;

        // BUG FIX: same shadowing issue as finishInterview - use += on
        // outer variables instead of re-declaring with `let` inside forEach.
        interview.questions.forEach((q) => {
            totalConfidence += q.confidence || 0;
            totalCommunication += q.communication || 0;
            totalCorrectness += q.correctness || 0;
        });

        const avgConfidence = totalQuestions ? totalConfidence / totalQuestions : 0;
        const avgCorrectness = totalQuestions ? totalCorrectness / totalQuestions : 0;
        const avgCommunication = totalQuestions
            ? totalCommunication / totalQuestions
            : 0;

        return res.json({
            finalScore: interview.finalScore,
            confidence: Number(avgConfidence.toFixed(1)),
            communication: Number(avgCommunication.toFixed(1)),
            correctness: Number(avgCorrectness.toFixed(1)),
            // NEW: same reason as finishInterview - frontend relabels
            // fields based on mode.
            mode: interview.mode,
            questionWinScore: interview.questions,
        });
    } catch (error) {
        return res
            .status(500)
            .json({ message: `Failed to find interview report: ${error}` });
    }
};

// NEW (Feature: Weak-Topic Tracker)
// Aggregates scores by topic across ALL of the user's past interviews
// (any mode, any status) so they can see patterns like "you consistently
// score low on System Design" rather than just per-interview numbers.
export const getWeakTopics = async (req, res) => {
    try {
        const interviews = await Interview.find({ userId: req.userId });

        // topic -> { totalScore, count }
        const topicStats = {};

        interviews.forEach((interview) => {
            interview.questions.forEach((q) => {
                // Skip questions that were never answered/scored (e.g. the
                // candidate abandoned the interview partway through).
                if (q.score === undefined || q.score === null) return;
                if (!q.answer) return;

                const topic = q.topic || "General";
                if (!topicStats[topic]) {
                    topicStats[topic] = { totalScore: 0, count: 0 };
                }
                topicStats[topic].totalScore += q.score;
                topicStats[topic].count += 1;
            });
        });

        const topics = Object.entries(topicStats)
            .map(([topic, stats]) => {
                const avgScore = Number((stats.totalScore / stats.count).toFixed(1));
                let status = "moderate";
                if (avgScore < 6) status = "weak";
                else if (avgScore >= 8) status = "strong";

                return {
                    topic,
                    avgScore,
                    questionCount: stats.count,
                    status,
                };
            })
            // Weakest topics first - that's the whole point of the feature.
            .sort((a, b) => a.avgScore - b.avgScore);

        return res.json({ topics });
    } catch (error) {
        return res
            .status(500)
            .json({ message: `Failed to compute weak topics: ${error}` });
    }
};

// NEW (Feature: Email PDF Report)
// SECURITY NOTE: this intentionally does NOT accept an arbitrary "email"
// field from the request body. If it did, this endpoint would become an
// open mail-relay - anyone could get our server to send an attachment to
// any address they choose (spam/phishing vector). Instead it always
// looks up the logged-in user's own registered email from the DB.
export const emailReport = async (req, res) => {
    try {
        const { pdfBase64 } = req.body;

        if (!pdfBase64) {
            return res.status(400).json({ message: "PDF data is required." });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const pdfBuffer = Buffer.from(pdfBase64, "base64");

        // Sanity-check size so someone can't send a huge payload through
        // this endpoint (jsPDF reports are small, a few hundred KB at most).
        if (pdfBuffer.length > 10 * 1024 * 1024) {
            return res.status(400).json({ message: "PDF is too large to email." });
        }

        await sendReportEmail({ to: user.email, name: user.name, pdfBuffer });

        return res.json({ message: `Report sent to ${user.email}` });
    } catch (error) {
        return res
            .status(500)
            .json({ message: `Failed to email report: ${error}` });
    }
};

// NEW (Feature: Leaderboard / Peer Benchmarking)
// PRIVACY NOTE: this never exposes another user's full name, email, or
// any other PII to the requester. Every other candidate's display name
// is reduced to "First L." (first name + last-initial) before it leaves
// the server - the current user only ever sees their OWN full identity.
export const getLeaderboard = async (req, res) => {
    try {
        // Rank by each user's personal-best finalScore across all their
        // completed interviews (any mode). Using "best" rather than
        // "average" so someone's early rough-practice attempts don't drag
        // down a rank they've since improved past.
        const results = await Interview.aggregate([
            { $match: { status: "completed" } },
            {
                $group: {
                    _id: "$userId",
                    bestScore: { $max: "$finalScore" },
                    interviewCount: { $sum: 1 },
                },
            },
            { $sort: { bestScore: -1 } },
        ]);

        if (results.length === 0) {
            return res.json({
                leaderboard: [],
                yourRank: null,
                totalRankedUsers: 0,
            });
        }

        const userIds = results.map((r) => r._id);
        const users = await User.find({ _id: { $in: userIds } }).select("name");
        const userMap = new Map(users.map((u) => [u._id.toString(), u.name]));

        const anonymize = (fullName) => {
            if (!fullName) return "Anonymous Candidate";
            const parts = fullName.trim().split(/\s+/);
            const first = parts[0];
            const lastInitial = parts.length > 1 ? `${parts[parts.length - 1][0].toUpperCase()}.` : "";
            return lastInitial ? `${first} ${lastInitial}` : first;
        };

        const ranked = results.map((r, index) => ({
            rank: index + 1,
            userId: r._id.toString(),
            displayName: anonymize(userMap.get(r._id.toString())),
            bestScore: Number(r.bestScore.toFixed(1)),
            interviewCount: r.interviewCount,
        }));

        const requesterId = req.userId.toString();
        const yourEntry = ranked.find((r) => r.userId === requesterId);

        // The requester's own row gets their real name (not anonymized -
        // it's their own data) and an `isYou` flag for the frontend to
        // highlight it.
        const leaderboard = ranked.slice(0, 10).map((r) => ({
            rank: r.rank,
            displayName:
                r.userId === requesterId ? userMap.get(r.userId) || "You" : r.displayName,
            bestScore: r.bestScore,
            isYou: r.userId === requesterId,
        }));

        const yourRank = yourEntry
            ? {
                rank: yourEntry.rank,
                bestScore: yourEntry.bestScore,
                interviewCount: yourEntry.interviewCount,
                percentile: Math.round(
                    ((ranked.length - yourEntry.rank) / ranked.length) * 100
                ),
            }
            : null; // user hasn't completed any interview yet

        return res.json({
            leaderboard,
            yourRank,
            totalRankedUsers: ranked.length,
        });
    } catch (error) {
        return res
            .status(500)
            .json({ message: `Failed to compute leaderboard: ${error}` });
    }
};