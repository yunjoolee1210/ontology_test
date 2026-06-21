export interface UnifiedDocument {
  id: string;
  title: string;
  content: string;
  url?: string;
  doi?: string;
  org?: string;
  sourceType: 'pubmed' | 'supabase_vector' | 'hybrid';
  score?: number;
}

/**
 * Reciprocal Rank Fusion (RRF)를 사용하여 두 검색 결과 리스트를 병합하고 정렬합니다.
 * RRF Score = 1 / (60 + Rank_PubMed) + 1 / (60 + Rank_SupabaseVector)
 */
export function reciprocalRankFusion(
  pubmedList: any[],
  vectorList: any[],
  k: number = 60
): UnifiedDocument[] {
  const mergedMap = new Map<string, { doc: UnifiedDocument; pubmedRank: number; vectorRank: number }>();

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
      vectorRank: -1,
    });
  });

  // 2. Supabase 벡터 문서 처리
  vectorList.forEach((item, index) => {
    const cleanTitle = (item.title || '').toLowerCase().trim();
    
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
      existing.vectorRank = index + 1;
      existing.doc.sourceType = 'hybrid';
      // content가 더 긴 것을 채택하거나 병합
      if (item.content && item.content.length > existing.doc.content.length) {
        existing.doc.content = item.content;
      }
      if (!existing.doc.doi && item.doi) {
        existing.doc.doi = item.doi;
      }
      if (!existing.doc.url && item.url) {
        existing.doc.url = item.url;
      }
    } else {
      const idKey = item.id ? `vector-${item.id}` : `title-${cleanTitle}`;
      const doc: UnifiedDocument = {
        id: idKey,
        title: item.title || 'Untitled Vector Doc',
        content: item.content || '',
        url: item.url,
        doi: item.doi,
        org: item.org || 'Supabase Vector Database',
        sourceType: 'supabase_vector',
      };

      mergedMap.set(idKey, {
        doc,
        pubmedRank: -1,
        vectorRank: index + 1,
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
    if (value.vectorRank !== -1) {
      score += 1 / (k + value.vectorRank);
    }

    value.doc.score = score;
    result.push(value.doc);
  });

  // 4. Score 기준 내림차순 정렬
  return result.sort((a, b) => (b.score || 0) - (a.score || 0));
}

