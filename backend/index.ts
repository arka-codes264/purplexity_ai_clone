import express from "express";
import { tavily } from '@tavily/core';
import { SYSTEM_PROMPT, PROMPT_TEMPLATE } from "./prompt";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { prisma } from "./db";

const client = tavily({ apiKey: process.env.TAVILY_API_KEY }) // Go through the "tavily" docs to find the code and responce type
const app = express(); // this is for the api server

app.use(express.json());

// const res = await prisma.user.create({
//     data: {
//         email: "arka.ai.tech@gmail.com",
//         provider: "Github",
//         name: "Arka_Tech"
//     } 
// })

// console.log(res)

//Sign Up
app.post("/signup", async (req, res) => {

})

//Sign In
app.post("/signin", async (req, res) => {

})

//past Conversations get
app.get("/conversations", async (req, res) => {

})

//Past Conversations get by ID 
app.get("/conversation/:conversationsId", async (req, res) => {

})

app.post("/purplexity_ask", async (req, res) => {

    // Step 1 - get the query from the user
    const query = req.body.query;

    // Step 2 - make sure user has access or credit to hit the end point

    // Step 3 - web search to gather resources

    // Step 4 - do some context Engineering to the prompt + web search results
    const webSearchResponce = await client.search(query, {
        search_depth: "advanced",
        max_results: 3,
        include_images: false,
        include_raw_content: false,
    })

    const webSearchResult = webSearchResponce.results;

    // Step 5 - hit the LLM and stream Back the response

    // Step 6 - also stream back the sources and the follow up questions (Which can get from another parallel LLM call)

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

    const streamResult = await model.generateContentStream(prompt);

    // Set headers for streaming text
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");

    for await (const chunk of streamResult.stream) {
        const chunkText = chunk.text();
        res.write(chunkText);
    }

    res.end("-------sources---------\n")
    res.write("\n<SOURCES\n>")

    // Step 7 - end the stream and send the final response to the user
    res.write(JSON.stringify(webSearchResult));
    res.write("\n<SOURCES>\n")

    //end the stream 
    res.end();

});

app.post("/purplexity_follow_up", async (req, res) => {
    //Step 1 -get the existing chat from the DB
    //step 2 - Forword the full history to the LLM 
    //step 2.5 - TODO :- Do Context engineering to the history to make it understand the context
    //step 3 - Stream the responce to the User

});

app.listen(3000)