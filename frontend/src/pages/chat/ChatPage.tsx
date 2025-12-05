import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ParlantClient,
  ParlantEvent,
  Profile,
  SessionState
} from './parlantClient'
import {
  ChatMessage,
  PaperResult,
  PROFILE_LABELS,
  PROFILE_MAX_RESULTS,
  extractAssistantMessages,
  extractPaperResults,
  RecommendedDish,
  IngredientCandidate,
  IngredientCarouselItem
} from './utils'
import { IngredientCardCarousel, IngredientCard } from '../../components/IngredientCardCarousel'
import { sleep } from './sleep'
import NutritionAnalysisCard from '../../components/NutritionAnalysisCard'

const BASE_URL = import.meta.env.VITE_PARLANT_SERVER || 'http://localhost:8800'
const DEFAULT_PROFILE: Profile =
  (import.meta.env.VITE_CARE_GUIDE_DEFAULT_PROFILE as Profile) || 'general'

const agentIdEnv = import.meta.env.VITE_PARLANT_AGENT_ID as string | undefined
const agentNameEnv = import.meta.env.VITE_PARLANT_AGENT_NAME as string | undefined

type AgentType = 'medical_welfare' | 'nutrition' | 'research_paper'

const AGENT_CONFIG = {
  medical_welfare: {
    name: 'Medical & Welfare',
    nameKo: '의료 복지',
    description: 'Healthcare benefits and welfare information'
  },
  nutrition: {
    name: 'Nutrition & Recipe',
    nameKo: '영양 레시피',
    description: 'CKD nutrition analysis and recipe recommendations'
  },
  research_paper: {
    name: 'Research & Papers',
    nameKo: '연구 논문',
    description: 'Medical research papers and literature'
  }
}

// Few-shot 예시 프롬프트
const FEW_SHOT_EXAMPLES = [
  '신장병 환자를 위한 김장 레시피 알려줘',
  '저칼륨 음식 재료 알려줘',
  '투석환자 식단 추천'
]

