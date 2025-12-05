import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Image as ImageIcon, Stethoscope, Utensils, FileText, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Copy, RotateCcw, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { MobileHeader } from '../components/MobileHeader';
import { NutritionCardCarousel, NutritionCard } from '../components/NutritionCardCarousel';
import { IngredientCardCarousel, IngredientCard, LOW_POTASSIUM_VEGETABLES } from '../components/IngredientCardCarousel';
import { ResearchPaperList, ResearchPaper } from '../components/ResearchPaperCard';
import axios from 'axios';

type AgentTab = 'medical' | 'nutrition' | 'research';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  agentType?: string;
  fallbackType?: string;
  nutritionCards?: NutritionCard[];
  ingredientCards?: IngredientCard[];
  researchPapers?: ResearchPaper[];
  researchSummary?: string;
  messageType?: 'ingredient_query' | 'recipe_query' | 'research_query' | 'general';
  isExpanded?: boolean;
  isLoading?: boolean; // 대기 안내 메시지용 (로딩 중 표시)
  feedback?: 'up' | 'down' | null; // Claude 스타일 피드백
  sources?: Array<{ title: string; pmid?: string; journal?: string }>; // 출처 정보
  imageUrl?: string; // 사용자가 업로드한 이미지 URL
}

// 답변 글자수 제한 (약 150단어 = 450자 기준)
const MAX_CONTENT_LENGTH = 450;

