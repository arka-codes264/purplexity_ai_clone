import express from "express";
import { tavily } from '@tavily/core';
import { SYSTEM_PROMPT, PROMPT_TEMPLATE } from "./prompt";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { prisma } from "./db";
import cors from "cors";
import { middleware } from "./middleware";

const client = tavily({ apiKey: process.env.TAVILY_API_KEY }) // Go through the "tavily" docs to find the code and responce type
const app = express(); // this is for the api server

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
    res.send("Perplexity AI Backend is running!");
});

// PROCESS 
//Sign Up
app.post("/signup", async (req, res) => {
    res.status(400).json({ message: "Auth is handled by Supabase on the client side" });
})

//Sign In
app.post("/signin", async (req, res) => {
    res.status(400).json({ message: "Auth is handled by Supabase on the client side" });
})

//past Conversations get
app.get("/conversations", middleware, async (req, res) => {
    try {
        const conversations = await prisma.conversation.findMany({
            where: { userId: req.userId! },
            select: { id: true, title: true, slug: true }
        });
        res.json(conversations);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch conversations" });
    }
})

//Past Conversations get by ID 
app.get("/conversation/:conversationsId", middleware, async (req, res) => {
    try {
        const conversation = await prisma.conversation.findFirst({
            where: {
                id: req.params.conversationsId,
                userId: req.userId!
            },
            include: {
                messages: { orderBy: { createdAt: "asc" } }
            }
        });

        if (!conversation) {
            res.status(404).json({ message: "Conversation not found" });
            return;
        }
        res.json(conversation);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch conversation" });
    }
})

app.post("/perplexity_ask", middleware, async (req, res) => {

    // Step 1 - get the query from the user
    const query = req.body.query;
    const userId = req.userId!;

    // Step 2 - make sure user has access or credit to hit the end point

    // Step 3 - web search to gather resources
    const webSearchResponce = await client.search(query, {
        search_depth: "advanced",
        max_results: 3,
        include_images: false,
        include_raw_content: false,
    })

    const webSearchResult = webSearchResponce.results;

    // Save initial conversation and message to DB
    const conversation = await prisma.conversation.create({
        data: {
            title: query.substring(0, 50),
            slug: query.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50),
            userId: userId,
            messages: {
                create: {
                    content: query,
                    role: "User"
                }
            }
        }
    });

    // Step 4 - do some context Engineering to the prompt + web search results
    // hit the llm? llm api/openrouter/vercel ai gateway
    // ✅ Init Gemini client (free API key from aistudio.google.com)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    const prompt = PROMPT_TEMPLATE
        .replace('{{WEB_SEARCH_RESULT}}', JSON.stringify(webSearchResult))
        .replace('{{USER_QUERY}}', query);

    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        systemInstruction: SYSTEM_PROMPT,
    });

    // Step 5 - hit the LLM and stream Back the response
    const streamResult = await model.generateContentStream(prompt);

    // Set headers for streaming text
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");

    let fullResponse = "";
    for await (const chunk of streamResult.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        res.write(chunkText);
    }

    // Step 6 - also stream back the sources and the follow up questions (Which can get from another parallel LLM call)
    res.write("\n-------sources---------\n")
    res.write("<SOURCES>\n")
    res.write(JSON.stringify(webSearchResult));
    res.write("\n</SOURCES>\n")

    res.write("<CONVERSATION_ID>\n")
    res.write(conversation.id);
    res.write("\n</CONVERSATION_ID>\n")

    // Generate follow-ups
    try {
        const followUpPrompt = `Based on the following user query and the assistant's response, suggest 3 relevant follow-up questions the user could ask. Return ONLY a JSON array of strings, e.g. ["question 1", "question 2", "question 3"].\n\nQuery: ${query}\nResponse: ${fullResponse}`;
        const followUpResult = await model.generateContent(followUpPrompt);
        let followUpText = followUpResult.response.text().replace(/```json/g, "").replace(/```/g, "").trim();

        try {
            JSON.parse(followUpText); // Validate JSON
            res.write("<FOLLOW_UPS>\n")
            res.write(followUpText);
            res.write("\n</FOLLOW_UPS>\n")
        } catch (e) {
            console.error("Invalid follow-up JSON:", followUpText);
        }
    } catch (e) {
        console.error("Error generating follow-ups", e);
    }

    // Step 7 - end the stream and send the final response to the user
    res.end();

    // Save assistant response to DB
    await prisma.message.create({
        data: {
            content: fullResponse,
            role: "Assistant",
            conversationId: conversation.id
        }
    });
});

app.post("/perplexity_follow_up", middleware, async (req, res) => {
    const { conversationId, query } = req.body;
    const userId = req.userId!;

    //Step 1 -get the existing chat from the DB
    const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: userId },
        include: { messages: { orderBy: { createdAt: 'asc' } } }
    });

    if (!conversation) {
        res.status(404).json({ message: "Conversation not found" });
        return;
    }

    // Save user's follow-up message to DB
    await prisma.message.create({
        data: {
            content: query,
            role: "User",
            conversationId: conversation.id
        }
    });

    // Do web search for the new query
    const webSearchResponce = await client.search(query, {
        search_depth: "advanced",
        max_results: 3,
        include_images: false,
        include_raw_content: false,
    });
    const webSearchResult = webSearchResponce.results;

    //step 2 - Forword the full history to the LLM 
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        systemInstruction: SYSTEM_PROMPT,
    });

    //step 2.5 - Do Context engineering to the history to make it understand the context
    const history = conversation.messages.map(msg => ({
        role: msg.role === "User" ? "user" : "model",
        parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({
        history: history,
    });

    const prompt = PROMPT_TEMPLATE
        .replace('{{WEB_SEARCH_RESULT}}', JSON.stringify(webSearchResult))
        .replace('{{USER_QUERY}}', query);

    //step 3 - Stream the responce to the User
    const streamResult = await chat.sendMessageStream(prompt);

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");

    let fullResponse = "";
    for await (const chunk of streamResult.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        res.write(chunkText);
    }

    res.write("\n-------sources---------\n")
    res.write("<SOURCES>\n")
    res.write(JSON.stringify(webSearchResult));
    res.write("\n</SOURCES>\n")

    // Generate follow-ups
    try {
        const followUpPrompt = `Based on the following user query and the assistant's response, suggest 3 relevant follow-up questions the user could ask. Return ONLY a JSON array of strings, e.g. ["question 1", "question 2", "question 3"].\n\nQuery: ${query}\nResponse: ${fullResponse}`;
        const followUpResult = await model.generateContent(followUpPrompt);
        let followUpText = followUpResult.response.text().replace(/```json/g, "").replace(/```/g, "").trim();

        try {
            JSON.parse(followUpText); // Validate JSON
            res.write("<FOLLOW_UPS>\n")
            res.write(followUpText);
            res.write("\n</FOLLOW_UPS>\n")
        } catch (e) {
            console.error("Invalid follow-up JSON:", followUpText);
        }
    } catch (e) {
        console.error("Error generating follow-ups", e);
    }

    res.end();

    // Save assistant response to DB
    await prisma.message.create({
        data: {
            content: fullResponse,
            role: "Assistant",
            conversationId: conversation.id
        }
    });
});

app.listen(3000)