function MessageBubble({
  message,
  onDishSelect,
  onRecommendedDishSelect,
  onIngredientSelect
}: {
  message: ChatMessage
  onDishSelect?: (dishName: string) => void
  onRecommendedDishSelect?: (dish: RecommendedDish) => void
  onIngredientSelect?: (ingredient: IngredientCard) => void
}) {
  const isUser = message.role === 'user'

  // Handle ingredient_carousel type (저칼륨 식재료 캐러셀)
  if (!isUser && message.type === 'ingredient_carousel' && message.ingredientCarouselData) {
    const carouselData: IngredientCard[] = message.ingredientCarouselData.map(item => ({
      id: item.id,
      name: item.name,
      thumbnail: item.thumbnail,
      potassium: item.potassium,
      category: item.category,
      description: item.description
    }))

    return (
      <div className="flex justify-start mb-3 w-full">
        <div className="max-w-3xl w-full">
          <div className="bg-white text-gray-800 border border-gray-200 rounded-xl px-4 py-3 shadow">
            <div className="text-sm whitespace-pre-wrap leading-relaxed mb-3">{message.text}</div>
            <IngredientCardCarousel
              ingredients={carouselData}
              onSelectIngredient={(ing) => onIngredientSelect?.(ing)}
            />
          </div>
        </div>
      </div>
    )
  }

  // Handle nutrition_analysis type
  if (!isUser && message.type === 'nutrition_analysis') {
    return (
      <div className="flex justify-start mb-3 w-full">
        <div className="max-w-4xl">
          <NutritionAnalysisCard data={message.nutritionData} />
          {message.text && (
            <div className="mt-2 bg-white text-gray-800 border border-gray-200 rounded-xl px-4 py-3 shadow">
              <div className="text-sm whitespace-pre-wrap leading-relaxed">{message.text}</div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Handle dish_selection type with candidate buttons (케이스 1: 단일 요리)
  if (!isUser && message.type === 'dish_selection' && message.dishCandidates) {
    return (
      <div className="flex justify-start mb-3 w-full">
        <div className="max-w-2xl">
          <div className="bg-white text-gray-800 border border-gray-200 rounded-xl px-4 py-3 shadow">
            <div className="text-sm whitespace-pre-wrap leading-relaxed mb-3">{message.text}</div>

            {/* Top-5 Candidate Buttons */}
            <div className="mt-3 space-y-2">
              <div className="text-xs font-semibold text-gray-600 mb-2">🍽️ 요리 후보 (클릭하여 선택)</div>
              <div className="flex flex-wrap gap-2">
                {message.dishCandidates.map((candidate, idx) => (
                  <button
                    key={idx}
                    onClick={() => onDishSelect?.(candidate.dish_name)}
                    className={`px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium
                      ${idx === 0
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      {idx === 0 && <span className="text-emerald-600">✓</span>}
                      <span>{candidate.dish_name}</span>
                      <span className="text-xs opacity-70">({candidate.confidence}%)</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Handle ingredient_single type (케이스 2: 단일 식재료 → 추천 요리)
  if (!isUser && message.type === 'ingredient_single' && message.recommendedDishes) {
    return (
      <div className="flex justify-start mb-3 w-full">
        <div className="max-w-3xl">
          <div className="bg-white text-gray-800 border border-gray-200 rounded-xl px-4 py-3 shadow">
            <div className="text-sm whitespace-pre-wrap leading-relaxed mb-3">{message.text}</div>

            {/* Recommended Dishes Cards */}
            <div className="mt-4 space-y-2">
              <div className="text-xs font-semibold text-gray-600 mb-2">🥗 추천 요리 (클릭하여 선택)</div>
              <div className="grid grid-cols-1 gap-3">
                {message.recommendedDishes.map((dish, idx) => (
                  <button
                    key={idx}
                    onClick={() => onRecommendedDishSelect?.(dish)}
                    className="text-left p-3 rounded-lg border-2 border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-all"
                  >
                    <div className="font-medium text-gray-900">{dish.dishName}</div>
                    <div className="text-xs text-gray-600 mt-1">{dish.description}</div>
                    <div className="flex gap-3 mt-2 text-xs text-gray-500">
                      <span>Na: {dish.estimatedNutrients.sodium}mg</span>
                      <span>K: {dish.estimatedNutrients.potassium}mg</span>
                      <span>P: {dish.estimatedNutrients.phosphorus}mg</span>
                      <span>단백질: {dish.estimatedNutrients.protein}g</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Handle ingredient_multiple type (케이스 3: 복수 식재료 → 영양소 표 + 추천 요리)
  if (!isUser && message.type === 'ingredient_multiple' && message.ingredientCandidates && message.recommendedDishes) {
    return (
      <div className="flex justify-start mb-3 w-full">
        <div className="max-w-4xl">
          <div className="bg-white text-gray-800 border border-gray-200 rounded-xl px-4 py-3 shadow">
            <div className="text-sm whitespace-pre-wrap leading-relaxed mb-3">{message.text}</div>

            {/* Ingredients Nutrition Table */}
            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-600 mb-2">🥕 식재료별 영양소 (100g 기준)</div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">식재료</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">나트륨(mg)</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">칼륨(mg)</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">인(mg)</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">단백질(g)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {message.ingredientCandidates.map((ing, idx) => (
                      <tr key={idx} className="border-t border-gray-200">
                        <td className="px-3 py-2 font-medium text-gray-900">{ing.name}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{ing.nutrients.sodium}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{ing.nutrients.potassium}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{ing.nutrients.phosphorus}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{ing.nutrients.protein}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recommended Dishes */}
            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-600 mb-2">🍳 이 재료들로 만들 수 있는 추천 요리 Top 5</div>
              <div className="grid grid-cols-1 gap-3">
                {message.recommendedDishes.map((dish, idx) => (
                  <button
                    key={idx}
                    onClick={() => onRecommendedDishSelect?.(dish)}
                    className="text-left p-3 rounded-lg border-2 border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-all"
                  >
                    <div className="font-medium text-gray-900">{dish.dishName}</div>
                    <div className="text-xs text-gray-600 mt-1">{dish.description}</div>
                    <div className="flex gap-3 mt-2 text-xs text-gray-500">
                      <span>Na: {dish.estimatedNutrients.sodium}mg</span>
                      <span>K: {dish.estimatedNutrients.potassium}mg</span>
                      <span>P: {dish.estimatedNutrients.phosphorus}mg</span>
                      <span>단백질: {dish.estimatedNutrients.protein}g</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Handle profile_question type with mint background
  const getBubbleStyle = () => {
    if (isUser) return 'bg-blue-600 text-white rounded-br-md'
    if (message.type === 'profile_question') return 'bg-emerald-100 text-gray-800 border border-emerald-300 rounded-bl-md'
    return 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-xl rounded-2xl px-4 py-3 shadow ${getBubbleStyle()}`}>
        {message.imageUrl && (
          <img src={message.imageUrl} alt="uploaded" className="max-w-xs rounded-lg mb-2" />
        )}
        <div className="text-sm whitespace-pre-wrap leading-relaxed">{message.text}</div>
        {!isUser && message.status && message.status !== 'ready' && (
          <div className="mt-1 text-xs text-gray-500">status: {message.status}</div>
        )}
      </div>
    </div>
  )
}

function PaperList({ papers }: { papers: PaperResult[] }) {
  if (!papers.length) return null
  return (
    <div className="mt-6 border border-gray-200 rounded-xl bg-white shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">
          참고 문헌 / 자료 ({papers.length})
        </h3>
      </div>
      <div className="divide-y divide-gray-100">
        {papers.map((paper) => (
          <div key={paper.id} className="px-4 py-3">
            <div className="font-medium text-gray-900">{paper.title || 'Untitled'}</div>
            {paper.authors && (
              <div className="text-xs text-gray-600 mt-1">{paper.authors}</div>
            )}
            {paper.abstract && (
              <div className="text-sm text-gray-700 mt-2">{paper.abstract}</div>
            )}
            <div className="text-xs text-gray-500 mt-2 flex gap-3">
              {paper.source && <span>{paper.source}</span>}
              {paper.url && (
                <a
                  href={paper.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline"
                >
                  원문 보기
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ChatPage() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('nutrition')
  const [session, setSession] = useState<SessionState | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [papers, setPapers] = useState<PaperResult[]>([])
  const [input, setInput] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isBootstrapping, setIsBootstrapping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stopRequested, setStopRequested] = useState(false)
  const stopRequestedRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const parlClient = useMemo(
    () =>
      new ParlantClient({
        baseUrl: BASE_URL,
        agentId: agentIdEnv,
        agentName: agentNameEnv || 'CareGuide_v2',
        defaultProfile: DEFAULT_PROFILE
      }),
    []
  )

  useEffect(() => {
    console.log('[ChatPage] profile changed, bootstrapping session', { profile, selectedAgent })
    let cancelled = false
    const bootstrap = async () => {
      setIsBootstrapping(true)
      setError(null)
      try {
        // Nutrition agent uses FastAPI backend session
        if (selectedAgent === 'nutrition') {
          console.log('[ChatPage] Creating nutrition agent session via FastAPI')
          const response = await fetch('/api/session/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: `user-${Date.now()}` })
          })

          if (!response.ok) {
            throw new Error('Failed to create nutrition session')
          }

          const data = await response.json()
          if (!cancelled) {
            setSession({
              sessionId: data.session_id,
              agentId: 'nutrition-agent',
              profile: profile,
              lastOffset: 0
            })
            setMessages([
              {
                id: `welcome-${Date.now()}`,
                role: 'assistant',
                text: '안녕하세요! 신장병을 위한 영양 식이 관리 정보를 찾아드립니다.\n음식 사진을 올리시거나 궁금한 음식을 말씀해 주세요.',
                type: 'general',
                createdAt: Date.now()
              }
            ])
            setPapers([])
            console.log('[ChatPage] Nutrition session created', data.session_id)
          }
        } else {
          // Other agents use Parlant
          console.log('[ChatPage] Creating Parlant session')
          const sessionState = await parlClient.createSessionForProfile(profile)
          if (!cancelled) {
            setSession(sessionState)
            setMessages([])
            setPapers([])
            console.log('[ChatPage] Parlant bootstrap success', sessionState)
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || '세션 생성 중 오류가 발생했습니다.')
          console.error('[ChatPage] bootstrap error', err)
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false)
          console.log('[ChatPage] bootstrap finished')
        }
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [profile, selectedAgent, parlClient])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setSelectedFile(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDishSelect = async (dishName: string) => {
    console.log('[ChatPage] Dish selected:', dishName)
    if (!session) return

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: dishName,
      createdAt: Date.now()
    }
    setMessages((prev) => [...prev, userMessage])

    setIsSending(true)
    setError(null)

    try {
      // Send selection to nutrition agent
      const formData = new FormData()
      formData.append('session_id', session.sessionId)
      formData.append('user_profile', profile) // Add user profile
      formData.append('text', dishName)

      const response = await fetch('/api/nutrition/analyze', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Nutrition API error: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('[ChatPage] nutrition API response (selection)', data)

      // Add assistant response
      const hasNutritionData = !!data.result?.nutritionData

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: data.result?.response || '영양 분석이 완료되었습니다.',
        type: hasNutritionData ? 'nutrition_analysis' : 'general',
        nutritionData: data.result?.nutritionData,
        createdAt: Date.now()
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (err: any) {
      setError(err?.message || '메시지 전송 중 오류가 발생했습니다.')
      console.error('[ChatPage] handleDishSelect error', err)
    } finally {
      setIsSending(false)
    }
  }

  const handleRecommendedDishSelect = async (dish: RecommendedDish) => {
    console.log('[ChatPage] Recommended dish selected:', dish.dishName)
    if (!session) return

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: dish.dishName,
      createdAt: Date.now()
    }
    setMessages((prev) => [...prev, userMessage])

    setIsSending(true)
    setError(null)

    try {
      // Send selection to nutrition agent
      const formData = new FormData()
      formData.append('session_id', session.sessionId)
      formData.append('user_profile', profile) // Add user profile
      formData.append('text', dish.dishName)

      const response = await fetch('/api/nutrition/analyze', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Nutrition API error: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('[ChatPage] nutrition API response (recommended dish selection)', data)

      // Add assistant response
      const hasNutritionData = !!data.result?.nutritionData

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: data.result?.response || '영양 분석이 완료되었습니다.',
        type: hasNutritionData ? 'nutrition_analysis' : 'general',
        nutritionData: data.result?.nutritionData,
        createdAt: Date.now()
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (err: any) {
      setError(err?.message || '메시지 전송 중 오류가 발생했습니다.')
      console.error('[ChatPage] handleRecommendedDishSelect error', err)
    } finally {
      setIsSending(false)
    }
  }

  const handleIngredientSelect = async (ingredient: IngredientCard) => {
    console.log('[ChatPage] Ingredient selected:', ingredient.name)
    if (!session) return

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: `${ingredient.name}로 만들 수 있는 요리 추천해줘`,
      createdAt: Date.now()
    }
    setMessages((prev) => [...prev, userMessage])

    setIsSending(true)
    setError(null)

    try {
      // Send selection to nutrition agent
      const formData = new FormData()
      formData.append('session_id', session.sessionId)
      formData.append('user_profile', profile)
      formData.append('text', `${ingredient.name}로 만들 수 있는 요리 추천해줘`)

      const response = await fetch('/api/nutrition/analyze', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Nutrition API error: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('[ChatPage] nutrition API response (ingredient selection)', data)

      // Determine message type
      const hasNutritionData = !!data.result?.nutritionData
      const hasRecommendedDishes = !!data.result?.recommendedDishes
      const hasIngredientCarousel = !!data.result?.ingredientCarouselData

      let messageType: ChatMessage['type'] = 'general'
      if (hasNutritionData) {
        messageType = 'nutrition_analysis'
      } else if (hasRecommendedDishes) {
        messageType = 'ingredient_single'
      } else if (hasIngredientCarousel) {
        messageType = 'ingredient_carousel'
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: data.result?.response || '요리를 추천해 드릴게요.',
        type: messageType,
        nutritionData: data.result?.nutritionData,
        recommendedDishes: data.result?.recommendedDishes,
        ingredientCarouselData: data.result?.ingredientCarouselData,
        createdAt: Date.now()
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (err: any) {
      setError(err?.message || '메시지 전송 중 오류가 발생했습니다.')
      console.error('[ChatPage] handleIngredientSelect error', err)
    } finally {
      setIsSending(false)
    }
  }

  const handleFewShotClick = async (example: string) => {
    if (!session || isSending) {
      console.log('[ChatPage] handleFewShotClick blocked - missing session or already sending')
      return
    }

    // Add user message to UI
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: example,
      createdAt: Date.now()
    }
    setMessages((prev) => [...prev, userMessage])

    setIsSending(true)
    setError(null)
    console.log('[ChatPage] handleFewShotClick sending:', example)

    try {
      // Send to nutrition agent
      const formData = new FormData()
      formData.append('session_id', session.sessionId)
      formData.append('text', example)
      formData.append('user_profile', profile) // Add user profile

      const response = await fetch('/api/nutrition/analyze', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Nutrition API error: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('[ChatPage] few-shot nutrition API response', data)

      // Determine message type based on response
      const hasNutritionData = !!data.result?.nutritionData
      const hasDishCandidates = !!data.result?.dishCandidates
      const hasRecommendedDishes = !!data.result?.recommendedDishes
      const hasIngredientCandidates = !!data.result?.ingredientCandidates
      const hasIngredientCarousel = !!data.result?.ingredientCarouselData
      const analysisType = data.result?.analysisType

      let messageType: ChatMessage['type'] = 'general'
      if (hasIngredientCarousel || analysisType === 'ingredient_carousel') {
        messageType = 'ingredient_carousel'
      } else if (hasNutritionData) {
        messageType = 'nutrition_analysis'
      } else if (hasDishCandidates) {
        messageType = 'dish_selection'
      } else if (hasRecommendedDishes && !hasIngredientCandidates) {
        messageType = 'ingredient_single'
      } else if (hasRecommendedDishes && hasIngredientCandidates) {
        messageType = 'ingredient_multiple'
      } else if (analysisType === 'unclear' || analysisType === 'irrelevant' || analysisType === 'error') {
        messageType = 'error'
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: data.result?.response || '분석이 완료되었습니다.',
        type: messageType,
        nutritionData: data.result?.nutritionData,
        dishCandidates: data.result?.dishCandidates,
        recommendedDishes: data.result?.recommendedDishes,
        ingredientCandidates: data.result?.ingredientCandidates,
        ingredientCarouselData: data.result?.ingredientCarouselData,
        analysisType: analysisType,
        createdAt: Date.now()
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (err: any) {
      setError(err?.message || 'Few-shot 예시 처리 중 오류가 발생했습니다.')
      console.error('[ChatPage] handleFewShotClick error', err)
    } finally {
      setIsSending(false)
    }
  }

  const handleSend = async () => {
    if (!session || (!input.trim() && !selectedFile)) {
      console.log('[ChatPage] handleSend blocked - missing session or empty input/file')
      return
    }
    stopRequestedRef.current = false
    setStopRequested(false)
    const text = input.trim() || (selectedFile ? '음식 이미지 분석 요청' : '')
    const currentImagePreview = imagePreview
    const currentFile = selectedFile
    setInput('')
    setIsSending(true)
    setError(null)
    console.log('[ChatPage] handleSend start', {
      sessionId: session.sessionId,
      text,
      hasFile: !!selectedFile,
      agent: selectedAgent
    })

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      imageUrl: currentImagePreview || undefined,
      createdAt: Date.now()
    }
    setMessages((prev) => [...prev, userMessage])

    try {
      // Nutrition agent uses different API endpoint
      if (selectedAgent === 'nutrition') {
        console.log('[ChatPage] calling nutrition API')
        const formData = new FormData()
        formData.append('session_id', session.sessionId)
        formData.append('user_profile', profile) // Add user profile
        if (text) formData.append('text', text)
        if (currentFile) formData.append('image', currentFile)

        const response = await fetch('/api/nutrition/analyze', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          throw new Error(`Nutrition API error: ${response.statusText}`)
        }

        const data = await response.json()
        console.log('[ChatPage] nutrition API response', data)

        // Determine message type based on response
        const hasNutritionData = !!data.result?.nutritionData
        const hasDishCandidates = !!data.result?.dishCandidates
        const hasRecommendedDishes = !!data.result?.recommendedDishes
        const hasIngredientCandidates = !!data.result?.ingredientCandidates
        const hasIngredientCarousel = !!data.result?.ingredientCarouselData
        const analysisType = data.result?.analysisType

        let messageType: ChatMessage['type'] = 'general'
        if (hasIngredientCarousel || analysisType === 'ingredient_carousel') {
          messageType = 'ingredient_carousel'
        } else if (hasNutritionData) {
          messageType = 'nutrition_analysis'
        } else if (hasDishCandidates) {
          messageType = 'dish_selection'
        } else if (hasRecommendedDishes && !hasIngredientCandidates) {
          messageType = 'ingredient_single'
        } else if (hasRecommendedDishes && hasIngredientCandidates) {
          messageType = 'ingredient_multiple'
        } else if (analysisType === 'unclear' || analysisType === 'irrelevant' || analysisType === 'error') {
          messageType = 'error'
        }

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: data.result?.response || '영양 분석이 완료되었습니다.',
          type: messageType,
          nutritionData: data.result?.nutritionData,
          dishCandidates: data.result?.dishCandidates,
          recommendedDishes: data.result?.recommendedDishes,
          ingredientCandidates: data.result?.ingredientCandidates,
          ingredientCarouselData: data.result?.ingredientCarouselData,
          analysisType: analysisType,
          createdAt: Date.now()
        }
        setMessages((prev) => [...prev, assistantMessage])

        // Clear image after successful send
        handleRemoveImage()
      } else {
        // Other agents use Parlant
        await parlClient.postCustomerMessage(session.sessionId, text)
        console.log('[ChatPage] message posted, polling for updates')
        const { offsetDelta } = await pollAgentUpdatesWithBackoff(session)

        setSession((prev) =>
          prev ? { ...prev, lastOffset: prev.lastOffset + offsetDelta } : prev
        )

        // Clear image after successful send
        handleRemoveImage()
      }
    } catch (err: any) {
      setError(err?.message || '메시지 전송 중 오류가 발생했습니다.')
      console.error('[ChatPage] handleSend error', err)
    } finally {
      setIsSending(false)
      console.log('[ChatPage] handleSend finished')
    }
  }

  // Poll Parlant events with backoff (bridge-style)
  const pollAgentUpdatesWithBackoff = async (
    state: SessionState
  ): Promise<{ offsetDelta: number }> => {
    let offset = state.lastOffset
    let delayMs = 800
    const maxDelayMs = 6000
    const maxIdleMs = 10 * 60 * 1000 // 10 minutes without new data
    let lastEventAt = Date.now()
    let attempt = 0

    while (Date.now() - lastEventAt < maxIdleMs) {
      if (stopRequestedRef.current) {
        console.log('[ChatPage] poll stopping - user requested stop')
        break
      }
      attempt += 1
      console.log('[ChatPage] poll attempt', { attempt, offset, delayMs })
      const events = await parlClient.listEvents(state.sessionId, offset)

      if (events.length) {
        const latestOffset = Math.max(...events.map((e) => e.offset || -1))
        offset = latestOffset + 1
        console.log('[ChatPage] poll got events', {
          count: events.length,
          newOffset: offset
        })
        lastEventAt = Date.now()

        // Apply messages/papers to UI immediately
        const newAssistantMessages = extractAssistantMessages(events)
        const newPapers = extractPaperResults(events)
        console.log('[ChatPage] events batch', {
          total: events.length,
          assistant: newAssistantMessages.length,
          papers: newPapers.length
        })

        if (newAssistantMessages.length) {
          setMessages((prev) => [...prev, ...newAssistantMessages])

          // Stop polling if disclaimer is received
          const hasDisclaimer = newAssistantMessages.some((m) =>
            m.text?.includes('⚠️ 이 답변은 교육 목적이며')
          )
          if (hasDisclaimer) {
            console.log('[ChatPage] disclaimer detected - stopping poll')
            stopRequestedRef.current = true
            setStopRequested(true)
          }
        }

        if (newPapers.length) {
          setPapers((prev) => {
            const existingIds = new Set(prev.map((p) => p.id))
            const unique = newPapers.filter((p) => !existingIds.has(p.id))
            return [...prev, ...unique]
          })
        }
      }

      // wait with backoff until idle threshold or stop
      console.log('[ChatPage] poll waiting', { delayMs })
      await sleep(delayMs)
      delayMs = Math.min(Math.round(delayMs * 1.6), maxDelayMs)
    }

    return { offsetDelta: offset - state.lastOffset }
  }

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleNewSession = async () => {
    console.log('[ChatPage] handleNewSession start')
    setMessages([])
    setPapers([])
    setSession(null)
    setError(null)
    setIsBootstrapping(true)
    try {
      const sessionState = await parlClient.createSessionForProfile(profile)
      setSession(sessionState)
      console.log('[ChatPage] handleNewSession success', sessionState)
    } catch (err: any) {
      setError(err?.message || '세션 생성 중 오류가 발생했습니다.')
      console.error('[ChatPage] handleNewSession error', err)
    } finally {
      setIsBootstrapping(false)
      console.log('[ChatPage] handleNewSession finished')
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">CareGuide 챗봇</h1>
          <p className="text-gray-600 mt-1">
            {selectedAgent === 'nutrition'
              ? 'CKD 환자를 위한 영양 분석 및 맞춤형 식단 추천 서비스'
              : 'Parlant 세션을 사용해 하이브리드 검색 기반의 의료 정보를 제공합니다.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-full bg-gray-100 p-1">
            {(['general', 'patient', 'researcher'] as Profile[]).map((p) => (
              <button
                key={p}
                onClick={() => setProfile(p)}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  profile === p ? 'bg-white shadow text-blue-600' : 'text-gray-600'
                }`}
              >
                {PROFILE_LABELS[p]}
              </button>
            ))}
          </div>
          <button
            onClick={handleNewSession}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            새 세션
          </button>
        </div>
      </div>

      {/* Agent Selection */}
      <div className="mt-6 flex gap-4">
        {(Object.keys(AGENT_CONFIG) as AgentType[]).map((agent) => (
          <button
            key={agent}
            onClick={() => setSelectedAgent(agent)}
            className={`flex-1 px-6 py-4 rounded-xl border-2 transition-all ${
              selectedAgent === agent
                ? 'bg-emerald-50 border-emerald-500 shadow-md'
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold text-gray-900">{AGENT_CONFIG[agent].nameKo}</div>
            <div className="text-xs text-gray-500 mt-1">{AGENT_CONFIG[agent].name}</div>
          </button>
        ))}
      </div>

      <div className="mt-4 text-xs text-gray-500 flex gap-3">
        <span>Agent: {agentNameEnv || 'CareGuide_v2'}</span>
        {session?.sessionId && <span>Session: {session.sessionId}</span>}
        <span>Max results: {PROFILE_MAX_RESULTS[profile]} per source</span>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="h-[65vh] overflow-y-auto rounded-2xl bg-gray-50 border border-gray-200 p-4">
            {isBootstrapping && (
              <div className="flex items-center justify-center py-10 text-gray-600 text-sm">
                {selectedAgent === 'nutrition' ? '영양 분석 세션을 준비 중입니다...' : 'Parlant 세션을 준비 중입니다...'}
              </div>
            )}
            {!isBootstrapping && messages.length === 0 && (
              <div className="text-center text-gray-500 text-sm py-10">
                프로필을 선택한 뒤 질문을 입력하세요.
              </div>
            )}

            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onDishSelect={handleDishSelect}
                onRecommendedDishSelect={handleRecommendedDishSelect}
                onIngredientSelect={handleIngredientSelect}
              />
            ))}

            {/* Few-shot Examples (only for nutrition agent when only welcome message exists) */}
            {!isBootstrapping && messages.length === 1 && selectedAgent === 'nutrition' && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-gray-600 mb-2">💡 예시 질문 (클릭하여 입력)</div>
                <div className="flex flex-wrap gap-2">
                  {FEW_SHOT_EXAMPLES.map((example, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleFewShotClick(example)}
                      disabled={isSending}
                      className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-300 text-blue-700 hover:bg-blue-100 text-sm transition-all disabled:opacity-50"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              질문 입력
            </label>

            {/* Image Preview */}
            {imagePreview && (
              <div className="mb-3 relative inline-block">
                <img src={imagePreview} alt="preview" className="max-h-32 rounded-lg" />
                <button
                  onClick={handleRemoveImage}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            )}

            <div className="flex items-end gap-3">
              {/* Image upload button - ONLY for nutrition agent */}
              {selectedAgent === 'nutrition' && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSending || isBootstrapping}
                    className="flex-shrink-0 p-3 rounded-xl border-2 border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                    title="Upload food image"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                </>
              )}

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                rows={3}
                className="flex-1 rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={
                  selectedAgent === 'nutrition'
                    ? '음식 이미지를 업로드하거나 질문을 입력하세요'
                    : '예: 신장이식 후 생활 관리 방법 알려줘'
                }
                disabled={isSending || isBootstrapping}
              />
              <button
                onClick={() => {
                  stopRequestedRef.current = true
                  setStopRequested(true)
                  console.log('[ChatPage] stop requested by user')
                }}
                disabled={!isSending}
                className="h-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white shadow disabled:opacity-50"
              >
                중지
              </button>
              <button
                onClick={handleSend}
                disabled={isSending || isBootstrapping || (!input.trim() && !selectedFile)}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold shadow disabled:opacity-50"
              >
                {isSending ? '전송 중...' : '보내기'}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-800">세션 상태</h3>
            <dl className="mt-3 space-y-2 text-sm text-gray-700">
              <div className="flex justify-between">
                <dt>프로필</dt>
                <dd className="font-medium text-gray-900">{PROFILE_LABELS[profile]}</dd>
              </div>
              <div className="flex justify-between">
                <dt>세션ID</dt>
                <dd className="truncate max-w-[12rem] text-right">
                  {session?.sessionId || '생성 중'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>오프셋</dt>
                <dd>{session?.lastOffset ?? 0}</dd>
              </div>
            </dl>
          </div>

          <PaperList papers={papers} />
        </div>
      </div>
    </div>
  )
}