interface SessionContext {
  selected_agent?: string;
  diseases?: string[];
  keywords?: string[];
  user_profile?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export function ChatPage() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<AgentTab>('medical');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  // Agent별 대화 이력 분리 저장
  const [agentMessages, setAgentMessages] = useState<Record<AgentTab, Message[]>>({
    medical: [],
    nutrition: [],
    research: []
  });
  const [selectedProfile, setSelectedProfile] = useState('신장병 환우');
  const [sessionId, setSessionId] = useState<string>('');
  const [context, setContext] = useState<SessionContext>({});
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [bookmarkedCards, setBookmarkedCards] = useState<string[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState<string | undefined>();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Agent 전환 시 해당 agent의 대화 이력으로 교체
  const handleTabChange = (tab: AgentTab) => {
    if (tab === activeTab) return; // 같은 탭이면 무시

    // 현재 대화를 저장하고 새 agent 대화 로드
    setAgentMessages(prev => {
      const updated = { ...prev, [activeTab]: messages };
      // 새 agent의 대화 이력 로드
      setMessages(updated[tab]);
      return updated;
    });
    setActiveTab(tab);
  };

  // Handle ingredient selection - triggers recipe recommendation
  const handleIngredientSelect = async (ingredient: IngredientCard) => {
    setSelectedIngredient(ingredient.id);

    // Send recipe recommendation request
    const recipeQuery = `${ingredient.name}를 사용한 저칼륨 요리 추천해줘`;
    await handleSendMessage(recipeQuery);
  };

  // Check if message is an ingredient query
  const isIngredientQuery = (text: string): boolean => {
    const ingredientKeywords = ['저칼륨 재료', '저칼륨 식재료', '저칼륨 음식 재료', '저칼륨 야채', '저칼륨 채소', '칼륨 낮은 재료', '칼륨 낮은 식재료'];
    return ingredientKeywords.some(keyword => text.includes(keyword));
  };

  // Check if first message is meaningless (no semantic content)
  const isMeaninglessFirstMessage = (text: string): boolean => {
    // Remove whitespace and check length
    const cleaned = text.replace(/\s/g, '');
    if (cleaned.length < 2) return true;

    // Check for repeated consonants/vowels only (ㅗㅗ, ㅋㅋ, ㄱㄱ, etc.)
    const koreanConsonantsVowels = /^[ㄱ-ㅎㅏ-ㅣ]+$/;
    if (koreanConsonantsVowels.test(cleaned)) return true;

    // Check for meaningless patterns
    const meaninglessPatterns = [
      /^[ㅗㅜㅠㅡ]+$/, // middle fingers, etc.
      /^[ㅋㅎㅉㅊㅍ]+$/, // just consonants
      /^[.…]+$/, // just dots
      /^[!?@#$%^&*()]+$/, // just symbols
      /^(ㅇㅇ|ㄴㄴ|ㄱㄱ|ㅎㅎ|ㅋㅋ|ㅠㅠ|ㅜㅜ)+$/, // repeated pairs
      /^(아|어|음|응|헐|아아|어어)+$/, // meaningless interjections
    ];

    return meaninglessPatterns.some(pattern => pattern.test(cleaned));
  };

  // Handle bookmark toggle
  const handleBookmark = (cardId: string) => {
    setBookmarkedCards(prev =>
      prev.includes(cardId)
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
    // TODO: Save to backend/localStorage
  };

  // Toggle message expand/collapse
  const toggleMessageExpand = useCallback((messageId: string) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, isExpanded: !msg.isExpanded } : msg
    ));
  }, []);

  // Handle feedback (Claude style)
  const handleFeedback = useCallback(async (messageId: string, type: 'up' | 'down') => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, feedback: msg.feedback === type ? null : type } : msg
    ));
    // TODO: Send feedback to backend
    // await axios.post(`${API_BASE_URL}/api/agent/feedback`, { message_id: messageId, feedback: type });
  }, []);

  // Copy message to clipboard
  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    // TODO: Show toast notification
  }, []);

  // Handle image selection
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('JPG, PNG, GIF, WebP 형식의 이미지만 업로드 가능합니다.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('이미지 크기는 5MB 이하로 업로드해 주세요.');
      return;
    }

    setSelectedImage(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  // Clear selected image
  const clearSelectedImage = useCallback(() => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Get truncated content with "더보기" support
  const getTruncatedContent = (content: string, isExpanded: boolean) => {
    if (content.length <= MAX_CONTENT_LENGTH || isExpanded) {
      return content;
    }
    return content.substring(0, MAX_CONTENT_LENGTH) + '...';
  };

  // Parse nutrition response for card data
  const parseNutritionCards = (content: string): NutritionCard[] => {
    const cards: NutritionCard[] = [];

    // Parse tips (# 저칼륨 요리 팁 patterns)
    const tipMatches = content.match(/#{1,3}\s*저칼륨\s*요리\s*팁\s*\d*/gi);
    if (tipMatches) {
      const tipSections = content.split(/#{1,3}\s*저칼륨\s*요리\s*팁\s*\d*/gi).slice(1);
      tipSections.forEach((section, idx) => {
        const lines = section.trim().split('\n').filter(l => l.trim());
        const title = `저칼륨 요리 팁 ${idx + 1}`;
        const description = lines.slice(0, 2).join(' ').substring(0, 100);
        const details = lines.join('\n');

        cards.push({
          id: `tip-${idx + 1}`,
          title,
          thumbnail: `https://placehold.co/280x200/E8F5E9/2E7D32?text=${encodeURIComponent(`팁${idx + 1}`)}`,
          description,
          details,
          category: 'tip'
        });
      });
    }

    // Parse recipes (가지무침, 양배추 샐러드 patterns)
    const recipePatterns = [
      { name: '가지무침', ingredients: ['가지', '참기름', '마늘', '파'] },
      { name: '양배추 샐러드', ingredients: ['양배추', '당근', '오이', '드레싱'] },
      { name: '오이냉국', ingredients: ['오이', '다시마', '식초', '설탕'] },
      { name: '무나물', ingredients: ['무', '참기름', '마늘', '파'] },
      { name: '콩나물무침', ingredients: ['콩나물', '참기름', '소금'] },
      { name: '애호박볶음', ingredients: ['애호박', '식용유', '소금'] },
    ];

    recipePatterns.forEach((recipe, idx) => {
      if (content.includes(recipe.name)) {
        const recipeSection = content.split(new RegExp(`(${recipe.name}[^#]*?)(?=#|$)`, 'i'));
        const details = recipeSection.find(s => s.includes(recipe.name)) || '';

        cards.push({
          id: `recipe-${idx + 1}`,
          title: recipe.name,
          thumbnail: `https://placehold.co/280x200/FFF3E0/E65100?text=${encodeURIComponent(recipe.name)}`,
          description: `신장병 환자를 위한 저칼륨 ${recipe.name} 레시피`,
          details: details.trim(),
          category: 'recipe',
          ingredients: recipe.ingredients,
          cookingSteps: [
            '재료를 깨끗이 씻어 준비합니다.',
            '물에 데쳐 칼륨을 줄입니다.',
            '양념을 넣고 무칩니다.',
            '맛있게 담아 완성합니다.'
          ],
          nutritionInfo: {
            sodium: Math.floor(Math.random() * 200) + 100,
            potassium: Math.floor(Math.random() * 150) + 50,
            phosphorus: Math.floor(Math.random() * 100) + 30,
            protein: Math.floor(Math.random() * 5) + 2
          }
        });
      }
    });

    return cards;
  };

  const tabs = [
    { id: 'medical' as AgentTab, label: '의료 복지', icon: Stethoscope },
    { id: 'nutrition' as AgentTab, label: '식이 영양', icon: Utensils },
    { id: 'research' as AgentTab, label: '연구 논문', icon: FileText }
  ];

  const ActiveIcon = tabs.find(t => t.id === activeTab)?.icon || Stethoscope;

  // Initialize session on component mount
  useEffect(() => {
    initializeSession();
  }, []);

  // Handle initial message from navigation
  useEffect(() => {
    const state = location.state as any;
    if (state?.initialMessage && sessionId) {
      handleSendMessage(state.initialMessage);
    }
    if (state?.tab) {
      setActiveTab(state.tab);
    }
  }, [location, sessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // messages 변경 시 현재 activeTab의 agentMessages도 동기화
  useEffect(() => {
    if (messages.length > 0) {
      setAgentMessages(prev => ({ ...prev, [activeTab]: messages }));
    }
  }, [messages, activeTab]);

  // Check if suggestions need scroll buttons
  useEffect(() => {
    const checkScroll = () => {
      if (suggestionsRef.current) {
        const { scrollWidth, clientWidth } = suggestionsRef.current;
        setShowScrollButtons(scrollWidth > clientWidth);
      }
    };
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [messages]);

  // Initialize session
  const initializeSession = async () => {
    // 각 agent별 환영 메시지 초기화
    const createWelcomeMessages = (): Record<AgentTab, Message[]> => {
      const tabs: AgentTab[] = ['medical', 'nutrition', 'research'];
      const result: Record<AgentTab, Message[]> = {
        medical: [],
        nutrition: [],
        research: []
      };

      tabs.forEach(tab => {
        result[tab] = [{
          id: `welcome_${tab}_${Date.now()}`,
          type: 'ai',
          content: getWelcomeMessage(tab),
          timestamp: new Date(),
          agentType: tab
        }];
      });

      return result;
    };

    try {
      const response = await axios.post(`${API_BASE_URL}/api/session/create`, {
        user_id: 'user_' + Date.now(),
        metadata: {
          platform: 'web',
          page: 'chat'
        }
      });

      if (response.data.session_id) {
        setSessionId(response.data.session_id);
        console.log('✅ Session created:', response.data.session_id);

        // 모든 agent에 대한 환영 메시지 초기화
        const allWelcomeMessages = createWelcomeMessages();
        setAgentMessages(allWelcomeMessages);
        // 현재 활성 agent의 메시지 설정
        setMessages(allWelcomeMessages[activeTab]);
      }
    } catch (error) {
      console.error('❌ Failed to create session:', error);
      // Generate fallback session ID
      const fallbackId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      setSessionId(fallbackId);

      // 모든 agent에 대한 환영 메시지 초기화
      const allWelcomeMessages = createWelcomeMessages();
      setAgentMessages(allWelcomeMessages);
      setMessages(allWelcomeMessages[activeTab]);
    }
  };

  // Send message to agent
  const handleSendMessage = async (text?: string) => {
    const messageText = text || message;
    // 이미지가 있으면 텍스트 없이도 전송 가능, 이미지 없으면 텍스트 필수
    if ((!messageText.trim() && !selectedImage) || !sessionId) return;

    // Check if this is the first message and it's meaningless
    const isFirstMessage = messages.length === 0;
    if (isFirstMessage && !selectedImage && isMeaninglessFirstMessage(messageText)) {
      // Show user message but respond with greeting
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: messageText,
        timestamp: new Date(),
        agentType: activeTab
      };
      setMessages(prev => [...prev, userMessage]);
      setMessage('');

      // Respond with greeting message
      const greetingMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: getWelcomeMessage(),
        timestamp: new Date(),
        agentType: activeTab
      };
      setMessages(prev => [...prev, greetingMessage]);
      return;
    }

    // 사용자 메시지에 이미지 미리보기 포함
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: messageText || '이미지를 분석해 주세요',
      timestamp: new Date(),
      agentType: activeTab,
      imageUrl: imagePreview || undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');

    // 이미지 상태 저장 후 클리어 (API 호출에 사용하기 위해)
    const currentImage = selectedImage;
    const currentImagePreview = imagePreview;
    clearSelectedImage();

    setIsLoading(true);

    // 정책 9: 대기 안내 메시지 먼저 표시
    const loadingMessageId = (Date.now() + 1).toString();
    const getLoadingMessage = () => {
      if (currentImage) {
        return '업로드하신 이미지를 분석하고 있습니다. 잠시만 기다려 주세요...';
      }
      const topic = messageText.substring(0, 30);
      const messages: Record<AgentTab, string> = {
        research: `'${topic}'에 대해 PubMed에서 관련된 연구 논문 자료를 찾아보겠습니다. 잠시만 기다려 주세요.`,
        medical: `'${topic}'에 대해 의료복지 데이터베이스에서 찾아보겠습니다. 잠시만요.`,
        nutrition: `'${topic}'에 대해 식이영양 데이터베이스에서 찾아보겠습니다. 잠시만요.`
      };
      return messages[activeTab];
    };

    // 대기 안내 메시지 추가
    const loadingMessage: Message = {
      id: loadingMessageId,
      type: 'ai',
      content: getLoadingMessage(),
      timestamp: new Date(),
      agentType: activeTab,
      isLoading: true
    };
    setMessages(prev => [...prev, loadingMessage]);

    try {
      // Update context with user profile and maintain selected agent
      const updatedContext: SessionContext & { has_image?: boolean; image_data?: string } = {
        ...context,
        selected_agent: activeTab,
        user_profile: selectedProfile
      };

      // 이미지가 있으면 base64로 인코딩하여 context에 추가
      if (currentImage && currentImagePreview) {
        // data:image/jpeg;base64, 부분 제거
        const base64Data = currentImagePreview.split(',')[1];
        updatedContext.has_image = true;
        updatedContext.image_data = base64Data;
      }

      // Call agent API
      const response = await axios.post(`${API_BASE_URL}/api/agent/chat`, {
        message: messageText || '이미지를 분석해 주세요',
        agent_type: activeTab,
        session_id: sessionId,
        context: updatedContext
      });

      console.log('📨 Agent response:', response.data);

      // Handle response
      if (response.data.success) {
        // Check if this is an ingredient query (for nutrition tab)
        const isIngredientRequest = activeTab === 'nutrition' && isIngredientQuery(messageText);

        // Check if this is a research paper query
        const isResearchRequest = activeTab === 'research';

        // Parse nutrition cards for recipe responses
        const nutritionCards = activeTab === 'nutrition' && !isIngredientRequest
          ? parseNutritionCards(response.data.message)
          : undefined;

        // Prepare ingredient cards if this is an ingredient query
        const ingredientCards = isIngredientRequest ? LOW_POTASSIUM_VEGETABLES : undefined;

        // Prepare research papers if this is a research query
        let researchPapers: ResearchPaper[] | undefined;
        let researchSummary: string | undefined;

        if (isResearchRequest && response.data.papers && response.data.papers.length > 0) {
          researchPapers = response.data.papers.map((p: any, idx: number) => ({
            id: p.id || p.pmid || `paper_${idx}`,
            title: p.title || '',
            title_ko: p.title_ko || undefined,
            authors: p.authors || [],
            journal: p.journal || '',
            pub_date: p.pub_date || '',
            pmid: p.pmid || '',
            doi: p.doi || '',
            abstract: p.abstract || '',
            abstract_ko: p.abstract_ko || undefined,
            mesh_terms: p.mesh_terms || [],
            relevance_score: p.relevance_score || 0
          }));
          researchSummary = response.data.summary || '';
        }

        // Shorten response for ingredient queries (max 300 chars)
        let displayContent = response.data.message;
        if (isIngredientRequest) {
          displayContent = '신장병 환자를 위한 저칼륨 식재료를 안내해 드릴게요! 아래 채소들은 100g당 칼륨 함량이 낮아 안심하고 드실 수 있어요.';
        }

        // Determine message type
        let messageType: 'ingredient_query' | 'recipe_query' | 'research_query' | 'general' = 'general';
        if (isIngredientRequest) messageType = 'ingredient_query';
        else if (isResearchRequest && researchPapers && researchPapers.length > 0) messageType = 'research_query';

        const aiMessage: Message = {
          id: loadingMessageId, // 대기 메시지 ID 재사용하여 교체
          type: 'ai',
          content: displayContent,
          timestamp: new Date(),
          agentType: response.data.agent_type,
          nutritionCards: nutritionCards && nutritionCards.length > 0 ? nutritionCards : undefined,
          ingredientCards: ingredientCards,
          researchPapers: researchPapers,
          researchSummary: researchSummary,
          messageType: messageType,
          isLoading: false,
          sources: response.data.sources || []
        };

        // 대기 메시지를 실제 응답으로 교체
        setMessages(prev => prev.map(msg =>
          msg.id === loadingMessageId ? aiMessage : msg
        ));
        setSelectedIngredient(undefined); // Reset selection

        // Update context if provided
        if (response.data.context_info) {
          setContext(prev => ({
            ...prev,
            ...updatedContext
          }));
        }
      } else {
        // Handle fallback message - 대기 메시지 교체
        const fallbackMessage: Message = {
          id: loadingMessageId,
          type: 'ai',
          content: response.data.message || '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
          timestamp: new Date(),
          agentType: activeTab,
          fallbackType: response.data.fallback_type,
          isLoading: false
        };

        setMessages(prev => prev.map(msg =>
          msg.id === loadingMessageId ? fallbackMessage : msg
        ));

        // Log error for debugging
        console.warn('⚠️ Fallback message:', response.data.fallback_type, response.data.error);
      }
    } catch (error: any) {
      console.error('❌ Error sending message:', error);

      // Generic error fallback - 대기 메시지 교체
      const errorMessage: Message = {
        id: loadingMessageId,
        type: 'ai',
        content: '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
        timestamp: new Date(),
        agentType: activeTab,
        fallbackType: 'RESPONSE_GENERATION_FAILED',
        isLoading: false
      };

      setMessages(prev => prev.map(msg =>
        msg.id === loadingMessageId ? errorMessage : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };

  // Get welcome message based on agent type
  const getWelcomeMessage = (tab?: AgentTab) => {
    const targetTab = tab || activeTab;
    const messages = {
      medical: '의료 복지',
      nutrition: '식이 영양',
      research: '연구 논문'
    };
    return `안녕하세요! 신장병의 ${messages[targetTab]} 정보를 알려드리는 케어가이드 챗봇입니다. 무엇이든 물어보세요.`;
  };

  // Get suggestion buttons based on agent type
  const getSuggestions = () => {
    const suggestions = {
      medical: [
        '신장병 환자를 위한 의료 복지 혜택은?',
        '투석 환자 지원 제도 알려줘'
      ],
      nutrition: [
        '저칼륨 음식 재료 알려줘',
        '신장병 환자를 위한 김장 레시피 알려줘'
      ],
      research: [
        '만성신장병 최신 연구 동향은?',
        'CKD 치료법 관련 논문 찾아줘'
      ]
    };
    return suggestions[activeTab] || suggestions.nutrition;
  };

  // Scroll suggestions
  const scrollSuggestions = (direction: 'left' | 'right') => {
    if (suggestionsRef.current) {
      const scrollAmount = 200;
      suggestionsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-white relative">
      {/* Mobile Header */}
      <div className="lg:hidden">
        <MobileHeader
          title="AI 챗봇"
          showMenu={true}
          showProfile={true}
        />
      </div>

      {/* Desktop Tabs - Agent Selection (Fixed to selected agent) */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 lg:h-[68.5px] lg:pt-[12px] flex justify-center">
        <div className="w-full lg:max-w-[832px] flex gap-2 lg:gap-4 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className="flex-1 min-w-fit h-[40px] lg:h-[43.5px] flex items-center justify-center gap-1.5 lg:gap-2 rounded-[16.4px] transition-all duration-200 relative group px-3 lg:px-0"
                style={isActive ? {
                  background: '#FFFFFF',
                  color: '#00C9B7',
                  fontWeight: 'bold',
                  border: '2px solid transparent',
                  backgroundImage: 'linear-gradient(white, white), linear-gradient(to right, #00C9B7, #9F7AEA)',
                  backgroundOrigin: 'border-box',
                  backgroundClip: 'padding-box, border-box',
                  boxShadow: '0px 0px 10px rgba(0, 201, 183, 0.1)'
                } : {
                  background: '#FFFFFF',
                  color: '#666666',
                  border: '1px solid #E5E7EB'
                }}
              >
                <Icon size={16} className="lg:w-[18px] lg:h-[18px]" strokeWidth={1.5} color={isActive ? '#00C9B7' : '#666666'} />
                <span className="text-[12px] lg:text-[13px] whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages Area - ChatGPT style centered layout */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-[768px] mx-auto px-4 lg:px-6 py-6 pb-[160px]">

        {/* Message List */}
        {messages.map((msg, msgIndex) => (
          <div
            key={msg.id}
            className={`flex mb-4 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.type === 'ai' && (
              <div className="flex flex-col items-start max-w-[90%] lg:max-w-[80%]">
                 <div className="flex items-center gap-2 mb-1">
                   <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                      <ActiveIcon size={14} color="#4A5565" />
                   </div>
                   <span className="text-[12px] text-[#6a7282]">CareGuide AI</span>
                   {msg.fallbackType && (
                     <span className="text-[10px] text-orange-500">⚠️</span>
                   )}
                 </div>
                 <div className={`rounded-tr-[12px] rounded-bl-[12px] rounded-br-[12px] p-4 ${
                   msg.fallbackType ? 'bg-orange-50 border border-orange-200' : 'bg-[#f0f4ff]'
                 }`}>
                   <p className="text-[14px] text-black leading-[22px] whitespace-pre-wrap">
                     {getTruncatedContent(msg.content, msg.isExpanded || false)}
                   </p>
                   {/* 로딩 중 타이핑 인디케이터 */}
                   {msg.isLoading && (
                     <div className="flex gap-1 mt-2">
                       <div className="w-2 h-2 bg-[#00C8B4] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                       <div className="w-2 h-2 bg-[#00C8B4] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                       <div className="w-2 h-2 bg-[#00C8B4] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                     </div>
                   )}
                   {msg.content.length > MAX_CONTENT_LENGTH && !msg.isLoading && (
                     <button
                       onClick={() => toggleMessageExpand(msg.id)}
                       className="mt-2 flex items-center gap-1 text-[12px] text-[#00C8B4] font-medium hover:underline"
                     >
                       {msg.isExpanded ? (
                         <>접기 <ChevronUp size={14} /></>
                       ) : (
                         <>더보기 <ChevronDown size={14} /></>
                       )}
                     </button>
                   )}
                 </div>

                 {/* Claude style action buttons - 로딩 중이 아닐 때만 표시 */}
                 {!msg.isLoading && msgIndex !== 0 && (
                   <div className="flex items-center gap-1 mt-2">
                     <button
                       onClick={() => handleCopy(msg.content)}
                       className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                       title="복사"
                     >
                       <Copy size={14} />
                     </button>
                     <button
                       onClick={() => handleFeedback(msg.id, 'up')}
                       className={`p-1.5 rounded-md hover:bg-gray-100 transition-colors ${
                         msg.feedback === 'up' ? 'text-[#00C8B4] bg-[#e6faf8]' : 'text-gray-400 hover:text-gray-600'
                       }`}
                       title="좋아요"
                     >
                       <ThumbsUp size={14} />
                     </button>
                     <button
                       onClick={() => handleFeedback(msg.id, 'down')}
                       className={`p-1.5 rounded-md hover:bg-gray-100 transition-colors ${
                         msg.feedback === 'down' ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-gray-600'
                       }`}
                       title="싫어요"
                     >
                       <ThumbsDown size={14} />
                     </button>
                   </div>
                 )}

                 {/* Fewshot Suggestions - 첫 번째 AI 메시지(시작 메시지) 바로 아래에만 표시 */}
                 {msgIndex === 0 && (
                   <div className="mt-3">
                     {/* Mobile: 세로 나열 (텍스트 길이에 맞춤) / Desktop: 가로 스크롤 */}
                     <div className="flex flex-col items-start gap-2 lg:flex-row lg:gap-3">
                      {getSuggestions().map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendMessage(suggestion)}
                          className="bg-white border border-[#ebebeb] rounded-[8px] px-3 py-2 text-[11px] font-medium text-[#1f1f1f] hover:bg-gray-50 text-left whitespace-nowrap"
                          disabled={isLoading}
                        >
                          {suggestion}
                        </button>
                      ))}
                     </div>
                   </div>
                 )}

                 {/* Ingredient Card Carousel (for ingredient queries) */}
                 {msg.ingredientCards && msg.ingredientCards.length > 0 && (
                   <div className="w-full mt-2">
                     <IngredientCardCarousel
                       ingredients={msg.ingredientCards}
                       onSelectIngredient={handleIngredientSelect}
                       selectedId={selectedIngredient}
                     />
                   </div>
                 )}

                 {/* Nutrition Card Carousel (for recipe queries) */}
                 {msg.nutritionCards && msg.nutritionCards.length > 0 && (
                   <div className="w-full mt-2">
                     <NutritionCardCarousel
                       cards={msg.nutritionCards}
                       onBookmark={handleBookmark}
                       bookmarkedIds={bookmarkedCards}
                     />
                   </div>
                 )}

                 {/* Research Paper List (for research queries) */}
                 {msg.researchPapers && msg.researchPapers.length > 0 && (
                   <div className="w-full mt-3">
                     <ResearchPaperList
                       papers={msg.researchPapers}
                       summary={msg.researchSummary || ''}
                       onTranslate={async (papers) => {
                         try {
                           const response = await axios.post(`${API_BASE_URL}/api/agent/translate/papers`, {
                             papers: papers,
                             summary: msg.researchSummary
                           });
                           return response.data.papers;
                         } catch (error) {
                           console.error('Translation failed:', error);
                           return papers;
                         }
                       }}
                     />
                   </div>
                 )}
              </div>
            )}

            {msg.type === 'user' && (
              <div className="bg-[#00C8B4] text-white rounded-tl-[12px] rounded-tr-[12px] rounded-bl-[12px] p-4 max-w-[80%]">
                {/* 사용자가 업로드한 이미지 표시 */}
                {msg.imageUrl && (
                  <div className="mb-2">
                    <img
                      src={msg.imageUrl}
                      alt="업로드된 이미지"
                      className="max-w-full max-h-[200px] rounded-lg object-cover"
                    />
                  </div>
                )}
                <p className="text-[14px] leading-[22px] whitespace-pre-wrap">{msg.content}</p>
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator - 정책 9에 의해 대기 메시지 내부로 이동됨 */}

        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area - 모바일: bottom menu(64px) 위 고정, 데스크탑: body content 내 하단 */}
      <div className="fixed bottom-[64px] left-0 right-0 lg:absolute lg:bottom-0 bg-gradient-to-t from-white via-white to-transparent pt-4 pb-4 z-20">
        <div className="max-w-[768px] mx-auto px-4 lg:px-6">
          <div className="bg-white rounded-[16px] border border-[#e0e0e0] p-[9px] shadow-lg">
           {/* 이미지 미리보기 영역 */}
           {imagePreview && (
             <div className="relative inline-block mb-2">
               <img
                 src={imagePreview}
                 alt="미리보기"
                 className="max-h-[100px] rounded-lg object-cover border border-gray-200"
               />
               <button
                 type="button"
                 onClick={clearSelectedImage}
                 className="absolute -top-2 -right-2 w-6 h-6 bg-gray-800 text-white rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors"
               >
                 <X size={14} />
               </button>
             </div>
           )}

           {/* Top Row: Icon + Input + Send Button */}
           <form onSubmit={handleSubmit} className="flex items-center gap-2 mb-2 relative h-[40px]">
               {/* Hidden file input */}
               <input
                 ref={fileInputRef}
                 type="file"
                 accept="image/jpeg,image/png,image/gif,image/webp"
                 onChange={handleImageSelect}
                 className="hidden"
               />

               {/* Image icon only shows for nutrition agent */}
               {activeTab === 'nutrition' && (
                 <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 transition-colors ${
                      imagePreview
                        ? 'text-[#00C8B4] bg-[#e6faf8]'
                        : 'text-[#99A1AF] hover:bg-gray-100'
                    }`}
                    disabled={isLoading}
                    title="이미지 첨부"
                 >
                    <ImageIcon size={20} strokeWidth={1.66} />
                 </button>
               )}

               <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={imagePreview ? "이미지에 대해 질문하세요 (선택사항)" : "메시지를 입력하세요"}
                  className="flex-1 h-full bg-transparent outline-none text-[14px] text-[#1E2939] placeholder-[rgba(30,41,57,0.5)]"
                  disabled={isLoading}
               />

               <button
                  type="submit"
                  disabled={(!message.trim() && !selectedImage) || isLoading}
                  className="w-8 h-8 flex items-center justify-center rounded-full transition-colors flex-shrink-0"
                  style={{
                     background: (message.trim() || selectedImage) && !isLoading ? 'linear-gradient(135deg, rgb(0, 200, 180) 0%, rgb(159, 122, 234) 100%)' : '#F3F4F6'
                  }}
               >
                  <Send
                     size={14}
                     color={(message.trim() || selectedImage) && !isLoading ? '#FFFFFF' : '#9CA3AF'}
                     style={{
                        transform: (message.trim() || selectedImage) && !isLoading ? 'rotate(45deg)' : 'rotate(0deg)',
                        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                     }}
                  />
               </button>
           </form>

           {/* Bottom Row: Divider + Custom Info Dropdown */}
           <div className="border-t border-gray-100 pt-[4px] flex items-center justify-between h-[33.5px]">
              <div className="flex items-center gap-2">
                 <span className="text-[11px] text-gray-500">맞춤 정보:</span>
                 <div className="relative flex items-center gap-1 cursor-pointer">
                    <span className="text-[11px] text-[#00c8b4] font-medium">{selectedProfile}</span>
                    <ChevronDown size={12} color="#00C8B4" />
                    <select
                      value={selectedProfile}
                      onChange={(e) => setSelectedProfile(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      disabled={isLoading}
                    >
                      <option value="신장병 환우">신장병 환우</option>
                      <option value="일반인">일반인(간병인)</option>
                      <option value="연구자">연구자</option>
                    </select>
                 </div>
              </div>
              {sessionId && (
                <span className="text-[9px] text-gray-400">
                  Session: {sessionId.substring(0, 8)}...
                </span>
              )}
           </div>
          </div>
        </div>
      </div>
    </div>
  );
}
