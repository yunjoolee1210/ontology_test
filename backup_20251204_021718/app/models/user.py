"""
회원 관리 시스템 - Pydantic 모델 정의
CareGuide 프로젝트용 사용자 및 건강기록 스키마
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Literal, Optional, List
from datetime import datetime
from enum import Enum
import re


# ==================== Enums ====================
class UserProfile(str, Enum):
    """사용자 프로필 유형"""
    GENERAL = "general"      # 일반 사용자
    PATIENT = "patient"      # 만성콩팥병 환자
    CAREGIVER = "caregiver"  # 보호자
    RESEARCHER = "researcher"  # 연구자/의료진


class UserRole(str, Enum):
    """사용자 역할"""
    USER = "user"
    ADMIN = "admin"


class CKDStage(str, Enum):
    """만성콩팥병 단계"""
    STAGE_1 = "1"  # GFR >= 90
    STAGE_2 = "2"  # GFR 60-89
    STAGE_3A = "3a"  # GFR 45-59
    STAGE_3B = "3b"  # GFR 30-44
    STAGE_4 = "4"  # GFR 15-29
    STAGE_5 = "5"  # GFR < 15
    DIALYSIS = "dialysis"  # 투석 중
    UNKNOWN = "unknown"


class Gender(str, Enum):
    """성별"""
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


# ==================== 개인정보 ====================
class PersonalInfo(BaseModel):
    """개인 정보"""
    gender: Optional[str] = None  # 남성, 여성, 기타
    birthDate: Optional[str] = None  # YYYY-MM-DD
    height: Optional[float] = Field(None, ge=50, le=300)  # cm
    weight: Optional[float] = Field(None, ge=20, le=500)  # kg


# ==================== 질환정보 ====================
class DiseaseInfo(BaseModel):
    """질환 정보"""
    diagnosisType: Optional[str] = "UNKNOWN"  # 병원 진단명
    ckdStage: Optional[str] = "NONE"  # 신장병 단계
    dialysisType: Optional[str] = "NONE"  # 투석 여부
    baseConditions: Optional[List[str]] = []  # 기저질환
    otherConditionMemo: Optional[str] = None  # 기타 질환 메모


# ==================== 약관 동의 정보 ====================
class TermsAgreement(BaseModel):
    """약관 동의 정보"""
    service_terms: bool = False  # 서비스 이용약관 (필수)
    privacy_required: bool = False  # 개인정보 수집/이용 (필수)
    privacy_optional: bool = False  # 개인정보 수집/이용 (선택)
    marketing: bool = False  # 마케팅 정보 수신 (선택)
    agreed_at: Optional[datetime] = None  # 동의 일시


# ==================== 회원가입 요청 ====================
class UserCreate(BaseModel):
    """회원가입 요청 모델"""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    name: str = Field(..., min_length=2, max_length=50)
    nickname: Optional[str] = Field(None, min_length=2, max_length=30)
    profile: UserProfile = UserProfile.GENERAL
    phone: Optional[str] = None
    personal_info: Optional[PersonalInfo] = None
    disease_info: Optional[DiseaseInfo] = None
    terms_agreement: Optional[TermsAgreement] = None  # 약관 동의 정보

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """비밀번호 강도 검증"""
        if len(v) < 8:
            raise ValueError('비밀번호는 최소 8자 이상이어야 합니다')
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('비밀번호는 최소 하나의 영문자를 포함해야 합니다')
        if not re.search(r'\d', v):
            raise ValueError('비밀번호는 최소 하나의 숫자를 포함해야 합니다')
        return v

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        """전화번호 형식 검증"""
        if v is None:
            return v
        # 숫자만 추출
        phone_digits = re.sub(r'\D', '', v)
        if len(phone_digits) < 10 or len(phone_digits) > 11:
            raise ValueError('유효한 전화번호를 입력해주세요')
        return phone_digits


class UserLogin(BaseModel):
    """로그인 요청 모델"""
    email: EmailStr
    password: str


# ==================== 토큰 응답 ====================
class TokenResponse(BaseModel):
    """토큰 응답 모델"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # 초 단위


class RefreshTokenRequest(BaseModel):
    """토큰 갱신 요청"""
    refresh_token: str


# ==================== 사용자 응답 ====================
class UserResponse(BaseModel):
    """사용자 정보 응답 모델"""
    user_id: str
    email: str
    name: str
    nickname: Optional[str] = None
    profile: str
    role: str
    phone: Optional[str] = None
    profile_image: Optional[str] = None
    personal_info: Optional[PersonalInfo] = None
    disease_info: Optional[DiseaseInfo] = None
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    is_active: bool = True
    # 신규 회원 기본값 필드
    points: int = 0  # 포인트
    knowledge_level: int = 0  # 지식레벨 (0은 레벨 없음, 표시: -)
    tokens: int = 1500  # 토큰 제한 (-1은 무제한)
    tokens_used: int = 0  # 사용한 토큰
    subscription: Optional[str] = None  # 구독 (None은 없음, 표시: -)
    terms_agreement: Optional[TermsAgreement] = None  # 약관 동의 정보


