import { Entity } from '../types/chat';

export interface PubMedArticle {
  pmid: string;
  title: string;
  abstract: string;
  journal: string;
  pubYear: number;
  doi?: string;
}

export async function searchPubMed(entity: Entity): Promise<PubMedArticle[]> {
  try {
    const apiKey = process.env.PUBMED_API_KEY;
    const apiKeyParam = apiKey ? `&api_key=${apiKey}` : '';
    
    // 키워드를 결합하여 검색어 쿼리 생성
    const keywordsQuery = entity.keywords && entity.keywords.length > 0 
      ? entity.keywords.map(k => `"${k}"`).join(' AND ') 
      : 'management';
      
    // (chronic kidney disease OR diabetes) AND {keywords}
    const term = encodeURIComponent(`(chronic kidney disease OR diabetes) AND ${keywordsQuery}`);
    
    // 최근 5년 필터링용 쿼리 추가
    const currentYear = new Date().getFullYear();
    const dateRange = `AND ("${currentYear - 5}"[Date - Publication] : "${currentYear}"[Date - Publication])`;
    
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${term}${encodeURIComponent(dateRange)}&retmax=10&retmode=json${apiKeyParam}`;
    
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      throw new Error(`PubMed esearch failed: ${searchRes.statusText}`);
    }
    
    const searchData = await searchRes.json();
    const idList: string[] = searchData.esearchresult?.idlist || [];
    
    if (idList.length === 0) {
      return [];
    }
    
    // efetch로 abstract 가져오기
    const ids = idList.join(',');
    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids}&retmode=xml${apiKeyParam}`;
    
    const fetchRes = await fetch(fetchUrl);
    if (!fetchRes.ok) {
      throw new Error(`PubMed efetch failed: ${fetchRes.statusText}`);
    }
    
    const xmlText = await fetchRes.text();
    return parsePubMedXml(xmlText, idList);
  } catch (error) {
    console.error('Error searching PubMed:', error);
    return [];
  }
}

// 가볍고 강건한 정규식 기반 XML 파서
function parsePubMedXml(xmlText: string, idList: string[]): PubMedArticle[] {
  const articles: PubMedArticle[] = [];
  
  // <PubmedArticle> ... </PubmedArticle> 블록들 분리
  const articleBlocks = xmlText.split('</PubmedArticle>');
  
  for (let i = 0; i < articleBlocks.length; i++) {
    const block = articleBlocks[i];
    if (!block.includes('<PubmedArticle>')) continue;
    
    const pmidMatch = block.match(/<PMID[^>]*>(\d+)<\/PMID>/);
    const pmid = pmidMatch ? pmidMatch[1] : idList[i] || `pmid-${i}`;
    
    const titleMatch = block.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/);
    const title = titleMatch 
      ? titleMatch[1].replace(/<[^>]+>/g, '').trim() 
      : 'Untitled PubMed Article';
      
    // abstractText 부분 추출 (여러 개가 있을 수 있으므로 합침)
    let abstract = '';
    const abstractMatches = block.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g);
    for (const match of abstractMatches) {
      abstract += match[1].replace(/<[^>]+>/g, '').trim() + ' ';
    }
    abstract = abstract.trim() || 'No abstract available.';
    
    const journalMatch = block.match(/<Title>([\s\S]*?)<\/Title>/);
    const journal = journalMatch ? journalMatch[1].replace(/<[^>]+>/g, '').trim() : 'Unknown Journal';
    
    const yearMatch = block.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/);
    const pubYear = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
    
    const doiMatch = block.match(/<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/);
    const doi = doiMatch ? doiMatch[1].trim() : undefined;
    
    articles.push({
      pmid,
      title,
      abstract,
      journal,
      pubYear,
      doi,
    });
  }
  
  return articles;
}
