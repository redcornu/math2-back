import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import cors from 'cors';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(
  cors({
    origin: [
      "https://port-0-test-back-lxlts66g89582f3b.sel5.cloudtype.app",
      "https://web-test-front-lxlts66g89582f3b.sel5.cloudtype.app",
      "http://localhost:3000",
    ],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: true,
  })
);

app.use(express.json());


app.post('/solve-equation', async (req, res) => {
  const { equation } = req.body;

  try {
    const assistant = await openai.beta.assistants.create({
      name: "Math Tutor",
      instructions: "You are a personal math tutor. Write and run code to answer math questions.",
      tools: [{ type: "code_interpreter" }],
      model: "gpt-4o"
    });

    const thread = await openai.beta.threads.create();

    await openai.beta.threads.messages.create(
      thread.id,
      {
        role: "user",
        content: `I need to solve the equation \`${equation}\`. Can you help me?`
      }
    );

    let responseText = '';

    const run = openai.beta.threads.runs.stream(thread.id, {
      assistant_id: assistant.id
    });

    run.on('textCreated', (text) => {
      console.log('\nassistant > ', text);
      responseText += text;  // Collecting the response text
    });

    run.on('textDelta', (textDelta) => {
      console.log(textDelta.value);
      responseText += textDelta.value;  // Collecting the response text
    });

    run.on('toolCallCreated', (toolCall) => {
      console.log(`\nassistant > ${toolCall.type}\n\n`);
    });

    run.on('toolCallDelta', (toolCallDelta) => {
      if (toolCallDelta.type === 'code_interpreter') {
        if (toolCallDelta.code_interpreter.input) {
          console.log(toolCallDelta.code_interpreter.input);
          responseText += toolCallDelta.code_interpreter.input;  // Collecting the response text
        }
        if (toolCallDelta.code_interpreter.outputs) {
          console.log("\noutput >\n");
          toolCallDelta.code_interpreter.outputs.forEach(output => {
            if (output.type === "logs") {
              console.log(`\n${output.logs}\n`);
              responseText += output.logs;  // Collecting the response text
            }
          });
        }
      }
    });

    run.on('end', () => {
      res.status(200).json({ response: responseText });
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred');
  }
});

// 서버 시작
app.listen(PORT, function () {
  console.log(`${PORT}번 포트에서 서버가 실행 중입니다.`);
});