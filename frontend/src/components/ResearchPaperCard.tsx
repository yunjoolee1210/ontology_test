import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Globe } from 'lucide-react';

export interface ResearchPaper {
  id: string;
  title: string;
  title_ko?: string;
  authors: string[];
  journal: string;
  pub_date: string;
  pmid?: string;
  doi?: string;
  abstract?: string;
  abstract_ko?: string;
  mesh_terms?: string[];
  relevance_score?: number;
}

interface ResearchPaperCardProps {
  paper: ResearchPaper;
  index: number;
  language: 'en' | 'ko';
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
}

export function ResearchPaperCard({
  paper,
  index,
  language,
  isExpanded,
  onToggleExpand
}: ResearchPaperCardProps) {
  const title = language === 'ko' && paper.title_ko ? paper.title_ko : paper.title;
  const abstract = language === 'ko' && paper.abstract_ko ? paper.abstract_ko : paper.abstract;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3 hover:shadow-md transition-shadow">
      {/* Header: Index + Title */}
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00C8B4] text-white text-xs flex items-center justify-center font-medium">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <h4 className="text-[14px] font-semibold text-gray-900 leading-snug line-clamp-2">
            {title}
          </h4>

          {/* Meta info */}
          <div className="mt-2 space-y-1">
            <p className="text-[12px] text-gray-600">
              <span className="font-medium">저자:</span>{' '}
              {paper.authors.slice(0, 3).join(', ')}
              {paper.authors.length > 3 && ` 외 ${paper.authors.length - 3}명`}
            </p>
            <p className="text-[12px] text-gray-600">
              <span className="font-medium">저널:</span> {paper.journal}
            </p>
            <p className="text-[12px] text-gray-600">
              <span className="font-medium">발행일:</span> {paper.pub_date}
            </p>
          </div>

          {/* External links */}
          <div className="mt-2 flex gap-2">
            {paper.pmid && (
              <a
                href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
              >
                <ExternalLink size={12} />
                PubMed
              </a>
            )}
            {paper.doi && (
              <a
                href={`https://doi.org/${paper.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
              >
                <ExternalLink size={12} />
                DOI
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Expand/Collapse Button */}
      <button
        onClick={() => onToggleExpand(paper.id)}
        className="mt-3 flex items-center gap-1 text-[12px] text-[#00C8B4] font-medium hover:underline"
      >
        {isExpanded ? (
          <>접기 <ChevronUp size={14} /></>
        ) : (
          <>더보기 <ChevronDown size={14} /></>
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
          {/* Abstract */}
          {abstract && (
            <div>
              <p className="text-[11px] font-medium text-gray-700 mb-1">초록 요약</p>
              <p className="text-[12px] text-gray-600 leading-relaxed">
                {abstract.length > 500 ? abstract.substring(0, 500) + '...' : abstract}
              </p>
            </div>
          )}

          {/* DOI */}
          {paper.doi && (
            <div>
              <p className="text-[11px] font-medium text-gray-700 mb-1">DOI</p>
              <p className="text-[12px] text-gray-500">{paper.doi}</p>
            </div>
          )}

          {/* MeSH Terms */}
          {paper.mesh_terms && paper.mesh_terms.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-gray-700 mb-1">MeSH 키워드</p>
              <div className="flex flex-wrap gap-1">
                {paper.mesh_terms.slice(0, 8).map((term, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full"
                  >
                    {term}
                  </span>
                ))}
                {paper.mesh_terms.length > 8 && (
                  <span className="px-2 py-0.5 text-gray-400 text-[10px]">
                    +{paper.mesh_terms.length - 8}개
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ResearchPaperListProps {
  papers: ResearchPaper[];
  summary: string;
  summary_ko?: string;
  onTranslate?: (papers: ResearchPaper[]) => Promise<ResearchPaper[]>;
}

export function ResearchPaperList({
  papers,
  summary,
  summary_ko,
  onTranslate
}: ResearchPaperListProps) {
  const [language, setLanguage] = useState<'en' | 'ko'>('en');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [translatedPapers, setTranslatedPapers] = useState<ResearchPaper[]>(papers);
  const [isTranslating, setIsTranslating] = useState(false);

  const handleLanguageChange = async (lang: 'en' | 'ko') => {
    setLanguage(lang);

    // 한국어로 전환 시 번역이 필요하면 실행
    if (lang === 'ko' && onTranslate && !papers[0]?.title_ko) {
      setIsTranslating(true);
      try {
        const translated = await onTranslate(papers);
        setTranslatedPapers(translated);
      } catch (error) {
        console.error('Translation failed:', error);
      } finally {
        setIsTranslating(false);
      }
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const displaySummary = language === 'ko' && summary_ko ? summary_ko : summary;
  const displayPapers = language === 'ko' ? translatedPapers : papers;

  return (
    <div className="w-full">
      {/* Summary Section */}
      <div className="bg-gradient-to-r from-[#E8F5F3] to-[#F0F4FF] rounded-lg p-4 mb-4">
        <p className="text-[13px] text-gray-800 leading-relaxed">
          {displaySummary}
        </p>
      </div>

      {/* Header with Language Filter */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-semibold text-gray-900">
          검색 결과 ({papers.length}건)
        </h3>

        {/* Language Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => handleLanguageChange('en')}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
              language === 'en'
                ? 'bg-white text-[#00C8B4] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Globe size={12} />
            영어
          </button>
          <button
            onClick={() => handleLanguageChange('ko')}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
              language === 'ko'
                ? 'bg-white text-[#00C8B4] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Globe size={12} />
            한국어
          </button>
        </div>
      </div>

      {/* Loading State for Translation */}
      {isTranslating && (
        <div className="flex items-center justify-center py-4">
          <div className="flex items-center gap-2 text-[12px] text-gray-500">
            <div className="w-4 h-4 border-2 border-[#00C8B4] border-t-transparent rounded-full animate-spin"></div>
            번역 중...
          </div>
        </div>
      )}

      {/* Paper List */}
      {!isTranslating && (
        <div className="space-y-0">
          {displayPapers.map((paper, index) => (
            <ResearchPaperCard
              key={paper.id || `paper-${index}`}
              paper={paper}
              index={index}
              language={language}
              isExpanded={expandedIds.has(paper.id)}
              onToggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}

      {/* No Results */}
      {papers.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-[13px]">
          검색 결과가 없습니다.
        </div>
      )}
    </div>
  );
}
