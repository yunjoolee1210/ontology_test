export interface UnifiedDocument {
  id: string;
  title: string;
  content: string;
  url?: string;
  doi?: string;
  org?: string;
  sourceType: 'pubmed' | 'pinecone' | 'hybrid';
  score?: number;
}

/**
 * Reciprocal Rank Fusion (RRF)를 사용하여 두 검색 결과 리스트를 병합하고 정렬합니다.
 * RRF Score = 1 / (60 + Rank_PubMed) + 1 / (60 + Rank_Pinecone)
 */
export function reciprocalRankFusion(
  pubmedList: any[],
  pineconeList: any[],
  k: number = 60
): UnifiedDocument[] {
  const mergedMap = new Map<string, { doc: UnifiedDocument; pubmedRank: number; pineconeRank: number }>();

  // 1. PubMed 문서 처리
  pubmedList.forEach((item, index) => {
    // 키 생성: pmid 또는 소문자 타이틀
    const cleanTitle = (item.title || '').toLowerCase().trim();
    const idKey = item.pmid ? `pmid-${item.pmid}` : `title-${cleanTitle}`;

    const doc: UnifiedDocument = {
      id: idKey,
      title: item.title,
      content: item.abstract || '',
      url: item.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${item.pmid}/` : undefined,
      doi: item.doi,
      org: item.journal || 'PubMed',
      sourceType: 'pubmed',
    };

    mergedMap.set(idKey, {
      doc,
      pubmedRank: index + 1,
      pineconeRank: -1,
    });
  });

  // 2. Pinecone 문서 처리
  pineconeList.forEach((item, index) => {
    const cleanTitle = (item.metadata?.title || '').toLowerCase().trim();
    
    // 기존에 PubMed로 등록된 문서인지 매칭 시도 (제목이 같거나 PMID가 매칭되는 경우)
    let matchedKey: string | null = null;
    
    for (const [key, val] of mergedMap.entries()) {
      const isTitleMatch = cleanTitle && val.doc.title.toLowerCase().trim() === cleanTitle;
      const isPmidMatch = item.id && key === `pmid-${item.id}`;
      
      if (isTitleMatch || isPmidMatch) {
        matchedKey = key;
        break;
      }
    }

    if (matchedKey) {
      const existing = mergedMap.get(matchedKey)!;
      existing.pineconeRank = index + 1;
      existing.doc.sourceType = 'hybrid';
      // content가 더 긴 것을 채택하거나 병합
      if (item.metadata?.abstract && item.metadata.abstract.length > existing.doc.content.length) {
        existing.doc.content = item.metadata.abstract;
      }
      if (item.metadata?.content && item.metadata.content.length > existing.doc.content.length) {
        existing.doc.content = item.metadata.content;
      }
      if (!existing.doc.doi && item.metadata?.doi) {
        existing.doc.doi = item.metadata.doi;
      }
      if (!existing.doc.url && item.metadata?.url) {
        existing.doc.url = item.metadata.url;
      }
    } else {
      const idKey = item.id ? `pinecone-${item.id}` : `title-${cleanTitle}`;
      const doc: UnifiedDocument = {
        id: idKey,
        title: item.metadata?.title || 'Untitled Vector Doc',
        content: item.metadata?.abstract || item.metadata?.content || '',
        url: item.metadata?.url,
        doi: item.metadata?.doi,
        org: item.metadata?.org || 'Pinecone Database',
        sourceType: 'pinecone',
      };

      mergedMap.set(idKey, {
        doc,
        pubmedRank: -1,
        pineconeRank: index + 1,
      });
    }
  });

  // 3. RRF Score 계산
  const result: UnifiedDocument[] = [];

  mergedMap.forEach((value) => {
    let score = 0;
    if (value.pubmedRank !== -1) {
      score += 1 / (k + value.pubmedRank);
    }
    if (value.pineconeRank !== -1) {
      score += 1 / (k + value.pineconeRank);
    }

    value.doc.score = score;
    result.push(value.doc);
  });

  // 4. Score 기준 내림차순 정렬
  return result.sort((a, b) => (b.score || 0) - (a.score || 0));
}
