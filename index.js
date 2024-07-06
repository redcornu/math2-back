import express from 'express'; // Express 모듈을 불러옵니다.
import OpenAI from 'openai'; // OpenAI 모듈을 불러옵니다.
import dotenv from 'dotenv'; // 환경 변수 설정을 위한 dotenv 모듈을 불러옵니다.
import cors from 'cors'; // CORS 설정을 위한 cors 모듈을 불러옵니다.

dotenv.config(); // 환경 변수를 로드합니다.

const app = express(); // Express 애플리케이션을 생성합니다.
const PORT = process.env.PORT || 3000; // 서버가 사용할 포트를 설정합니다. 기본값은 3000입니다.

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); // OpenAI 인스턴스를 생성하고 API 키를 설정합니다.

// CORS 설정
const corsOptions = {
  origin: [
    "https://port-0-test-back-lxlts66g89582f3b.sel5.cloudtype.app",
    "https://web-math-front-lxlts66g89582f3b.sel5.cloudtype.app",
    "https://web-math-front-backup-lxlts66g89582f3b.sel5.cloudtype.app/",
    "http://localhost:3000",
  ], // 허용할 도메인 목록입니다.
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE", // 허용할 HTTP 메서드 목록입니다.
  credentials: true, // 자격 증명을 허용합니다.
  optionsSuccessStatus: 204, // 사전 검사 요청에 대한 성공 상태 코드입니다.
};

app.use(cors(corsOptions)); // CORS 미들웨어를 설정합니다.
app.use(express.json()); // JSON 형식의 요청 본문을 파싱하는 미들웨어를 추가합니다.

// Pre-flight 요청을 허용
app.options('*', cors(corsOptions)); // 모든 경로에 대해 OPTIONS 메서드를 허용합니다.

app.post('/solve-equation', async (req, res) => {
  const { equation } = req.body; // 요청 본문에서 방정식을 가져옵니다.

  try {
    // 개인 수학 선생님 Assistant를 생성합니다.
    const assistant = await openai.beta.assistants.create({
      name: "수학 선생님",
      instructions: "당신은 개인 수학 선생님입니다. 코드를 써서 수학 질문에 답해주세요. 친절하게 답해주세요.",
      tools: [{ type: "code_interpreter" }],
      model: "gpt-4o"
    });

    const thread = await openai.beta.threads.create(); // 새로운 쓰레드를 생성합니다.

    // 사용자가 입력한 방정식을 포함한 메시지를 생성합니다.
    await openai.beta.threads.messages.create(
      thread.id,
      {
        role: "user",
        content: `저는 방정식을 풀어야해요 \`${equation}\`. 도와줄 수 있나요?`
      }
    );

    let responseText = ''; // 응답 텍스트를 저장할 변수를 선언합니다.

    // 스트리밍 실행을 시작합니다.
    const run = openai.beta.threads.runs.stream(thread.id, {
      assistant_id: assistant.id
    });

    // 텍스트가 생성될 때마다 호출되는 이벤트 리스너입니다.
    run.on('textCreated', (text) => {
      console.log('\nassistant > ', text); // 생성된 텍스트를 콘솔에 출력합니다.
      responseText += text; // 응답 텍스트에 추가합니다.
    });

    // 텍스트 델타가 발생할 때마다 호출되는 이벤트 리스너입니다.
    run.on('textDelta', (textDelta) => {
      console.log(textDelta.value); // 텍스트 델타를 콘솔에 출력합니다.
      responseText += textDelta.value; // 응답 텍스트에 추가합니다.
    });

    // 툴 호출이 생성될 때마다 호출되는 이벤트 리스너입니다.
    run.on('toolCallCreated', (toolCall) => {
      console.log(`\nassistant > ${toolCall.type}\n\n`); // 툴 호출 타입을 콘솔에 출력합니다.
    });

    // 툴 호출 델타가 발생할 때마다 호출되는 이벤트 리스너입니다.
    run.on('toolCallDelta', (toolCallDelta) => {
      if (toolCallDelta.type === 'code_interpreter') { // 툴 호출 타입이 code_interpreter인 경우
        if (toolCallDelta.code_interpreter.input) { // 입력이 있는 경우
          console.log(toolCallDelta.code_interpreter.input); // 입력을 콘솔에 출력합니다.
          responseText += toolCallDelta.code_interpreter.input; // 응답 텍스트에 추가합니다.
        }
        if (toolCallDelta.code_interpreter.outputs) { // 출력이 있는 경우
          console.log("\noutput >\n"); // 출력 시작을 알리는 텍스트를 콘솔에 출력합니다.
          toolCallDelta.code_interpreter.outputs.forEach(output => {
            if (output.type === "logs") { // 출력 타입이 logs인 경우
              console.log(`\n${output.logs}\n`); // 로그를 콘솔에 출력합니다.
              responseText += output.logs; // 응답 텍스트에 로그를 추가합니다.
            }
          });
        }
      }
    });

    // 스트리밍 실행이 끝날 때 호출되는 이벤트 리스너입니다.
    run.on('end', () => {
      res.status(200).json({ response: responseText }); // 클라이언트에게 응답 텍스트를 JSON 형식으로 반환합니다.
    });

  } catch (error) {
    console.error(error); // 에러를 콘솔에 출력합니다.
    res.status(500).send('An error occurred'); // 클라이언트에게 에러 메시지를 반환합니다.
  }
});

// 서버 시작
app.listen(PORT, function () {
  console.log(`${PORT}번 포트에서 서버가 실행 중입니다.`); // 서버 시작 메시지를 콘솔에 출력합니다.
});
