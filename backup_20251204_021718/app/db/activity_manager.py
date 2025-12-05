"""
활동 이력 관리 데이터베이스 매니저
비회원/회원의 모든 활동 이력을 AES-256 암호화하여 저장

컬렉션:
- guest_sessions: 비회원 세션 관리
- chat_history: AI 챗봇 대화 이력 (세션별/사용자별)
- meal_records: 식단 기록
- quiz_history: 퀴즈 응시 이력
- community_activity_logs: 커뮤니티 활동 로그
"""
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING
from typing import Optional, Dict, List, Any, Literal
from datetime import datetime, timedelta
from bson import ObjectId
import os
import secrets
import logging
from dotenv import load_dotenv

from app.services.encryption_service import (
    encryption_service,
    encrypt_chat_data,
    decrypt_chat_data,
    CHAT_DATA_FIELDS,
    MEAL_DATA_FIELDS,
)

load_dotenv()

logger = logging.getLogger(__name__)


class ActivityManager:
    """활동 이력 관리 데이터베이스 매니저"""

    # 암호화 대상 필드 정의
    CHAT_ENCRYPT_FIELDS = [
        "user_message",
        "assistant_message",
        "context",
        "feedback_text",
    ]

    MEAL_ENCRYPT_FIELDS = [
        "food_name",
        "meal_description",
        "nutrition_analysis",
        "user_notes",
    ]

    QUIZ_ENCRYPT_FIELDS = [
        "user_answer",
        "feedback_text",
    ]

    COMMUNITY_ENCRYPT_FIELDS = [
        "action_detail",
        "content_preview",
    ]

    def __init__(
        self,
        uri: str = None,
        db_name: str = "careguide"
    ):
        self.uri = uri or os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        self.db_name = db_name
        self.client: Optional[AsyncIOMotorClient] = None
        self.db = None
        self._connected = False

    async def connect(self):
        """MongoDB 연결"""
        if not self._connected:
            self.client = AsyncIOMotorClient(
                self.uri,
                maxPoolSize=50,
                minPoolSize=5,
                maxIdleTimeMS=30000,
                serverSelectionTimeoutMS=5000
            )
            self.db = self.client[self.db_name]
            await self._create_indexes()
            self._connected = True
            logger.info(f"ActivityManager connected to {self.db_name}")

    async def close(self):
        """연결 종료"""
        if self.client:
            self.client.close()
            self._connected = False
            logger.info("ActivityManager connection closed")

    async def _create_indexes(self):
        """인덱스 생성"""
        try:
            # ==================== guest_sessions 인덱스 ====================
            await self.db.guest_sessions.create_index(
                [("session_id", ASCENDING)],
                unique=True,
                name="guest_session_id_unique"
            )
            await self.db.guest_sessions.create_index(
                [("created_at", DESCENDING)],
                name="guest_session_created_idx"
            )
            await self.db.guest_sessions.create_index(
                [("expires_at", ASCENDING)],
                expireAfterSeconds=0,  # TTL - 자동 삭제
                name="guest_session_ttl"
            )

            # ==================== chat_history 인덱스 ====================
            await self.db.chat_history.create_index(
                [("session_id", ASCENDING), ("created_at", DESCENDING)],
                name="chat_session_idx"
            )
            await self.db.chat_history.create_index(
                [("user_id", ASCENDING), ("created_at", DESCENDING)],
                name="chat_user_idx"
            )
            await self.db.chat_history.create_index(
                [("conversation_id", ASCENDING), ("turn_number", ASCENDING)],
                name="chat_conversation_idx"
            )
            await self.db.chat_history.create_index(
                [("thumbs_up", ASCENDING)],
                name="chat_thumbs_up_idx"
            )
            await self.db.chat_history.create_index(
                [("thumbs_down", ASCENDING)],
                name="chat_thumbs_down_idx"
            )
            await self.db.chat_history.create_index(
                [("satisfaction_score", ASCENDING)],
                name="chat_satisfaction_idx"
            )

            # ==================== meal_records 인덱스 ====================
            await self.db.meal_records.create_index(
                [("session_id", ASCENDING), ("meal_date", DESCENDING)],
                name="meal_session_idx"
            )
            await self.db.meal_records.create_index(
                [("user_id", ASCENDING), ("meal_date", DESCENDING)],
                name="meal_user_idx"
            )
            await self.db.meal_records.create_index(
                [("meal_type", ASCENDING)],
                name="meal_type_idx"
            )

            # ==================== quiz_history 인덱스 ====================
            await self.db.quiz_history.create_index(
                [("session_id", ASCENDING), ("created_at", DESCENDING)],
                name="quiz_session_idx"
            )
            await self.db.quiz_history.create_index(
                [("user_id", ASCENDING), ("created_at", DESCENDING)],
                name="quiz_user_idx"
            )
            await self.db.quiz_history.create_index(
                [("quiz_id", ASCENDING)],
                name="quiz_id_idx"
            )
            await self.db.quiz_history.create_index(
                [("is_correct", ASCENDING)],
                name="quiz_correct_idx"
            )

            # ==================== community_activity_logs 인덱스 ====================
            await self.db.community_activity_logs.create_index(
                [("session_id", ASCENDING), ("created_at", DESCENDING)],
                name="community_session_idx"
            )
            await self.db.community_activity_logs.create_index(
                [("user_id", ASCENDING), ("created_at", DESCENDING)],
                name="community_user_idx"
            )
            await self.db.community_activity_logs.create_index(
                [("action_type", ASCENDING)],
                name="community_action_idx"
            )
            await self.db.community_activity_logs.create_index(
                [("target_type", ASCENDING), ("target_id", ASCENDING)],
                name="community_target_idx"
            )

            logger.info("Activity indexes created")
        except Exception as e:
            logger.warning(f"Index creation warning: {e}")

    # ==================== 게스트 세션 관리 ====================

    async def create_guest_session(
        self,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        ttl_hours: int = 24
    ) -> str:
        """
        게스트(비회원) 세션 생성

        Args:
            ip_address: IP 주소 (암호화 저장)
            user_agent: User-Agent
            ttl_hours: 세션 유효 시간 (시간)

        Returns:
            str: 생성된 세션 ID
        """
        session_id = f"guest_{secrets.token_urlsafe(24)}"
        now = datetime.utcnow()

        # IP 주소 암호화
        encrypted_ip = encryption_service.encrypt(ip_address) if ip_address else None

        doc = {
            "session_id": session_id,
            "ip_address": encrypted_ip,
            "ip_hash": encryption_service.hash_for_search(ip_address) if ip_address else None,
            "user_agent": user_agent,
            "created_at": now,
            "last_activity": now,
            "expires_at": now + timedelta(hours=ttl_hours),
            "is_converted": False,  # 회원 전환 여부
            "converted_user_id": None,
        }

        await self.db.guest_sessions.insert_one(doc)
        logger.info(f"Guest session created: {session_id}")
        return session_id

    async def get_guest_session(self, session_id: str) -> Optional[Dict]:
        """게스트 세션 조회"""
        session = await self.db.guest_sessions.find_one({"session_id": session_id})
        if session and session.get("ip_address"):
            session["ip_address"] = encryption_service.decrypt(session["ip_address"])
        return session

    async def update_guest_session_activity(self, session_id: str) -> bool:
        """게스트 세션 활동 시간 갱신"""
        result = await self.db.guest_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"last_activity": datetime.utcnow()}}
        )
        return result.modified_count > 0

    async def convert_guest_to_user(self, session_id: str, user_id: str) -> bool:
        """게스트 세션을 회원으로 전환 (이력 연결)"""
        result = await self.db.guest_sessions.update_one(
            {"session_id": session_id},
            {"$set": {
                "is_converted": True,
                "converted_user_id": user_id,
                "converted_at": datetime.utcnow()
            }}
        )

        if result.modified_count > 0:
            # 해당 세션의 모든 이력에 user_id 추가
            await self.db.chat_history.update_many(
                {"session_id": session_id, "user_id": None},
                {"$set": {"user_id": user_id}}
            )
            await self.db.meal_records.update_many(
                {"session_id": session_id, "user_id": None},
                {"$set": {"user_id": user_id}}
            )
            await self.db.quiz_history.update_many(
                {"session_id": session_id, "user_id": None},
                {"$set": {"user_id": user_id}}
            )
            await self.db.community_activity_logs.update_many(
                {"session_id": session_id, "user_id": None},
                {"$set": {"user_id": user_id}}
            )
            logger.info(f"Guest session {session_id} converted to user {user_id}")
            return True
        return False

    # ==================== 대화 이력 관리 ====================

    async def create_chat_history(
        self,
        session_id: str,
        user_message: str,
        assistant_message: str,
        agent_type: str = "general",
        conversation_id: Optional[str] = None,
        turn_number: int = 1,
        user_id: Optional[str] = None,
        context: Optional[Dict] = None,
        tokens_used: int = 0,
        response_time_ms: int = 0,
        metadata: Optional[Dict] = None
    ) -> str:
        """
        대화 이력 저장 (암호화)

        Args:
            session_id: 세션 ID (게스트 또는 사용자)
            user_message: 사용자 메시지
            assistant_message: AI 응답
            agent_type: 에이전트 타입 (general, nutrition, research, etc.)
            conversation_id: 대화 그룹 ID (같은 대화 흐름)
            turn_number: 대화 턴 번호
            user_id: 사용자 ID (로그인 회원)
            context: 컨텍스트 정보 (CKD 단계, 투석 여부 등)
            tokens_used: 사용된 토큰 수
            response_time_ms: 응답 시간 (ms)
            metadata: 추가 메타데이터

        Returns:
            str: 생성된 대화 ID
        """
        now = datetime.utcnow()

        # 대화 ID 생성 (새 대화면)
        if not conversation_id:
            conversation_id = f"conv_{secrets.token_urlsafe(16)}"

        doc = {
            "session_id": session_id,
            "user_id": user_id,
            "conversation_id": conversation_id,
            "turn_number": turn_number,
            "agent_type": agent_type,
            "user_message": user_message,
            "assistant_message": assistant_message,
            "context": context,
            "tokens_used": tokens_used,
            "response_time_ms": response_time_ms,
            # 피드백 필드 (나중에 업데이트)
            "thumbs_up": None,
            "thumbs_down": None,
            "satisfaction_score": None,  # 1-5 점수
            "feedback_text": None,
            "feedback_at": None,
            # 메타데이터
            "metadata": metadata or {},
            "created_at": now,
        }

        # 민감 필드 암호화
        doc = encryption_service.encrypt_dict(doc, self.CHAT_ENCRYPT_FIELDS)

        result = await self.db.chat_history.insert_one(doc)
        logger.info(f"Chat history saved: {result.inserted_id} (conv: {conversation_id})")
        return str(result.inserted_id)

    async def update_chat_feedback(
        self,
        chat_id: str,
        thumbs_up: Optional[bool] = None,
        thumbs_down: Optional[bool] = None,
        satisfaction_score: Optional[int] = None,
        feedback_text: Optional[str] = None
    ) -> bool:
        """
        대화 피드백 업데이트

        Args:
            chat_id: 대화 ID
            thumbs_up: 좋아요
            thumbs_down: 싫어요
            satisfaction_score: 만족도 점수 (1-5)
            feedback_text: 피드백 텍스트

        Returns:
            bool: 성공 여부
        """
        update_data = {"feedback_at": datetime.utcnow()}

        if thumbs_up is not None:
            update_data["thumbs_up"] = thumbs_up
        if thumbs_down is not None:
            update_data["thumbs_down"] = thumbs_down
        if satisfaction_score is not None:
            update_data["satisfaction_score"] = satisfaction_score
        if feedback_text is not None:
            update_data["feedback_text"] = encryption_service.encrypt(feedback_text)

        result = await self.db.chat_history.update_one(
            {"_id": ObjectId(chat_id)},
            {"$set": update_data}
        )
        return result.modified_count > 0

    async def get_chat_history(
        self,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        limit: int = 50,
        skip: int = 0,
        decrypt: bool = True
    ) -> List[Dict]:
        """
        대화 이력 조회

        Args:
            session_id: 세션 ID
            user_id: 사용자 ID
            conversation_id: 대화 ID
            limit: 조회 개수
            skip: 스킵 개수
            decrypt: 복호화 여부

        Returns:
            List[Dict]: 대화 이력 목록
        """
        query = {}
        if session_id:
            query["session_id"] = session_id
        if user_id:
            query["user_id"] = user_id
        if conversation_id:
            query["conversation_id"] = conversation_id

        cursor = self.db.chat_history.find(query).sort(
            [("conversation_id", ASCENDING), ("turn_number", ASCENDING)]
        ).skip(skip).limit(limit)

        results = await cursor.to_list(length=limit)

        if decrypt:
            results = [
                encryption_service.decrypt_dict(r, self.CHAT_ENCRYPT_FIELDS)
                for r in results
            ]

        return results

    async def get_chat_stats_for_admin(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        관리자용 대화 통계 조회

        Returns:
            Dict: 대화 통계 (thumbs up/down, 만족도 등)
        """
        match_query = {}
        if start_date or end_date:
            match_query["created_at"] = {}
            if start_date:
                match_query["created_at"]["$gte"] = start_date
            if end_date:
                match_query["created_at"]["$lte"] = end_date

        # 총 대화 수
        total = await self.db.chat_history.count_documents(match_query)

        # Thumbs up/down 통계
        thumbs_up_count = await self.db.chat_history.count_documents(
            {**match_query, "thumbs_up": True}
        )
        thumbs_down_count = await self.db.chat_history.count_documents(
            {**match_query, "thumbs_down": True}
        )

        # 평균 만족도
        satisfaction_pipeline = [
            {"$match": {**match_query, "satisfaction_score": {"$ne": None}}},
            {"$group": {
                "_id": None,
                "avg_score": {"$avg": "$satisfaction_score"},
                "count": {"$sum": 1}
            }}
        ]
        satisfaction_result = await self.db.chat_history.aggregate(satisfaction_pipeline).to_list(1)
        avg_satisfaction = satisfaction_result[0]["avg_score"] if satisfaction_result else None

        # 에이전트별 통계
        agent_pipeline = [
            {"$match": match_query} if match_query else {"$match": {}},
            {"$group": {"_id": "$agent_type", "count": {"$sum": 1}}}
        ]
        agent_stats = {}
        async for doc in self.db.chat_history.aggregate(agent_pipeline):
            agent_stats[doc["_id"] or "unknown"] = doc["count"]

        return {
            "total_conversations": total,
            "thumbs_up_count": thumbs_up_count,
            "thumbs_down_count": thumbs_down_count,
            "thumbs_up_rate": round(thumbs_up_count / total * 100, 2) if total > 0 else 0,
            "thumbs_down_rate": round(thumbs_down_count / total * 100, 2) if total > 0 else 0,
            "avg_satisfaction_score": round(avg_satisfaction, 2) if avg_satisfaction else None,
            "by_agent_type": agent_stats
        }

    # ==================== 식단 기록 관리 ====================

    async def create_meal_record(
        self,
        session_id: str,
        meal_type: Literal["breakfast", "lunch", "dinner", "snack"],
        food_name: str,
        meal_description: Optional[str] = None,
        nutrition_analysis: Optional[Dict] = None,
        image_url: Optional[str] = None,
        user_id: Optional[str] = None,
        meal_date: Optional[datetime] = None,
        user_notes: Optional[str] = None
    ) -> str:
        """
        식단 기록 저장 (암호화)

        Args:
            session_id: 세션 ID
            meal_type: 식사 종류
            food_name: 음식명
            meal_description: 식사 설명
            nutrition_analysis: 영양 분석 결과
            image_url: 음식 이미지 URL
            user_id: 사용자 ID
            meal_date: 식사 일시
            user_notes: 사용자 메모

        Returns:
            str: 생성된 기록 ID
        """
        now = datetime.utcnow()

        doc = {
            "session_id": session_id,
            "user_id": user_id,
            "meal_type": meal_type,
            "meal_date": meal_date or now,
            "food_name": food_name,
            "meal_description": meal_description,
            "nutrition_analysis": nutrition_analysis,
            "image_url": image_url,
            "user_notes": user_notes,
            "created_at": now,
            "updated_at": now,
        }

        # 민감 필드 암호화
        doc = encryption_service.encrypt_dict(doc, self.MEAL_ENCRYPT_FIELDS)

        result = await self.db.meal_records.insert_one(doc)
        logger.info(f"Meal record saved: {result.inserted_id}")
        return str(result.inserted_id)

    async def get_meal_records(
        self,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        meal_type: Optional[str] = None,
        limit: int = 50,
        skip: int = 0,
        decrypt: bool = True
    ) -> List[Dict]:
        """식단 기록 조회"""
        query = {}
        if session_id:
            query["session_id"] = session_id
        if user_id:
            query["user_id"] = user_id
        if meal_type:
            query["meal_type"] = meal_type
        if start_date or end_date:
            query["meal_date"] = {}
            if start_date:
                query["meal_date"]["$gte"] = start_date
            if end_date:
                query["meal_date"]["$lte"] = end_date

        cursor = self.db.meal_records.find(query).sort(
            "meal_date", DESCENDING
        ).skip(skip).limit(limit)

        results = await cursor.to_list(length=limit)

        if decrypt:
            results = [
                encryption_service.decrypt_dict(r, self.MEAL_ENCRYPT_FIELDS)
                for r in results
            ]

        return results

    # ==================== 퀴즈 이력 관리 ====================

    async def create_quiz_history(
        self,
        session_id: str,
        quiz_id: str,
        quiz_title: str,
        user_answer: str,
        correct_answer: str,
        is_correct: bool,
        user_id: Optional[str] = None,
        time_spent_seconds: int = 0,
        points_earned: int = 0,
        feedback_text: Optional[str] = None
    ) -> str:
        """
        퀴즈 응시 이력 저장 (암호화)

        Args:
            session_id: 세션 ID
            quiz_id: 퀴즈 ID
            quiz_title: 퀴즈 제목
            user_answer: 사용자 답변
            correct_answer: 정답
            is_correct: 정답 여부
            user_id: 사용자 ID
            time_spent_seconds: 소요 시간 (초)
            points_earned: 획득 포인트
            feedback_text: 피드백

        Returns:
            str: 생성된 기록 ID
        """
        now = datetime.utcnow()

        doc = {
            "session_id": session_id,
            "user_id": user_id,
            "quiz_id": quiz_id,
            "quiz_title": quiz_title,
            "user_answer": user_answer,
            "correct_answer": correct_answer,
            "is_correct": is_correct,
            "time_spent_seconds": time_spent_seconds,
            "points_earned": points_earned,
            "feedback_text": feedback_text,
            "created_at": now,
        }

        # 민감 필드 암호화
        doc = encryption_service.encrypt_dict(doc, self.QUIZ_ENCRYPT_FIELDS)

        result = await self.db.quiz_history.insert_one(doc)
        logger.info(f"Quiz history saved: {result.inserted_id}")
        return str(result.inserted_id)

    async def get_quiz_history(
        self,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        quiz_id: Optional[str] = None,
        limit: int = 50,
        skip: int = 0,
        decrypt: bool = True
    ) -> List[Dict]:
        """퀴즈 이력 조회"""
        query = {}
        if session_id:
            query["session_id"] = session_id
        if user_id:
            query["user_id"] = user_id
        if quiz_id:
            query["quiz_id"] = quiz_id

        cursor = self.db.quiz_history.find(query).sort(
            "created_at", DESCENDING
        ).skip(skip).limit(limit)

        results = await cursor.to_list(length=limit)

        if decrypt:
            results = [
                encryption_service.decrypt_dict(r, self.QUIZ_ENCRYPT_FIELDS)
                for r in results
            ]

        return results

    async def get_quiz_stats(
        self,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """퀴즈 통계 조회"""
        query = {}
        if user_id:
            query["user_id"] = user_id
        if session_id:
            query["session_id"] = session_id

        total = await self.db.quiz_history.count_documents(query)
        correct = await self.db.quiz_history.count_documents({**query, "is_correct": True})

        # 총 획득 포인트
        points_pipeline = [
            {"$match": query},
            {"$group": {"_id": None, "total_points": {"$sum": "$points_earned"}}}
        ]
        points_result = await self.db.quiz_history.aggregate(points_pipeline).to_list(1)
        total_points = points_result[0]["total_points"] if points_result else 0

        return {
            "total_quizzes": total,
            "correct_count": correct,
            "incorrect_count": total - correct,
            "accuracy_rate": round(correct / total * 100, 2) if total > 0 else 0,
            "total_points_earned": total_points
        }

    # ==================== 커뮤니티 활동 로그 관리 ====================

    async def create_community_activity_log(
        self,
        session_id: str,
        action_type: Literal[
            "view_post", "create_post", "update_post", "delete_post",
            "create_comment", "update_comment", "delete_comment",
            "like_post", "unlike_post", "view_list", "search"
        ],
        target_type: Optional[Literal["post", "comment"]] = None,
        target_id: Optional[str] = None,
        user_id: Optional[str] = None,
        action_detail: Optional[str] = None,
        content_preview: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> str:
        """
        커뮤니티 활동 로그 저장 (암호화)

        Args:
            session_id: 세션 ID
            action_type: 활동 타입
            target_type: 대상 타입 (post, comment)
            target_id: 대상 ID
            user_id: 사용자 ID
            action_detail: 활동 상세 내용
            content_preview: 콘텐츠 미리보기
            metadata: 추가 메타데이터

        Returns:
            str: 생성된 로그 ID
        """
        now = datetime.utcnow()

        doc = {
            "session_id": session_id,
            "user_id": user_id,
            "action_type": action_type,
            "target_type": target_type,
            "target_id": target_id,
            "action_detail": action_detail,
            "content_preview": content_preview,
            "metadata": metadata or {},
            "created_at": now,
        }

        # 민감 필드 암호화
        doc = encryption_service.encrypt_dict(doc, self.COMMUNITY_ENCRYPT_FIELDS)

        result = await self.db.community_activity_logs.insert_one(doc)
        return str(result.inserted_id)

    async def get_community_activity_logs(
        self,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        action_type: Optional[str] = None,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        skip: int = 0,
        decrypt: bool = True
    ) -> List[Dict]:
        """커뮤니티 활동 로그 조회"""
        query = {}
        if session_id:
            query["session_id"] = session_id
        if user_id:
            query["user_id"] = user_id
        if action_type:
            query["action_type"] = action_type
        if target_type:
            query["target_type"] = target_type
        if target_id:
            query["target_id"] = target_id
        if start_date or end_date:
            query["created_at"] = {}
            if start_date:
                query["created_at"]["$gte"] = start_date
            if end_date:
                query["created_at"]["$lte"] = end_date

        cursor = self.db.community_activity_logs.find(query).sort(
            "created_at", DESCENDING
        ).skip(skip).limit(limit)

        results = await cursor.to_list(length=limit)

        if decrypt:
            results = [
                encryption_service.decrypt_dict(r, self.COMMUNITY_ENCRYPT_FIELDS)
                for r in results
            ]

        return results

    async def get_community_stats_for_admin(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """관리자용 커뮤니티 활동 통계"""
        match_query = {}
        if start_date or end_date:
            match_query["created_at"] = {}
            if start_date:
                match_query["created_at"]["$gte"] = start_date
            if end_date:
                match_query["created_at"]["$lte"] = end_date

        # 총 활동 수
        total = await self.db.community_activity_logs.count_documents(match_query)

        # 활동 타입별 통계
        action_pipeline = [
            {"$match": match_query} if match_query else {"$match": {}},
            {"$group": {"_id": "$action_type", "count": {"$sum": 1}}}
        ]
        action_stats = {}
        async for doc in self.db.community_activity_logs.aggregate(action_pipeline):
            action_stats[doc["_id"] or "unknown"] = doc["count"]

        return {
            "total_activities": total,
            "by_action_type": action_stats
        }


# 싱글톤 인스턴스
activity_manager = ActivityManager()
