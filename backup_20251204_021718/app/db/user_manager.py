"""
회원 관리 데이터베이스 매니저
MongoDB를 사용한 사용자 및 건강기록 CRUD 작업
개인정보 AES-256 암호화 적용
"""
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
from bson import ObjectId
import os
import logging
from dotenv import load_dotenv

# 암호화 서비스 임포트
from app.services.encryption_service import (
    encryption_service,
    PERSONAL_DATA_FIELDS,
    HEALTH_DATA_FIELDS
)

load_dotenv()

logger = logging.getLogger(__name__)

# 관리자 이메일 목록 (하드코딩 - 보안상 환경변수로 관리 권장)
ADMIN_EMAILS = [
    "yimyj1210@gmail.com",
    "blanket1210@naver.com"
]

# 사용자 암호화 필드 (개인정보)
USER_ENCRYPT_FIELDS = ["name", "nickname", "phone", "birthDate"]

# personal_info 내부 암호화 필드
PERSONAL_INFO_ENCRYPT_FIELDS = ["birthDate"]

# disease_info 내부 암호화 필드
DISEASE_INFO_ENCRYPT_FIELDS = ["otherConditionMemo"]


class UserDBManager:
    """회원 관리 데이터베이스 매니저"""

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
            logger.info(f"✅ UserDBManager connected to {self.db_name}")

    async def close(self):
        """연결 종료"""
        if self.client:
            self.client.close()
            self._connected = False
            logger.info("UserDBManager connection closed")

    async def _create_indexes(self):
        """인덱스 생성"""
        try:
            # users 컬렉션 인덱스
            await self.db.users.create_index(
                [("email", ASCENDING)],
                unique=True,
                name="email_unique"
            )
            await self.db.users.create_index(
                [("created_at", DESCENDING)],
                name="created_at_idx"
            )
            await self.db.users.create_index(
                [("is_active", ASCENDING)],
                name="is_active_idx"
            )
            await self.db.users.create_index(
                [("role", ASCENDING)],
                name="role_idx"
            )

            # health_records 컬렉션 인덱스
            await self.db.health_records.create_index(
                [("user_id", ASCENDING)],
                name="user_id_idx"
            )
            await self.db.health_records.create_index(
                [("user_id", ASCENDING), ("created_at", DESCENDING)],
                name="user_records_idx"
            )

            # token_blacklist 컬렉션 인덱스 (TTL)
            await self.db.token_blacklist.create_index(
                [("token", ASCENDING)],
                unique=True,
                name="token_unique"
            )
            await self.db.token_blacklist.create_index(
                [("expires_at", ASCENDING)],
                expireAfterSeconds=0,  # TTL index - 자동 삭제
                name="token_ttl"
            )

            # withdrawal_records 컬렉션 인덱스 (탈퇴 기록)
            await self.db.withdrawal_records.create_index(
                [("user_id", ASCENDING)],
                name="withdrawal_user_idx"
            )

            # session_logs 컬렉션 인덱스 (세션 로그)
            await self.db.session_logs.create_index(
                [("created_at", DESCENDING)],
                name="session_created_at_idx"
            )
            await self.db.session_logs.create_index(
                [("user_id", ASCENDING), ("created_at", DESCENDING)],
                name="session_user_idx"
            )
            await self.db.session_logs.create_index(
                [("role", ASCENDING)],
                name="session_role_idx"
            )
            await self.db.session_logs.create_index(
                [("action", ASCENDING)],
                name="session_action_idx"
            )

            # notifications 컬렉션 인덱스 (알림)
            await self.db.notifications.create_index(
                [("user_id", ASCENDING), ("created_at", DESCENDING)],
                name="notification_user_idx"
            )
            await self.db.notifications.create_index(
                [("user_id", ASCENDING), ("is_read", ASCENDING)],
                name="notification_unread_idx"
            )
            await self.db.notifications.create_index(
                [("scheduled_at", ASCENDING)],
                name="notification_scheduled_idx"
            )

            logger.info("✅ User DB indexes created")
        except Exception as e:
            logger.warning(f"Index creation warning: {e}")

    # ==================== 사용자 CRUD ====================

    async def create_user(self, user_data: Dict) -> str:
        """
        새 사용자 생성 (개인정보 암호화 적용)

        Args:
            user_data: 사용자 정보 딕셔너리

        Returns:
            str: 생성된 사용자 ID
        """
        now = datetime.utcnow()

        # 관리자 이메일인 경우 role을 admin으로 설정
        email = user_data.get("email", "")
        role = "admin" if email in ADMIN_EMAILS else user_data.get("role", "user")

        # 토큰 제한: admin은 무제한(-1), user는 1500
        token_limit = -1 if role == "admin" else 1500

        # 약관 동의 정보 추출
        terms_agreement = user_data.pop("terms_agreement", None)

        # 개인정보 암호화 (name, nickname, phone)
        encrypted_data = user_data.copy()
        for field in USER_ENCRYPT_FIELDS:
            if field in encrypted_data and encrypted_data[field]:
                encrypted_data[field] = encryption_service.encrypt(str(encrypted_data[field]))
                encrypted_data[f"{field}_hash"] = encryption_service.hash_for_search(str(user_data[field]))

        # personal_info 내부 암호화
        if "personal_info" in encrypted_data and encrypted_data["personal_info"]:
            personal_info = encrypted_data["personal_info"].copy() if isinstance(encrypted_data["personal_info"], dict) else encrypted_data["personal_info"]
            if isinstance(personal_info, dict):
                for field in PERSONAL_INFO_ENCRYPT_FIELDS:
                    if field in personal_info and personal_info[field]:
                        original_value = personal_info[field]
                        personal_info[field] = encryption_service.encrypt(str(original_value))
                encrypted_data["personal_info"] = personal_info

        # disease_info 내부 암호화
        if "disease_info" in encrypted_data and encrypted_data["disease_info"]:
            disease_info = encrypted_data["disease_info"].copy() if isinstance(encrypted_data["disease_info"], dict) else encrypted_data["disease_info"]
            if isinstance(disease_info, dict):
                for field in DISEASE_INFO_ENCRYPT_FIELDS:
                    if field in disease_info and disease_info[field]:
                        disease_info[field] = encryption_service.encrypt(str(disease_info[field]))
                encrypted_data["disease_info"] = disease_info

        doc = {
            **encrypted_data,
            "role": role,
            "is_active": True,
            "is_verified": False,
            "created_at": now,
            "updated_at": now,
            "last_login": None,
            "deleted_at": None,
            # 신규 회원 기본값
            "points": 0,  # 포인트 0P
            "knowledge_level": 0,  # 지식레벨 - (0은 레벨 없음)
            "tokens": token_limit,  # 토큰: admin 무제한(-1), user 1500
            "tokens_used": 0,  # 사용한 토큰
            "subscription": None,  # 구독: 없음
            # 약관 동의 정보
            "terms_agreement": terms_agreement or {
                "service_terms": False,
                "privacy_required": False,
                "privacy_optional": False,
                "marketing": False,
                "agreed_at": None
            }
        }

        result = await self.db.users.insert_one(doc)
        logger.info(f"✅ User created: {result.inserted_id} (role: {role}, encrypted: True)")
        return str(result.inserted_id)

    async def get_user_by_id(self, user_id: str, decrypt: bool = True) -> Optional[Dict]:
        """ID로 사용자 조회 (활성 사용자만, 복호화 옵션)"""
        try:
            user = await self.db.users.find_one({
                "_id": ObjectId(user_id),
                "is_active": True,
                "deleted_at": None
            })
            if user and decrypt:
                user = self._decrypt_user_data(user)
            return user
        except Exception as e:
            logger.error(f"Error getting user by ID: {e}")
            return None

    def _decrypt_user_data(self, user: Dict) -> Dict:
        """사용자 데이터 복호화"""
        try:
            decrypted = user.copy()

            # 기본 필드 복호화
            for field in USER_ENCRYPT_FIELDS:
                if field in decrypted and decrypted[field]:
                    try:
                        decrypted[field] = encryption_service.decrypt(decrypted[field])
                    except Exception:
                        pass  # 암호화되지 않은 레거시 데이터

            # personal_info 복호화
            if "personal_info" in decrypted and decrypted["personal_info"]:
                personal_info = decrypted["personal_info"]
                if isinstance(personal_info, dict):
                    for field in PERSONAL_INFO_ENCRYPT_FIELDS:
                        if field in personal_info and personal_info[field]:
                            try:
                                personal_info[field] = encryption_service.decrypt(personal_info[field])
                            except Exception:
                                pass

            # disease_info 복호화
            if "disease_info" in decrypted and decrypted["disease_info"]:
                disease_info = decrypted["disease_info"]
                if isinstance(disease_info, dict):
                    for field in DISEASE_INFO_ENCRYPT_FIELDS:
                        if field in disease_info and disease_info[field]:
                            try:
                                disease_info[field] = encryption_service.decrypt(disease_info[field])
                            except Exception:
                                pass

            return decrypted
        except Exception as e:
            logger.error(f"Error decrypting user data: {e}")
            return user

    async def get_user_by_email(self, email: str, decrypt: bool = True) -> Optional[Dict]:
        """이메일로 사용자 조회 (활성 사용자만, 복호화 옵션)"""
        user = await self.db.users.find_one({
            "email": email,
            "is_active": True,
            "deleted_at": None
        })
        if user and decrypt:
            user = self._decrypt_user_data(user)
        return user

    async def get_user_by_email_include_inactive(self, email: str, decrypt: bool = True) -> Optional[Dict]:
        """이메일로 사용자 조회 (탈퇴 사용자 포함, 복호화 옵션)"""
        user = await self.db.users.find_one({"email": email})
        if user and decrypt:
            user = self._decrypt_user_data(user)
        return user

    async def update_user(self, user_id: str, update_data: Dict) -> bool:
        """사용자 정보 업데이트"""
        try:
            update_data["updated_at"] = datetime.utcnow()
            result = await self.db.users.update_one(
                {"_id": ObjectId(user_id), "is_active": True},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error updating user: {e}")
            return False

    async def update_last_login(self, user_id: str) -> bool:
        """마지막 로그인 시간 업데이트"""
        try:
            result = await self.db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"last_login": datetime.utcnow()}}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error updating last login: {e}")
            return False

    async def update_password(self, user_id: str, hashed_password: str) -> bool:
        """비밀번호 업데이트"""
        try:
            result = await self.db.users.update_one(
                {"_id": ObjectId(user_id), "is_active": True},
                {"$set": {
                    "password": hashed_password,
                    "updated_at": datetime.utcnow()
                }}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error updating password: {e}")
            return False

    async def soft_delete_user(
        self,
        user_id: str,
        reason: Optional[str] = None,
        feedback: Optional[str] = None
    ) -> bool:
        """
        사용자 소프트 삭제 (회원 탈퇴)

        Args:
            user_id: 사용자 ID
            reason: 탈퇴 사유
            feedback: 피드백

        Returns:
            bool: 성공 여부
        """
        try:
            now = datetime.utcnow()

            # 사용자 비활성화
            result = await self.db.users.update_one(
                {"_id": ObjectId(user_id), "is_active": True},
                {"$set": {
                    "is_active": False,
                    "deleted_at": now,
                    "updated_at": now
                }}
            )

            if result.modified_count > 0:
                # 탈퇴 기록 저장
                await self.db.withdrawal_records.insert_one({
                    "user_id": ObjectId(user_id),
                    "reason": reason,
                    "feedback": feedback,
                    "withdrawn_at": now
                })
                logger.info(f"✅ User soft deleted: {user_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error soft deleting user: {e}")
            return False

    async def check_email_exists(self, email: str) -> bool:
        """이메일 존재 여부 확인"""
        count = await self.db.users.count_documents({"email": email})
        return count > 0

    # ==================== 건강 기록 CRUD ====================

    async def create_health_record(self, user_id: str, record_data: Dict) -> str:
        """
        건강 기록 생성

        Args:
            user_id: 사용자 ID
            record_data: 건강 기록 데이터

        Returns:
            str: 생성된 기록 ID
        """
        now = datetime.utcnow()

        # BMI 계산
        bmi = None
        if record_data.get("height") and record_data.get("weight"):
            height_m = record_data["height"] / 100  # cm to m
            bmi = round(record_data["weight"] / (height_m ** 2), 1)

        doc = {
            "user_id": ObjectId(user_id),
            **record_data,
            "bmi": bmi,
            "created_at": now,
            "updated_at": now
        }

        result = await self.db.health_records.insert_one(doc)
        logger.info(f"✅ Health record created: {result.inserted_id}")
        return str(result.inserted_id)

    async def get_health_record(self, record_id: str) -> Optional[Dict]:
        """건강 기록 조회"""
        try:
            record = await self.db.health_records.find_one({
                "_id": ObjectId(record_id)
            })
            return record
        except Exception as e:
            logger.error(f"Error getting health record: {e}")
            return None

    async def get_user_health_records(
        self,
        user_id: str,
        limit: int = 10,
        skip: int = 0
    ) -> List[Dict]:
        """사용자의 건강 기록 목록 조회"""
        try:
            cursor = self.db.health_records.find(
                {"user_id": ObjectId(user_id)}
            ).sort("created_at", DESCENDING).skip(skip).limit(limit)

            records = await cursor.to_list(length=limit)
            return records
        except Exception as e:
            logger.error(f"Error getting user health records: {e}")
            return []

    async def get_latest_health_record(self, user_id: str) -> Optional[Dict]:
        """사용자의 최신 건강 기록 조회"""
        try:
            record = await self.db.health_records.find_one(
                {"user_id": ObjectId(user_id)},
                sort=[("created_at", DESCENDING)]
            )
            return record
        except Exception as e:
            logger.error(f"Error getting latest health record: {e}")
            return None

    async def update_health_record(self, record_id: str, update_data: Dict) -> bool:
        """건강 기록 업데이트"""
        try:
            # BMI 재계산
            if "height" in update_data or "weight" in update_data:
                record = await self.get_health_record(record_id)
                if record:
                    height = update_data.get("height", record.get("height"))
                    weight = update_data.get("weight", record.get("weight"))
                    if height and weight:
                        height_m = height / 100
                        update_data["bmi"] = round(weight / (height_m ** 2), 1)

            update_data["updated_at"] = datetime.utcnow()

            result = await self.db.health_records.update_one(
                {"_id": ObjectId(record_id)},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error updating health record: {e}")
            return False

    async def delete_health_record(self, record_id: str, user_id: str) -> bool:
        """건강 기록 삭제 (소유자 확인)"""
        try:
            result = await self.db.health_records.delete_one({
                "_id": ObjectId(record_id),
                "user_id": ObjectId(user_id)
            })
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting health record: {e}")
            return False

    async def delete_all_user_health_records(self, user_id: str) -> int:
        """사용자의 모든 건강 기록 삭제"""
        try:
            result = await self.db.health_records.delete_many({
                "user_id": ObjectId(user_id)
            })
            return result.deleted_count
        except Exception as e:
            logger.error(f"Error deleting user health records: {e}")
            return 0

    # ==================== 토큰 블랙리스트 ====================

    async def blacklist_token(
        self,
        token: str,
        user_id: str,
        expires_at: datetime
    ) -> bool:
        """토큰 블랙리스트에 추가"""
        try:
            await self.db.token_blacklist.insert_one({
                "token": token,
                "user_id": ObjectId(user_id),
                "blacklisted_at": datetime.utcnow(),
                "expires_at": expires_at
            })
            return True
        except Exception as e:
            # 이미 존재하는 토큰 (중복 키 에러)
            if "duplicate key" in str(e).lower():
                return True
            logger.error(f"Error blacklisting token: {e}")
            return False

    async def is_token_blacklisted(self, token: str) -> bool:
        """토큰이 블랙리스트에 있는지 확인"""
        try:
            doc = await self.db.token_blacklist.find_one({"token": token})
            return doc is not None
        except Exception as e:
            logger.error(f"Error checking token blacklist: {e}")
            return False

    async def blacklist_all_user_tokens(self, user_id: str) -> int:
        """사용자의 모든 토큰 무효화 (로그아웃 처리용)"""
        # 실제로는 refresh_tokens 컬렉션이 있다면 해당 토큰들을 블랙리스트에 추가
        # 여기서는 단순히 해당 사용자의 블랙리스트 카운트 반환
        try:
            count = await self.db.token_blacklist.count_documents({
                "user_id": ObjectId(user_id)
            })
            return count
        except Exception as e:
            logger.error(f"Error counting blacklisted tokens: {e}")
            return 0

    # ==================== 통계 ====================

    async def get_user_stats(self) -> Dict[str, Any]:
        """사용자 통계 조회"""
        try:
            total = await self.db.users.count_documents({})
            active = await self.db.users.count_documents({
                "is_active": True,
                "deleted_at": None
            })

            # 프로필별 통계
            pipeline = [
                {"$match": {"is_active": True, "deleted_at": None}},
                {"$group": {"_id": "$profile", "count": {"$sum": 1}}}
            ]
            profile_stats = {}
            async for doc in self.db.users.aggregate(pipeline):
                profile_stats[doc["_id"]] = doc["count"]

            return {
                "total_users": total,
                "active_users": active,
                "inactive_users": total - active,
                "by_profile": profile_stats
            }
        except Exception as e:
            logger.error(f"Error getting user stats: {e}")
            return {}

    # ==================== 세션 로그 ====================

    async def create_session_log(
        self,
        action: str,
        role: str = "guest",
        user_id: Optional[str] = None,
        email: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> str:
        """
        세션 로그 생성

        Args:
            action: 액션 타입 (login, logout, signup, page_view, chat, etc.)
            role: 사용자 역할 (admin, user, guest)
            user_id: 사용자 ID (로그인 사용자만)
            email: 사용자 이메일
            ip_address: IP 주소
            user_agent: User-Agent 헤더
            metadata: 추가 메타데이터

        Returns:
            str: 생성된 로그 ID
        """
        now = datetime.utcnow()

        doc = {
            "action": action,
            "role": role,
            "user_id": ObjectId(user_id) if user_id else None,
            "email": email,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "metadata": metadata or {},
            "created_at": now
        }

        result = await self.db.session_logs.insert_one(doc)
        logger.info(f"✅ Session log created: {action} ({role})")
        return str(result.inserted_id)

    async def get_session_logs(
        self,
        role: Optional[str] = None,
        action: Optional[str] = None,
        user_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict]:
        """
        세션 로그 조회

        Args:
            role: 역할 필터 (admin, user, guest)
            action: 액션 필터 (login, logout, etc.)
            user_id: 사용자 ID 필터
            start_date: 시작 날짜
            end_date: 종료 날짜
            limit: 조회 개수
            skip: 스킵 개수

        Returns:
            List[Dict]: 세션 로그 목록
        """
        try:
            query: Dict[str, Any] = {}

            if role:
                query["role"] = role
            if action:
                query["action"] = action
            if user_id:
                query["user_id"] = ObjectId(user_id)

            if start_date or end_date:
                query["created_at"] = {}
                if start_date:
                    query["created_at"]["$gte"] = start_date
                if end_date:
                    query["created_at"]["$lte"] = end_date

            cursor = self.db.session_logs.find(query).sort(
                "created_at", DESCENDING
            ).skip(skip).limit(limit)

            logs = await cursor.to_list(length=limit)
            return logs
        except Exception as e:
            logger.error(f"Error getting session logs: {e}")
            return []

    async def get_session_stats(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        세션 통계 조회 (Backoffice용)

        Args:
            start_date: 시작 날짜
            end_date: 종료 날짜

        Returns:
            Dict: 세션 통계
        """
        try:
            match_query: Dict[str, Any] = {}
            if start_date or end_date:
                match_query["created_at"] = {}
                if start_date:
                    match_query["created_at"]["$gte"] = start_date
                if end_date:
                    match_query["created_at"]["$lte"] = end_date

            # 역할별 통계
            role_pipeline = [
                {"$match": match_query} if match_query else {"$match": {}},
                {"$group": {"_id": "$role", "count": {"$sum": 1}}}
            ]
            role_stats = {}
            async for doc in self.db.session_logs.aggregate(role_pipeline):
                role_stats[doc["_id"] or "unknown"] = doc["count"]

            # 액션별 통계
            action_pipeline = [
                {"$match": match_query} if match_query else {"$match": {}},
                {"$group": {"_id": "$action", "count": {"$sum": 1}}}
            ]
            action_stats = {}
            async for doc in self.db.session_logs.aggregate(action_pipeline):
                action_stats[doc["_id"] or "unknown"] = doc["count"]

            # 총 세션 수
            total = await self.db.session_logs.count_documents(match_query if match_query else {})

            return {
                "total_sessions": total,
                "by_role": role_stats,
                "by_action": action_stats
            }
        except Exception as e:
            logger.error(f"Error getting session stats: {e}")
            return {}

    def is_admin_email(self, email: str) -> bool:
        """관리자 이메일인지 확인"""
        return email in ADMIN_EMAILS

    # ==================== 알림 (Notifications) ====================

    async def create_notification(
        self,
        user_id: str,
        title: str,
        message: str,
        notification_type: str = "system",
        scheduled_at: Optional[datetime] = None,
        metadata: Optional[Dict] = None
    ) -> str:
        """
        알림 생성

        Args:
            user_id: 사용자 ID
            title: 알림 제목
            message: 알림 내용
            notification_type: 알림 타입 (system, welcome, quiz, reward, etc.)
            scheduled_at: 예약 발송 시간 (None이면 즉시 발송)
            metadata: 추가 메타데이터

        Returns:
            str: 생성된 알림 ID
        """
        now = datetime.utcnow()

        doc = {
            "user_id": ObjectId(user_id),
            "title": title,
            "message": message,
            "type": notification_type,
            "is_read": False,
            "scheduled_at": scheduled_at,  # 예약 발송 시간
            "sent_at": now if not scheduled_at else None,  # 즉시 발송이면 현재 시간
            "created_at": now,
            "metadata": metadata or {}
        }

        result = await self.db.notifications.insert_one(doc)
        logger.info(f"✅ Notification created: {result.inserted_id} (type: {notification_type})")
        return str(result.inserted_id)

    async def create_global_notification(
        self,
        title: str,
        message: str,
        notification_type: str = "announcement",
        scheduled_at: Optional[datetime] = None,
        metadata: Optional[Dict] = None
    ) -> str:
        """
        전체 공지 알림 생성 (모든 사용자에게 표시)

        Args:
            title: 알림 제목
            message: 알림 내용
            notification_type: 알림 타입 (기본: announcement)
            scheduled_at: 예약 발송 시간 (None이면 즉시 발송)
            metadata: 추가 메타데이터

        Returns:
            str: 생성된 알림 ID
        """
        now = datetime.utcnow()

        doc = {
            "user_id": "all",  # 전체 공지 표시
            "is_global": True,  # 전체 공지 플래그
            "title": title,
            "message": message,
            "type": notification_type,
            "is_read": False,
            "scheduled_at": scheduled_at,
            "sent_at": now if not scheduled_at else None,
            "created_at": now,
            "metadata": metadata or {}
        }

        result = await self.db.notifications.insert_one(doc)
        logger.info(f"✅ Global notification created: {result.inserted_id} (type: {notification_type})")
        return str(result.inserted_id)

    async def get_user_notifications(
        self,
        user_id: str,
        include_unread_only: bool = False,
        limit: int = 50,
        skip: int = 0
    ) -> List[Dict]:
        """
        사용자 알림 목록 조회 (개인 알림 + 전체 공지)

        Args:
            user_id: 사용자 ID
            include_unread_only: 읽지 않은 알림만 조회
            limit: 조회 개수
            skip: 스킵 개수

        Returns:
            List[Dict]: 알림 목록 (최신순 정렬)
        """
        try:
            now = datetime.utcnow()
            # 개인 알림 또는 전체 공지(user_id가 "all"이거나 없는 경우)
            query: Dict[str, Any] = {
                "$and": [
                    {
                        "$or": [
                            {"user_id": ObjectId(user_id)},  # 개인 알림
                            {"user_id": "all"},  # 전체 공지
                            {"user_id": None},  # 전체 공지 (None인 경우)
                            {"is_global": True}  # 전체 공지 플래그
                        ]
                    },
                    {
                        "$or": [
                            {"scheduled_at": None},  # 즉시 발송
                            {"scheduled_at": {"$lte": now}}  # 예약 시간이 지남
                        ]
                    }
                ]
            }

            if include_unread_only:
                query["$and"].append({"is_read": False})

            cursor = self.db.notifications.find(query).sort(
                "created_at", DESCENDING
            ).skip(skip).limit(limit)

            notifications = await cursor.to_list(length=limit)
            return notifications
        except Exception as e:
            logger.error(f"Error getting notifications: {e}")
            return []

    async def get_unread_notification_count(self, user_id: str) -> int:
        """읽지 않은 알림 개수 조회 (개인 알림 + 전체 공지)"""
        try:
            now = datetime.utcnow()
            count = await self.db.notifications.count_documents({
                "$and": [
                    {
                        "$or": [
                            {"user_id": ObjectId(user_id)},  # 개인 알림
                            {"user_id": "all"},  # 전체 공지
                            {"user_id": None},  # 전체 공지 (None인 경우)
                            {"is_global": True}  # 전체 공지 플래그
                        ]
                    },
                    {"is_read": False},
                    {
                        "$or": [
                            {"scheduled_at": None},
                            {"scheduled_at": {"$lte": now}}
                        ]
                    }
                ]
            })
            return count
        except Exception as e:
            logger.error(f"Error counting unread notifications: {e}")
            return 0

    async def mark_notification_as_read(self, notification_id: str, user_id: str) -> bool:
        """알림 읽음 처리 (개인 알림 또는 전체 공지)"""
        try:
            # 개인 알림 또는 전체 공지 모두 처리
            result = await self.db.notifications.update_one(
                {
                    "_id": ObjectId(notification_id),
                    "$or": [
                        {"user_id": ObjectId(user_id)},  # 개인 알림
                        {"user_id": "all"},  # 전체 공지
                        {"user_id": None},  # 전체 공지
                        {"is_global": True}  # 전체 공지 플래그
                    ]
                },
                {"$set": {"is_read": True, "read_at": datetime.utcnow()}}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error marking notification as read: {e}")
            return False

    async def mark_all_notifications_as_read(self, user_id: str) -> int:
        """모든 알림 읽음 처리 (개인 알림 + 전체 공지)"""
        try:
            now = datetime.utcnow()
            result = await self.db.notifications.update_many(
                {
                    "$and": [
                        {
                            "$or": [
                                {"user_id": ObjectId(user_id)},  # 개인 알림
                                {"user_id": "all"},  # 전체 공지
                                {"user_id": None},  # 전체 공지
                                {"is_global": True}  # 전체 공지 플래그
                            ]
                        },
                        {"is_read": False},
                        {
                            "$or": [
                                {"scheduled_at": None},
                                {"scheduled_at": {"$lte": now}}
                            ]
                        }
                    ]
                },
                {"$set": {"is_read": True, "read_at": now}}
            )
            return result.modified_count
        except Exception as e:
            logger.error(f"Error marking all notifications as read: {e}")
            return 0

    async def delete_notification(self, notification_id: str, user_id: str) -> bool:
        """알림 삭제"""
        try:
            result = await self.db.notifications.delete_one({
                "_id": ObjectId(notification_id),
                "user_id": ObjectId(user_id)
            })
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting notification: {e}")
            return False

    async def process_scheduled_notifications(self) -> int:
        """
        예약된 알림 처리 (백그라운드 작업용)
        scheduled_at이 지났지만 sent_at이 None인 알림들을 처리
        """
        try:
            now = datetime.utcnow()
            result = await self.db.notifications.update_many(
                {
                    "scheduled_at": {"$lte": now},
                    "sent_at": None
                },
                {"$set": {"sent_at": now}}
            )
            if result.modified_count > 0:
                logger.info(f"✅ Processed {result.modified_count} scheduled notifications")
            return result.modified_count
        except Exception as e:
            logger.error(f"Error processing scheduled notifications: {e}")
            return 0

    # ==================== 포인트/토큰 관리 ====================

    async def add_points(self, user_id: str, points: int, reason: str = "") -> bool:
        """포인트 추가"""
        try:
            result = await self.db.users.update_one(
                {"_id": ObjectId(user_id), "is_active": True},
                {
                    "$inc": {"points": points},
                    "$set": {"updated_at": datetime.utcnow()}
                }
            )
            if result.modified_count > 0:
                logger.info(f"✅ Added {points} points to user {user_id}: {reason}")
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error adding points: {e}")
            return False

    async def use_tokens(self, user_id: str, tokens: int) -> bool:
        """토큰 사용 (tokens_used 증가)"""
        try:
            result = await self.db.users.update_one(
                {"_id": ObjectId(user_id), "is_active": True},
                {
                    "$inc": {"tokens_used": tokens},
                    "$set": {"updated_at": datetime.utcnow()}
                }
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error using tokens: {e}")
            return False

    async def get_user_token_info(self, user_id: str) -> Optional[Dict]:
        """사용자 토큰 정보 조회"""
        try:
            user = await self.db.users.find_one(
                {"_id": ObjectId(user_id)},
                {"tokens": 1, "tokens_used": 1, "role": 1}
            )
            if user:
                tokens = user.get("tokens", 1500)
                tokens_used = user.get("tokens_used", 0)
                role = user.get("role", "user")

                # admin은 무제한
                if role == "admin" or tokens == -1:
                    remaining = -1  # 무제한
                else:
                    remaining = max(0, tokens - tokens_used)

                return {
                    "tokens": tokens,
                    "tokens_used": tokens_used,
                    "remaining": remaining,
                    "is_unlimited": tokens == -1
                }
            return None
        except Exception as e:
            logger.error(f"Error getting token info: {e}")
            return None


# 싱글톤 인스턴스
user_db_manager = UserDBManager()
