import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, ExternalLink, ChevronLeft } from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';

// Mock Data
const mockNews = [
  {
    id: '1',
    title: '2025 미국신장학회 신장주간서 FINE-ONE 3상 연구 결과 발표',
    source: '메디컬헤럴드',
    date: '2025.02.23',
    thumbnail: null 
  },
  {
    id: '2',
    title: '전 세계 CKD 성인환자 8억 명',
    source: '메디컬트리뷴',
    date: '2025.02.20',
    thumbnail: null
  }
];

const mockPapers = [
  {
    id: 'p1',
    title: 'Effects of SGLT2 Inhibitors on Kidney Failure',
    authors: 'The EMPA-KIDNEY Collaborative Group',
    date: '2023 Jan',
    pmid: '36331190',
    url: 'https://pubmed.ncbi.nlm.nih.gov/36331190/'
  },
  {
    id: 'p2',
    title: 'Finerenone in Patients with Chronic Kidney Disease',
    authors: 'Bakris GL et al.',
    date: '2020 Dec',
    pmid: '33104276',
    url: 'https://pubmed.ncbi.nlm.nih.gov/33104276/'
  }
];

export function BookmarkPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'news' | 'papers'>('news');
  const [newsList, setNewsList] = useState(mockNews);
  const [paperList, setPaperList] = useState(mockPapers);

  const iconStyle = { strokeWidth: 2 };

  const removeNews = (id: string) => {
    if(window.confirm('즐겨찾기에서 삭제하시겠습니까?')) {
      setNewsList(newsList.filter(n => n.id !== id));
    }
  };

  const removePaper = (id: string) => {
    if(window.confirm('즐겨찾기에서 삭제하시겠습니까?')) {
      setPaperList(paperList.filter(p => p.id !== id));
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Mobile Header */}
      <div className="lg:hidden">
        <MobileHeader title="즐겨찾기" />
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:flex items-center h-16 px-6 border-b border-[#E5E7EB] relative">
        <button
          onClick={() => navigate('/mypage')}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="마이페이지로 돌아가기"
        >
          <ChevronLeft size={24} className="text-[#1F2937]" />
        </button>
        <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl font-bold text-[#1F2937]">즐겨찾기</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pb-24 lg:pb-10">
        {/* Tabs - Matching TrendsPage style */}
        <div className="border-b mb-6" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('news')}
              className="relative pb-3 transition-all duration-200"
              style={{
                color: activeTab === 'news' ? '#00C9B7' : '#9CA3AF',
                fontSize: '15px',
                fontWeight: activeTab === 'news' ? 'bold' : 'normal',
                fontFamily: 'Noto Sans KR, sans-serif'
              }}
            >
              뉴스
              {activeTab === 'news' && (
                <div
                  className="absolute bottom-[-1px] left-0 right-0"
                  style={{ height: '2px', background: '#9F7AEA', width: '100%' }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('papers')}
              className="relative pb-3 transition-all duration-200"
              style={{
                color: activeTab === 'papers' ? '#00C9B7' : '#9CA3AF',
                fontSize: '15px',
                fontWeight: activeTab === 'papers' ? 'bold' : 'normal',
                fontFamily: 'Noto Sans KR, sans-serif'
              }}
            >
              논문
              {activeTab === 'papers' && (
                <div
                  className="absolute bottom-[-1px] left-0 right-0"
                  style={{ height: '2px', background: '#9F7AEA', width: '100%' }}
                />
              )}
            </button>
          </div>
        </div>
        {activeTab === 'news' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {newsList.length > 0 ? (
              newsList.map((news) => (
                <div 
                  key={news.id} 
                  className="flex gap-4 p-4 rounded-xl border border-[#E0E0E0] bg-white h-full"
                  style={{ boxShadow: 'none' }}
                >
                  <div 
                    className="w-[80px] h-[80px] bg-gray-100 rounded-lg flex-shrink-0 cursor-pointer"
                    onClick={() => navigate(`/news/detail/${news.id}`)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h3 
                        className="text-[15px] font-bold text-[#1F2937] leading-[1.4] line-clamp-2 cursor-pointer hover:text-[#00C9B7]"
                        onClick={() => navigate(`/news/detail/${news.id}`)}
                      >
                        {news.title}
                      </h3>
                      <button
                        onClick={() => removeNews(news.id)}
                        className="text-[#00C9B7] flex-shrink-0"
                      >
                        <Bookmark size={20} fill="#00C9B7" style={iconStyle} />
                      </button>
                    </div>
                    <div className="text-xs text-[#999999] flex gap-2">
                      <span>{news.source}</span>
                      <span>•</span>
                      <span>{news.date}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
               <div className="flex flex-col items-center justify-center py-20 text-[#999999]">
                 <Bookmark size={40} className="mb-3 opacity-30" />
                 <p>즐겨찾기한 뉴스가 없습니다.</p>
               </div>
            )}
          </div>
        )}

        {activeTab === 'papers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paperList.length > 0 ? (
              paperList.map((paper) => (
                <div 
                  key={paper.id} 
                  className="p-5 rounded-xl border border-[#E0E0E0] bg-white h-full flex flex-col"
                  style={{ boxShadow: 'none' }}
                >
                   <div className="flex justify-between items-start gap-2 mb-2">
                      <h3 className="text-[16px] font-bold text-[#1F2937] leading-[1.4]">
                        {paper.title}
                      </h3>
                      <button
                        onClick={() => removePaper(paper.id)}
                        className="text-[#00C9B7] flex-shrink-0"
                      >
                        <Bookmark size={20} fill="#00C9B7" style={iconStyle} />
                      </button>
                   </div>
                   
                   <div className="text-sm text-[#666666] mb-1">{paper.authors}</div>
                   <div className="flex items-center gap-3 text-xs text-[#999999] mb-4">
                     <span>{paper.date}</span>
                     <span>PMID: {paper.pmid}</span>
                   </div>

                   <a 
                     href={paper.url} 
                     target="_blank" 
                     rel="noreferrer"
                     className="flex items-center justify-center gap-2 w-full h-[44px] rounded-lg border border-[#E0E0E0] bg-white text-[#1F2937] font-medium hover:bg-gray-50 transition-colors"
                     style={{ boxShadow: 'none' }}
                   >
                     <span>논문 보기</span>
                     <ExternalLink size={16} style={iconStyle} />
                   </a>
                </div>
              ))
            ) : (
               <div className="flex flex-col items-center justify-center py-20 text-[#999999]">
                 <Bookmark size={40} className="mb-3 opacity-30" />
                 <p>즐겨찾기한 논문이 없습니다.</p>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
