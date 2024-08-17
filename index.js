import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const corsOptions = {
  origin: [
    "https://port-0-test-back-lxlts66g89582f3b.sel5.cloudtype.app",
    "https://web-math-front-lxlts66g89582f3b.sel5.cloudtype.app",
    "https://web-math-front-backup-lxlts66g89582f3b.sel5.cloudtype.app/",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
  ],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(express.json());

app.options('*', cors(corsOptions));

app.post('/search-product', async (req, res) => {
  const { product_name, product_description, product_price } = req.body;

  try {
    const assistant = await openai.beta.assistants.create({
      name: "리뷰 메이커",
      instructions: "제품 정보를 바탕으로 상세하고 유용한 리뷰를 작성합니다.",
      model: "gpt-4o-mini"  // 또는 사용 가능한 최신 모델
    });

    const thread = await openai.beta.threads.create();

    await openai.beta.threads.messages.create(
      thread.id,
      {
        role: "user",
        content: `다음 제품에 대한 상세하고 유용한 리뷰를 작성해주세요:
        제품명: ${product_name}
        제품 설명: ${product_description}
        가격: ${product_price}원
        
        리뷰에는 다음 내용을 포함해주세요:
        1. 제품의 주요 특징
        2. 가격 대비 가치
        3. 장단점
        4. 사용 경험 예상
        5. 구매 추천 여부`
      }
    );

    const run = await openai.beta.threads.runs.create(
      thread.id,
      { assistant_id: assistant.id }
    );

    let runStatus = await openai.beta.threads.runs.retrieve(
      thread.id,
      run.id
    );

    while (runStatus.status !== 'completed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    const messages = await openai.beta.threads.messages.list(thread.id);

    const responseMessage = messages.data.find(message => message.role === 'assistant');
    
    if (responseMessage) {
      res.status(200).json({ response: responseMessage.content[0].text.value });
    } else {
      res.status(404).json({ error: '응답을 찾을 수 없습니다.' });
    }

  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred');
  }
});

app.listen(PORT, function () {
  console.log(`${PORT}번 포트에서 서버가 실행 중입니다.`);
});