class UserProfileUpdate(BaseModel):
    """사용자 프로필 업데이트 요청"""
    name: Optional[str] = Field(None, min_length=2, max_length=50)
    nickname: Optional[str] = Field(None, min_length=2, max_length=30)
    phone: Optional[str] = None
    profile: Optional[UserProfile] = None
    profile_image: Optional[str] = None


# ==================== 건강 기록 ====================
class HealthRecordCreate(BaseModel):
    """건강 기록 생성 요청"""
    # 기본 정보
    birth_year: Optional[int] = Field(None, ge=1900, le=2100)
    gender: Optional[Gender] = None
    height: Optional[float] = Field(None, ge=50, le=300)  # cm
    weight: Optional[float] = Field(None, ge=20, le=500)  # kg

    # CKD 관련 정보
    ckd_stage: Optional[CKDStage] = CKDStage.UNKNOWN
    diagnosis_name: Optional[str] = None  # 병원 진단명 (예: "만성콩팥병 3기", "당뇨병성 신증")
    diagnosis_code: Optional[str] = None  # ICD-10 진단코드 (예: "N18.3")
    diagnosis_date: Optional[datetime] = None
    diagnosing_hospital: Optional[str] = None  # 진단 병원명
    attending_physician: Optional[str] = None  # 담당 의사명
    is_dialysis: bool = False
    dialysis_type: Optional[Literal["hemodialysis", "peritoneal"]] = None
    dialysis_frequency: Optional[int] = None  # 주당 횟수
    dialysis_start_date: Optional[datetime] = None  # 투석 시작일

    # 검사 수치
    gfr: Optional[float] = Field(None, ge=0, le=200)  # 사구체여과율
    creatinine: Optional[float] = Field(None, ge=0, le=30)  # 크레아티닌 (mg/dL)
    bun: Optional[float] = Field(None, ge=0, le=200)  # 혈중요소질소
    potassium: Optional[float] = Field(None, ge=0, le=15)  # 칼륨 (mEq/L)
    phosphorus: Optional[float] = Field(None, ge=0, le=20)  # 인 (mg/dL)
    albumin: Optional[float] = Field(None, ge=0, le=10)  # 알부민 (g/dL)
    hemoglobin: Optional[float] = Field(None, ge=0, le=25)  # 헤모글로빈 (g/dL)

    # 동반 질환
    has_diabetes: bool = False
    has_hypertension: bool = False
    has_heart_disease: bool = False
    other_conditions: Optional[List[str]] = None

    # 식이 제한
    dietary_restrictions: Optional[List[str]] = None  # 예: ["low_sodium", "low_potassium", "low_protein"]
    daily_fluid_limit: Optional[int] = None  # mL
    daily_protein_limit: Optional[float] = None  # g
    daily_sodium_limit: Optional[int] = None  # mg
    daily_potassium_limit: Optional[int] = None  # mg
    daily_phosphorus_limit: Optional[int] = None  # mg

    # 측정일
    measured_at: Optional[datetime] = None


