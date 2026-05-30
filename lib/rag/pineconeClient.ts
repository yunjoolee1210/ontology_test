import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || 'dummy_key',
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export interface PineconeMatch {
  id: string;
  score: number;
  metadata: {
    title?: string;
    abstract?: string;
    content?: string;
    url?: string;
    doi?: string;
    org?: string;
    disease?: string;
    [key: string]: any;
  };
}

export async function queryPinecone(
  indexName: string,
  queryText: string,
  topK: number = 5
): Promise<PineconeMatch[]> {
  try {
    if (!process.env.PINECONE_API_KEY || !process.env.OPENAI_API_KEY) {
      console.warn('Pinecone or OpenAI key missing. Returning empty array.');
      return [];
    }

    // 1. OpenAI를 사용하여 검색어 임베딩 생성 (1536 차원)
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: queryText,
    });

    const [{ embedding }] = embeddingResponse.data;

    // 2. Pinecone 검색
    const index = pc.index(indexName);
    const queryResponse = await index.query({
      vector: embedding,
      topK: topK,
      includeMetadata: true,
    });

    return (queryResponse.matches || []).map(match => ({
      id: match.id,
      score: match.score ?? 0,
      metadata: (match.metadata ?? {}) as any,
    }));
  } catch (error) {
    console.error(`Error querying Pinecone index ${indexName}:`, error);
    return [];
  }
}
