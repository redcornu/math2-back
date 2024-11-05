import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const corsOptions = {
  origin: [
    "https://port-0-test-back-lxlts66g89582f3b.sel5.cloudtype.app",
    "https://web-math-front-lxlts66g89582f3b.sel5.cloudtype.app",
    "https://web-math-front-backup-lxlts66g89582f3b.sel5.cloudtype.app",
    "https://port-0-math2-back-lxlts66g89582f3b.sel5.cloudtype.app",
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

async function searchDuckDuckGo(query) {
  try {
    console.log('Searching for:', query);
    const response = await axios.get('https://lite.duckduckgo.com/lite/', {
      params: {
        q: query
      }
    });

    console.log('Raw HTML received:', response.data.substring(0, 200));

    const $ = cheerio.load(response.data);
    const searchResults = [];

    $('table.result-table').each((i, element) => {
      const title = $(element).find('td.result-title').text().trim();
      const snippet = $(element).find('td.result-snippet').text().trim();
      if (title && snippet) {
        searchResults.push({
          title: title,
          snippet: snippet
        });
      }
    });

    console.log('Parsed search results:', searchResults);

    return searchResults.slice(0, 3);
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

app.post('/search-product', async (req, res) => {
  const { product_name } = req.body;

  console.log('Received request for product:', product_name);

  try {
    const searchResults = await searchDuckDuckGo(product_name);
    console.log('Search results count:', searchResults.length);

    const searchContext = searchResults
      .map(result => `${result.title}\n${result.snippet}`)
      .join('\n\n');

    const assistant = await openai.beta.assistants.create({
      name: "리뷰 메이커",
      instructions: "검색 결과를 바탕으로 상세하고 유용한 리뷰를 작성합니다.",
      model: "gpt-4o-mini"
    });

    const thread = await openai.beta.threads.create();

    await openai.beta.threads.messages.create(
      thread.id,
      {
        role: "user",
        content: `다음 제품에 대한 상세한 리뷰를 작성. 중간중간 오타를 섞어쓰고, 할게용, 그렇더라구요 등의 말투를 사용.
        
        
        제품명: ${product_name}

        검색을 통해 수집된 정보:
        ${searchContext}
        
        위 정보들을 종합하여 다음 내용을 포함한 리뷰를 작성해주세요:
        1. 제품의 주요 특징
        2. 장단점
        3. 구매 추천 여부
        4. 사용 후기`
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
      res.status(200).json({ 
        response: responseMessage.content[0].text.value,
        searchResults: searchResults 
      });
    } else {
      res.status(404).json({ error: '응답 찾을 수 없습니다.' });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      error: 'An error occurred',
      details: error.message 
    });
  }
});

app.listen(PORT, function () {
  console.log(`${PORT}번 포트에서 서버가 실행 중입니다.`);
});