class HealthRecordResponse(BaseModel):
    """건강 기록 응답 모델"""
    record_id: str
    user_id: str
    birth_year: Optional[int] = None
    gender: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    bmi: Optional[float] = None  # 계산된 값

    ckd_stage: Optional[str] = None
    diagnosis_name: Optional[str] = None
    diagnosis_code: Optional[str] = None
    diagnosis_date: Optional[datetime] = None
    diagnosing_hospital: Optional[str] = None
    attending_physician: Optional[str] = None
    is_dialysis: bool = False
    dialysis_type: Optional[str] = None
    dialysis_frequency: Optional[int] = None
    dialysis_start_date: Optional[datetime] = None

    gfr: Optional[float] = None
    creatinine: Optional[float] = None
    bun: Optional[float] = None
    potassium: Optional[float] = None
    phosphorus: Optional[float] = None
    albumin: Optional[float] = None
    hemoglobin: Optional[float] = None

    has_diabetes: bool = False
    has_hypertension: bool = False
    has_heart_disease: bool = False
    other_conditions: Optional[List[str]] = None

    dietary_restrictions: Optional[List[str]] = None
    daily_fluid_limit: Optional[int] = None
    daily_protein_limit: Optional[float] = None
    daily_sodium_limit: Optional[int] = None
    daily_potassium_limit: Optional[int] = None
    daily_phosphorus_limit: Optional[int] = None

    measured_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class HealthRecordUpdate(BaseModel):
    """건강 기록 업데이트 요청"""
    # 모든 필드가 선택적
    birth_year: Optional[int] = Field(None, ge=1900, le=2100)
    gender: Optional[Gender] = None
    height: Optional[float] = Field(None, ge=50, le=300)
    weight: Optional[float] = Field(None, ge=20, le=500)

    ckd_stage: Optional[CKDStage] = None
    diagnosis_name: Optional[str] = None
    diagnosis_code: Optional[str] = None
    diagnosis_date: Optional[datetime] = None
    diagnosing_hospital: Optional[str] = None
    attending_physician: Optional[str] = None
    is_dialysis: Optional[bool] = None
    dialysis_type: Optional[Literal["hemodialysis", "peritoneal"]] = None
    dialysis_frequency: Optional[int] = None
    dialysis_start_date: Optional[datetime] = None

    gfr: Optional[float] = Field(None, ge=0, le=200)
    creatinine: Optional[float] = Field(None, ge=0, le=30)
    bun: Optional[float] = Field(None, ge=0, le=200)
    potassium: Optional[float] = Field(None, ge=0, le=15)
    phosphorus: Optional[float] = Field(None, ge=0, le=20)
    albumin: Optional[float] = Field(None, ge=0, le=10)
    hemoglobin: Optional[float] = Field(None, ge=0, le=25)

    has_diabetes: Optional[bool] = None
    has_hypertension: Optional[bool] = None
    has_heart_disease: Optional[bool] = None
    other_conditions: Optional[List[str]] = None

    dietary_restrictions: Optional[List[str]] = None
    daily_fluid_limit: Optional[int] = None
    daily_protein_limit: Optional[float] = None
    daily_sodium_limit: Optional[int] = None
    daily_potassium_limit: Optional[int] = None
    daily_phosphorus_limit: Optional[int] = None

    measured_at: Optional[datetime] = None


# ==================== 비밀번호 관련 ====================
class PasswordChangeRequest(BaseModel):
    """비밀번호 변경 요청"""
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)

    @field_validator('new_password')
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('비밀번호는 최소 8자 이상이어야 합니다')
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('비밀번호는 최소 하나의 영문자를 포함해야 합니다')
        if not re.search(r'\d', v):
            raise ValueError('비밀번호는 최소 하나의 숫자를 포함해야 합니다')
        return v


class PasswordResetRequest(BaseModel):
    """비밀번호 초기화 요청 (이메일 발송)"""
    email: EmailStr


# ==================== 회원 탈퇴 ====================
class SignOutRequest(BaseModel):
    """회원 탈퇴 요청"""
    password: str
    reason: Optional[str] = None  # 탈퇴 사유
    feedback: Optional[str] = None  # 피드백


# ==================== MongoDB Document Schema ====================
"""
MongoDB users 컬렉션 스키마:
{
    "_id": ObjectId,
    "email": str (unique),
    "password": str (hashed),
    "name": str,
    "nickname": str | None,
    "phone": str | None,
    "profile": "general" | "patient" | "caregiver" | "researcher",
    "role": "user" | "admin",
    "profile_image": str | None,
    "is_active": bool,
    "is_verified": bool,
    "created_at": datetime,
    "updated_at": datetime,
    "last_login": datetime | None,
    "deleted_at": datetime | None (soft delete)
}

MongoDB health_records 컬렉션 스키마:
{
    "_id": ObjectId,
    "user_id": ObjectId,
    "birth_year": int | None,
    "gender": str | None,
    "height": float | None,
    "weight": float | None,
    "ckd_stage": str | None,
    "diagnosis_date": datetime | None,
    "is_dialysis": bool,
    "dialysis_type": str | None,
    "dialysis_frequency": int | None,
    "gfr": float | None,
    "creatinine": float | None,
    "bun": float | None,
    "potassium": float | None,
    "phosphorus": float | None,
    "albumin": float | None,
    "hemoglobin": float | None,
    "has_diabetes": bool,
    "has_hypertension": bool,
    "has_heart_disease": bool,
    "other_conditions": list | None,
    "dietary_restrictions": list | None,
    "daily_fluid_limit": int | None,
    "daily_protein_limit": float | None,
    "daily_sodium_limit": int | None,
    "daily_potassium_limit": int | None,
    "daily_phosphorus_limit": int | None,
    "measured_at": datetime | None,
    "created_at": datetime,
    "updated_at": datetime
}

MongoDB token_blacklist 컬렉션 스키마:
{
    "_id": ObjectId,
    "token": str,
    "user_id": ObjectId,
    "blacklisted_at": datetime,
    "expires_at": datetime (TTL index)
}
"""
