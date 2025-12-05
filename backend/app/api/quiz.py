"""
Quiz API Router - RAG 기반 퀴즈 시스템

정책 1: /quiz 페이지: Quiz 에이전트 단독 운영 (RAG 기반 퀴즈 생성)
- CKD 관련 지식 퀴즈 생성
- 사용자 프로필에 맞는 난이도 조절
- 정답 해설 및 학습 포인트 제공
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import logging
import random
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/quiz", tags=["quiz"])


# ========================
# Request/Response Models
# ========================

class QuizRequest(BaseModel):
    """퀴즈 요청 모델"""
    session_id: Optional[str] = Field(None, description="세션 ID")
    category: str = Field(
        "general",
        description="퀴즈 카테고리 (general, nutrition, treatment, medication, lifestyle)"
    )
    difficulty: str = Field(
        "medium",
        description="난이도 (easy, medium, hard)"
    )
    count: int = Field(5, ge=1, le=20, description="퀴즈 개수")
    profile: str = Field("general", description="프로필 유형 (general, patient, researcher)")


class QuizOption(BaseModel):
    """퀴즈 선택지"""
    id: str
    text: str


class QuizQuestion(BaseModel):
    """퀴즈 문제"""
    id: str
    question: str
    options: List[QuizOption]
    category: str
    difficulty: str


class QuizResponse(BaseModel):
    """퀴즈 응답 모델"""
    success: bool
    session_id: str
    questions: List[QuizQuestion]
    total_count: int


class AnswerRequest(BaseModel):
    """정답 제출 요청"""
    session_id: str
    quiz_id: str
    question_id: str
    selected_option: str


class AnswerResponse(BaseModel):
    """정답 확인 응답"""
    success: bool
    is_correct: bool
    correct_answer: str
    explanation: str
    learning_point: Optional[str] = None


class QuizResultRequest(BaseModel):
    """퀴즈 결과 요청"""
    session_id: str
    quiz_id: str


class QuizResultResponse(BaseModel):
    """퀴즈 결과 응답"""
    success: bool
    total_questions: int
    correct_count: int
    score_percentage: float
    category_breakdown: Dict[str, Dict[str, int]]
    recommendations: List[str]


# ========================
# 퀴즈 데이터베이스 (하드코딩)
# ========================

# 정책에 따른 CKD 관련 퀴즈 문제 풀
QUIZ_DATABASE = {
    "general": [
        {
            "id": "gen_001",
            "question": "만성콩팥병(CKD)의 단계는 몇 단계로 구분됩니까?",
            "options": [
                {"id": "a", "text": "3단계"},
                {"id": "b", "text": "4단계"},
                {"id": "c", "text": "5단계"},
                {"id": "d", "text": "6단계"}
            ],
            "correct": "c",
            "explanation": "만성콩팥병(CKD)은 사구체여과율(GFR)에 따라 1단계부터 5단계까지 5개 단계로 구분됩니다.",
            "learning_point": "CKD 1단계: GFR ≥90, CKD 5단계: GFR <15",
            "difficulty": "easy"
        },
        {
            "id": "gen_002",
            "question": "사구체여과율(eGFR)의 정상 수치는 얼마입니까?",
            "options": [
                {"id": "a", "text": "60 mL/min/1.73m² 이상"},
                {"id": "b", "text": "90 mL/min/1.73m² 이상"},
                {"id": "c", "text": "120 mL/min/1.73m² 이상"},
                {"id": "d", "text": "150 mL/min/1.73m² 이상"}
            ],
            "correct": "b",
            "explanation": "정상 eGFR은 90 mL/min/1.73m² 이상입니다. 60-89는 경미한 감소, 15-59는 중등도-중증 감소입니다.",
            "learning_point": "eGFR이 60 미만으로 3개월 이상 지속되면 CKD로 진단합니다.",
            "difficulty": "medium"
        },
        {
            "id": "gen_003",
            "question": "만성콩팥병의 가장 흔한 원인은 무엇입니까?",
            "options": [
                {"id": "a", "text": "외상"},
                {"id": "b", "text": "감염"},
                {"id": "c", "text": "당뇨병과 고혈압"},
                {"id": "d", "text": "유전적 요인"}
            ],
            "correct": "c",
            "explanation": "당뇨병과 고혈압이 CKD의 가장 흔한 원인으로, 전체 원인의 약 60-70%를 차지합니다.",
            "learning_point": "당뇨와 고혈압 관리가 CKD 예방과 진행 억제에 핵심입니다.",
            "difficulty": "easy"
        }
    ],
    "nutrition": [
        {
            "id": "nut_001",
            "question": "CKD 환자가 칼륨 섭취를 제한해야 하는 이유는 무엇입니까?",
            "options": [
                {"id": "a", "text": "체중 증가를 방지하기 위해"},
                {"id": "b", "text": "고칼륨혈증으로 인한 심장 문제를 예방하기 위해"},
                {"id": "c", "text": "소변량을 늘리기 위해"},
                {"id": "d", "text": "뼈를 강화하기 위해"}
            ],
            "correct": "b",
            "explanation": "신장 기능이 저하되면 칼륨 배설이 어려워져 고칼륨혈증이 발생할 수 있고, 이는 부정맥 등 심장 문제를 유발할 수 있습니다.",
            "learning_point": "혈청 칼륨 6.0 mEq/L 이상은 응급 상황입니다.",
            "difficulty": "medium"
        },
        {
            "id": "nut_002",
            "question": "다음 중 칼륨 함량이 가장 높은 식품은?",
            "options": [
                {"id": "a", "text": "사과"},
                {"id": "b", "text": "바나나"},
                {"id": "c", "text": "배"},
                {"id": "d", "text": "포도"}
            ],
            "correct": "b",
            "explanation": "바나나는 100g당 약 358mg의 칼륨을 함유하여 고칼륨 식품입니다. CKD 환자는 섭취량 조절이 필요합니다.",
            "learning_point": "저칼륨 과일: 사과, 배, 포도, 딸기 / 고칼륨 과일: 바나나, 오렌지, 키위, 멜론",
            "difficulty": "easy"
        },
        {
            "id": "nut_003",
            "question": "CKD 3-5단계 비투석 환자의 권장 단백질 섭취량은?",
            "options": [
                {"id": "a", "text": "0.6-0.8 g/kg/일"},
                {"id": "b", "text": "1.0-1.2 g/kg/일"},
                {"id": "c", "text": "1.5-2.0 g/kg/일"},
                {"id": "d", "text": "제한 없음"}
            ],
            "correct": "a",
            "explanation": "비투석 CKD 환자는 신장 부담을 줄이기 위해 단백질 섭취를 0.6-0.8 g/kg/일로 제한하는 것이 권장됩니다.",
            "learning_point": "투석 환자는 단백질 손실을 보충하기 위해 1.2 g/kg/일 이상 섭취가 필요합니다.",
            "difficulty": "medium"
        },
        {
            "id": "nut_004",
            "question": "인(phosphorus) 섭취 제한이 필요한 CKD 환자가 피해야 할 식품은?",
            "options": [
                {"id": "a", "text": "쌀밥"},
                {"id": "b", "text": "콜라 및 가공식품"},
                {"id": "c", "text": "신선한 채소"},
                {"id": "d", "text": "달걀 흰자"}
            ],
            "correct": "b",
            "explanation": "콜라와 가공식품에는 첨가된 인(인산염)이 많이 포함되어 있어 흡수율이 높습니다.",
            "learning_point": "식품첨가물의 인은 90% 이상 흡수되지만, 자연식품의 인은 40-60%만 흡수됩니다.",
            "difficulty": "medium"
        }
    ],
    "treatment": [
        {
            "id": "trt_001",
            "question": "혈액투석은 일반적으로 얼마나 자주 받아야 합니까?",
            "options": [
                {"id": "a", "text": "주 1회, 회당 2시간"},
                {"id": "b", "text": "주 3회, 회당 4시간"},
                {"id": "c", "text": "주 5회, 회당 1시간"},
                {"id": "d", "text": "월 2회, 회당 6시간"}
            ],
            "correct": "b",
            "explanation": "표준 혈액투석은 일반적으로 주 3회, 회당 약 4시간씩 진행됩니다.",
            "learning_point": "투석 효율은 투석 시간, 혈류량, 투석막 종류 등에 따라 달라집니다.",
            "difficulty": "easy"
        },
        {
            "id": "trt_002",
            "question": "복막투석(CAPD)의 특징으로 옳지 않은 것은?",
            "options": [
                {"id": "a", "text": "가정에서 시행할 수 있다"},
                {"id": "b", "text": "복막을 투석막으로 사용한다"},
                {"id": "c", "text": "매일 시행해야 한다"},
                {"id": "d", "text": "혈액투석보다 단백질 손실이 적다"}
            ],
            "correct": "d",
            "explanation": "복막투석은 실제로 혈액투석보다 단백질 손실이 더 많아서 더 많은 단백질 섭취가 필요합니다.",
            "learning_point": "복막투석 환자의 권장 단백질: 1.2-1.3 g/kg/일",
            "difficulty": "hard"
        },
        {
            "id": "trt_003",
            "question": "신장 이식 후 평생 복용해야 하는 약물은?",
            "options": [
                {"id": "a", "text": "항생제"},
                {"id": "b", "text": "진통제"},
                {"id": "c", "text": "면역억제제"},
                {"id": "d", "text": "비타민제"}
            ],
            "correct": "c",
            "explanation": "이식된 신장에 대한 거부반응을 예방하기 위해 면역억제제를 평생 복용해야 합니다.",
            "learning_point": "면역억제제 복용 시 감염 위험이 높아지므로 개인 위생에 주의해야 합니다.",
            "difficulty": "easy"
        }
    ],
    "medication": [
        {
            "id": "med_001",
            "question": "CKD 환자에서 빈혈 치료에 사용되는 약물은?",
            "options": [
                {"id": "a", "text": "EPO(에리스로포이에틴)"},
                {"id": "b", "text": "인슐린"},
                {"id": "c", "text": "스타틴"},
                {"id": "d", "text": "항생제"}
            ],
            "correct": "a",
            "explanation": "EPO는 적혈구 생성을 촉진하는 호르몬으로, CKD로 인한 빈혈 치료에 사용됩니다.",
            "learning_point": "EPO 치료 시 적절한 철분 공급이 함께 필요합니다.",
            "difficulty": "medium"
        },
        {
            "id": "med_002",
            "question": "다음 중 인결합제의 올바른 복용 방법은?",
            "options": [
                {"id": "a", "text": "공복에 복용"},
                {"id": "b", "text": "취침 전 복용"},
                {"id": "c", "text": "식사와 함께 복용"},
                {"id": "d", "text": "아무 때나 복용"}
            ],
            "correct": "c",
            "explanation": "인결합제는 식사에 포함된 인과 결합하여 흡수를 막는 약물이므로 반드시 식사와 함께 복용해야 합니다.",
            "learning_point": "인결합제 종류: 칼슘계, 알루미늄계, 세벨라머, 란타늄 등",
            "difficulty": "medium"
        }
    ],
    "lifestyle": [
        {
            "id": "life_001",
            "question": "CKD 환자의 혈압 목표 수치는 얼마입니까?",
            "options": [
                {"id": "a", "text": "140/90 mmHg 미만"},
                {"id": "b", "text": "130/80 mmHg 미만"},
                {"id": "c", "text": "120/80 mmHg 미만"},
                {"id": "d", "text": "제한 없음"}
            ],
            "correct": "b",
            "explanation": "CKD 환자의 혈압 목표는 일반적으로 130/80 mmHg 미만이며, 최신 KDIGO 가이드라인에서는 120 mmHg 미만을 권장하기도 합니다.",
            "learning_point": "적절한 혈압 관리는 CKD 진행을 늦추는 핵심 요소입니다.",
            "difficulty": "medium"
        },
        {
            "id": "life_002",
            "question": "CKD 환자가 피해야 할 진통제는?",
            "options": [
                {"id": "a", "text": "아세트아미노펜(타이레놀)"},
                {"id": "b", "text": "NSAIDs(이부프로펜, 나프록센)"},
                {"id": "c", "text": "국소 진통 패치"},
                {"id": "d", "text": "모든 진통제"}
            ],
            "correct": "b",
            "explanation": "NSAIDs는 신장 혈류를 감소시켜 신기능을 악화시킬 수 있어 CKD 환자는 피해야 합니다.",
            "learning_point": "아세트아미노펜은 신장에 비교적 안전하지만, 하루 권장량을 초과하지 않도록 주의해야 합니다.",
            "difficulty": "medium"
        }
    ]
}

# 퀴즈 세션 저장소 (실제로는 Redis 사용 권장)
_quiz_sessions: Dict[str, Dict[str, Any]] = {}


# ========================
# 퀴즈 엔드포인트
# ========================

@router.get("/info")
async def quiz_info():
    """퀴즈 서비스 정보"""
    return {
        "service": "CareGuide Quiz API",
        "version": "1.0.0",
        "description": "CKD 관련 지식 퀴즈 (RAG 기반)",
        "categories": list(QUIZ_DATABASE.keys()),
        "difficulties": ["easy", "medium", "hard"],
        "total_questions": sum(len(q) for q in QUIZ_DATABASE.values())
    }


@router.post("/generate", response_model=QuizResponse)
async def generate_quiz(request: QuizRequest):
    """
    퀴즈 생성

    정책 1: /quiz 페이지: Quiz 에이전트 단독 운영

    Args:
        request: QuizRequest

    Returns:
        QuizResponse: 생성된 퀴즈
    """
    try:
        # 세션 ID 생성/확인
        session_id = request.session_id or str(uuid.uuid4())

        # 카테고리별 문제 수집
        if request.category == "all":
            all_questions = []
            for category_questions in QUIZ_DATABASE.values():
                all_questions.extend(category_questions)
        else:
            all_questions = QUIZ_DATABASE.get(request.category, [])

        if not all_questions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid category: {request.category}"
            )

        # 난이도 필터링
        if request.difficulty != "all":
            all_questions = [
                q for q in all_questions
                if q.get("difficulty") == request.difficulty
            ]

        # 랜덤 선택
        count = min(request.count, len(all_questions))
        selected = random.sample(all_questions, count)

        # 퀴즈 ID 생성
        quiz_id = str(uuid.uuid4())

        # 응답 포맷 변환
        questions = []
        for q in selected:
            questions.append(QuizQuestion(
                id=q["id"],
                question=q["question"],
                options=[QuizOption(**opt) for opt in q["options"]],
                category=request.category,
                difficulty=q.get("difficulty", "medium")
            ))

        # 세션에 퀴즈 저장
        _quiz_sessions[quiz_id] = {
            "session_id": session_id,
            "questions": selected,
            "answers": {},
            "created_at": datetime.utcnow().isoformat()
        }

        return QuizResponse(
            success=True,
            session_id=session_id,
            questions=questions,
            total_count=len(questions)
        )

    except Exception as e:
        logger.error(f"Quiz generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/answer", response_model=AnswerResponse)
async def submit_answer(request: AnswerRequest):
    """
    정답 제출

    Args:
        request: AnswerRequest

    Returns:
        AnswerResponse: 정답 확인 및 해설
    """
    try:
        # 퀴즈 세션 확인
        quiz_session = _quiz_sessions.get(request.quiz_id)
        if not quiz_session:
            raise HTTPException(status_code=404, detail="Quiz session not found")

        # 문제 찾기
        question = None
        for q in quiz_session["questions"]:
            if q["id"] == request.question_id:
                question = q
                break

        if not question:
            raise HTTPException(status_code=404, detail="Question not found")

        # 정답 확인
        is_correct = request.selected_option == question["correct"]

        # 답변 기록
        quiz_session["answers"][request.question_id] = {
            "selected": request.selected_option,
            "correct": question["correct"],
            "is_correct": is_correct
        }

        # 정답 텍스트 찾기
        correct_text = next(
            (opt["text"] for opt in question["options"] if opt["id"] == question["correct"]),
            ""
        )

        return AnswerResponse(
            success=True,
            is_correct=is_correct,
            correct_answer=correct_text,
            explanation=question["explanation"],
            learning_point=question.get("learning_point")
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Answer submission error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/result", response_model=QuizResultResponse)
async def get_quiz_result(request: QuizResultRequest):
    """
    퀴즈 결과 조회

    Args:
        request: QuizResultRequest

    Returns:
        QuizResultResponse: 퀴즈 결과 및 통계
    """
    try:
        quiz_session = _quiz_sessions.get(request.quiz_id)
        if not quiz_session:
            raise HTTPException(status_code=404, detail="Quiz session not found")

        answers = quiz_session.get("answers", {})
        questions = quiz_session.get("questions", [])

        total = len(questions)
        correct = sum(1 for a in answers.values() if a.get("is_correct"))

        # 카테고리별 분석
        category_breakdown = {}
        for q in questions:
            cat = q.get("category", "general")
            if cat not in category_breakdown:
                category_breakdown[cat] = {"total": 0, "correct": 0}
            category_breakdown[cat]["total"] += 1

            answer = answers.get(q["id"])
            if answer and answer.get("is_correct"):
                category_breakdown[cat]["correct"] += 1

        # 추천 생성
        recommendations = []
        for cat, stats in category_breakdown.items():
            if stats["total"] > 0:
                rate = stats["correct"] / stats["total"]
                if rate < 0.5:
                    recommendations.append(f"'{cat}' 분야 학습을 권장드립니다.")

        if not recommendations:
            recommendations.append("잘하셨습니다! 모든 분야에서 좋은 성적을 거두셨습니다.")

        return QuizResultResponse(
            success=True,
            total_questions=total,
            correct_count=correct,
            score_percentage=(correct / total * 100) if total > 0 else 0,
            category_breakdown=category_breakdown,
            recommendations=recommendations
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Result retrieval error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/categories")
async def get_categories():
    """퀴즈 카테고리 목록"""
    return {
        "categories": [
            {"id": "general", "name": "일반 상식", "description": "CKD 기본 지식"},
            {"id": "nutrition", "name": "영양/식이", "description": "식단 및 영양소 관리"},
            {"id": "treatment", "name": "치료", "description": "투석, 이식 등 치료법"},
            {"id": "medication", "name": "약물", "description": "약물 복용 및 관리"},
            {"id": "lifestyle", "name": "생활습관", "description": "일상 생활 관리"}
        ]
    }
