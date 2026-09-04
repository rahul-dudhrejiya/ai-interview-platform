import axios from "axios";

// NEW: switched from OpenRouter's free tier (~50 requests/day - way too
// low for a multi-question interview app, each interview burns through
// 7+ AI calls) to Groq. Groq's free tier is dramatically more generous
// (roughly 1,000+ requests/day depending on model, no credit card) and
// its API is OpenAI-compatible, so barely anything below had to change -
// same request/response shape, just a different base URL and API key.
export const askAi = async (messages) => {
    try {
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            throw new Error("Message array is empty.");
        }

        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                // BUG FIX (found during testing): "llama-3.3-70b-versatile"
                // was Groq's flagship free model when this file was first
                // written, but Groq DECOMMISSIONED it on Aug 16, 2026 -
                // requests to it now fail outright. Switched to Groq's own
                // recommended replacement. AI providers retire models
                // fairly often - if this one is EVER decommissioned too,
                // check https://console.groq.com/docs/deprecations for
                // the current recommended replacement and swap the model
                // string below. (This is exactly the kind of failure the
                // improved error handling below is designed to surface
                // immediately, instead of a generic unhelpful message.)
                model: "openai/gpt-oss-120b",
                messages: messages,
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json",
                },
                // BUG FIX (found during testing): there was NO timeout on this
                // request at all. If the AI provider is slow, rate-limited, or
                // the connection just stalls, axios would wait indefinitely —
                // the request never resolves AND never rejects. From the
                // frontend's point of view, "Submitting..." just hangs
                // forever with no error, because the promise chain never
                // completes. A 30s timeout means it WILL fail (and the
                // frontend catch block WILL fire) instead of hanging.
                timeout: 30000,
            }
        );

        // BUG FIX: OpenAI-compatible chat completion responses use the
        // singular key "message", not "messages". response.data.choices[0].messages
        // was always undefined, so content was always undefined too.
        let content = response?.data?.choices?.[0]?.message?.content;

        if (!content || !content.trim()) {
            // BUG FIX: this line referenced `error` which doesn't exist inside
            // the try block (it's only defined in the catch block below).
            // That would itself throw a ReferenceError before your real
            // error message even showed up.
            throw new Error("AI returned an empty response.");
        }

        // NEW (robustness): some models wrap JSON responses in markdown
        // code fences (```json ... ```) even when told not to. Every
        // caller of askAi() that expects JSON does JSON.parse(aiResponse)
        // right after this - an unstripped fence would make that throw.
        // Stripping it here fixes it for every caller at once.
        content = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

        return content;
    } catch (error) {
        // BUG FIX: `error.messages` (plural) doesn't exist on Error/axios
        // error objects — it's `error.message` (singular).
        console.error("Groq API Error:", error.response?.data || error.message);

        // NEW: surface a clearer, specific reason instead of one generic
        // string for every kind of failure - makes debugging (and showing
        // a useful message to the candidate) much easier.
        if (error.code === "ECONNABORTED") {
            throw new Error("AI request timed out. Please try again.");
        }
        if (error.response?.status === 401) {
            throw new Error("Groq API key is invalid or missing.");
        }
        if (error.response?.status === 429) {
            throw new Error(
                "Groq free-tier rate limit reached. Please wait a bit and try again."
            );
        }
        // NEW (found during testing): the fallback used to just say
        // "Groq API Error" for EVERYTHING else - including things like
        // "this model was decommissioned" or "invalid request format" -
        // which made real problems invisible until someone manually
        // checked the backend terminal. Groq (like OpenAI) returns a
        // specific human-readable reason at error.response.data.error.message
        // - surfacing that directly means the actual cause shows up right
        // on the candidate's screen instead of a dead-end generic string.
        const groqMessage = error.response?.data?.error?.message;
        throw new Error(groqMessage ? `Groq API Error: ${groqMessage}` : "Groq API Error");
    }
};