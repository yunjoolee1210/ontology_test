"""
AES-256 암호화 서비스 테스트
"""
import sys
import os

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.encryption_service import (
    AES256Encryption,
    encryption_service,
    encrypt,
    decrypt,
    encrypt_personal_data,
    decrypt_personal_data,
    encrypt_chat_data,
    decrypt_chat_data,
    PERSONAL_DATA_FIELDS,
    CHAT_DATA_FIELDS,
)


def test_basic_encryption():
    """기본 암호화/복호화 테스트"""
    print("\n" + "=" * 60)
    print("테스트 1: 기본 암호화/복호화")
    print("=" * 60)

    test_cases = [
        "안녕하세요",
        "test@example.com",
        "010-1234-5678",
        "홍길동",
        "This is a test message with special chars: !@#$%^&*()",
        "한글과 English 混合 テスト",
        "",  # 빈 문자열
    ]

    all_passed = True
    for original in test_cases:
        encrypted = encrypt(original)
        decrypted = decrypt(encrypted)

        passed = original == decrypted
        status = "✅ PASS" if passed else "❌ FAIL"

        print(f"\n원본: '{original}'")
        print(f"암호화: '{encrypted[:50]}...' (길이: {len(encrypted)})" if encrypted else "암호화: ''")
        print(f"복호화: '{decrypted}'")
        print(f"결과: {status}")

        if not passed:
            all_passed = False

    return all_passed


def test_encryption_uniqueness():
    """동일 평문 암호화 시 다른 결과 생성 테스트"""
    print("\n" + "=" * 60)
    print("테스트 2: 암호화 고유성 (같은 평문 → 다른 암호문)")
    print("=" * 60)

    plaintext = "테스트 이메일: test@example.com"

    encrypted1 = encrypt(plaintext)
    encrypted2 = encrypt(plaintext)
    encrypted3 = encrypt(plaintext)

    # 모두 다른 암호문이어야 함 (랜덤 IV 사용)
    unique = len({encrypted1, encrypted2, encrypted3}) == 3

    print(f"\n평문: '{plaintext}'")
    print(f"암호화 1: '{encrypted1[:40]}...'")
    print(f"암호화 2: '{encrypted2[:40]}...'")
    print(f"암호화 3: '{encrypted3[:40]}...'")
    print(f"\n모두 고유함: {'✅ PASS' if unique else '❌ FAIL'}")

    # 모두 복호화 가능해야 함
    decrypted1 = decrypt(encrypted1)
    decrypted2 = decrypt(encrypted2)
    decrypted3 = decrypt(encrypted3)

    all_decrypt_ok = decrypted1 == decrypted2 == decrypted3 == plaintext
    print(f"모두 복호화 성공: {'✅ PASS' if all_decrypt_ok else '❌ FAIL'}")

    return unique and all_decrypt_ok


def test_dict_encryption():
    """딕셔너리 필드 암호화 테스트"""
    print("\n" + "=" * 60)
    print("테스트 3: 딕셔너리 필드별 암호화")
    print("=" * 60)

    # 사용자 데이터 예시
    user_data = {
        "email": "patient@example.com",
        "name": "김환자",
        "nickname": "건강이",
        "phone": "010-1234-5678",
        "birth_year": "1985",
        "password": "hashed_password_here",  # 암호화 대상 아님
        "role": "user",  # 암호화 대상 아님
        "profile": "patient",  # 암호화 대상 아님
    }

    print("\n원본 데이터:")
    for key, value in user_data.items():
        print(f"  {key}: {value}")

    # 암호화
    encrypted_data = encrypt_personal_data(user_data)

    print("\n암호화된 데이터:")
    for key, value in encrypted_data.items():
        display_value = f"{value[:30]}..." if isinstance(value, str) and len(value) > 30 else value
        print(f"  {key}: {display_value}")

    # 복호화
    decrypted_data = decrypt_personal_data(encrypted_data)

    print("\n복호화된 데이터:")
    for key, value in decrypted_data.items():
        print(f"  {key}: {value}")

    # 검증
    all_match = True
    for key in user_data:
        if str(user_data[key]) != str(decrypted_data[key]):
            print(f"❌ 불일치: {key}")
            all_match = False

    print(f"\n결과: {'✅ PASS' if all_match else '❌ FAIL'}")
    return all_match


def test_chat_data_encryption():
    """대화 이력 암호화 테스트"""
    print("\n" + "=" * 60)
    print("테스트 4: 대화 이력 암호화")
    print("=" * 60)

    chat_data = {
        "session_id": "sess_abc123",
        "user_id": "user_xyz789",
        "user_message": "오늘 저녁에 뭘 먹으면 좋을까요? 투석 환자인데요.",
        "assistant_message": "투석 환자분께서는 칼륨과 인 섭취에 주의가 필요합니다. 오늘 저녁은 흰쌀밥과 삶은 닭가슴살, 배추김치를 추천드립니다.",
        "context": {"ckd_stage": "CKD5", "dialysis": "HD"},
        "feedback_text": "도움이 많이 됐어요!",
        "thumbs_up": True,
        "created_at": "2024-01-15T18:30:00",
    }

    print("\n원본 대화 데이터:")
    for key, value in chat_data.items():
        display = str(value)[:50] + "..." if len(str(value)) > 50 else value
        print(f"  {key}: {display}")

    # 암호화
    encrypted_chat = encrypt_chat_data(chat_data)

    print("\n암호화된 대화 데이터:")
    for key, value in encrypted_chat.items():
        display = str(value)[:50] + "..." if len(str(value)) > 50 else value
        print(f"  {key}: {display}")

    # 복호화
    decrypted_chat = decrypt_chat_data(encrypted_chat)

    print("\n복호화된 대화 데이터:")
    for key, value in decrypted_chat.items():
        display = str(value)[:50] + "..." if len(str(value)) > 50 else value
        print(f"  {key}: {display}")

    # context가 dict로 복원되었는지 확인
    context_ok = isinstance(decrypted_chat.get("context"), dict)
    print(f"\ncontext 타입 복원: {'✅ PASS' if context_ok else '❌ FAIL'} (type: {type(decrypted_chat.get('context'))})")

    return context_ok


def test_key_generation():
    """마스터 키 생성 테스트"""
    print("\n" + "=" * 60)
    print("테스트 5: 마스터 키 생성")
    print("=" * 60)

    key1 = AES256Encryption.generate_master_key()
    key2 = AES256Encryption.generate_master_key()

    print(f"\n생성된 키 1: {key1}")
    print(f"생성된 키 2: {key2}")
    print(f"키 길이: {len(key1)} 문자 (256 bits)")
    print(f"키 고유성: {'✅ PASS' if key1 != key2 else '❌ FAIL'}")

    return key1 != key2


def test_search_hash():
    """검색용 해시 테스트"""
    print("\n" + "=" * 60)
    print("테스트 6: 검색용 해시 (암호화된 필드 검색용)")
    print("=" * 60)

    email = "patient@example.com"
    hash1 = AES256Encryption.hash_for_search(email)
    hash2 = AES256Encryption.hash_for_search(email)

    # 같은 입력 → 같은 해시
    consistent = hash1 == hash2

    # 다른 입력 → 다른 해시
    different_hash = AES256Encryption.hash_for_search("other@example.com")
    unique = hash1 != different_hash

    print(f"\n이메일: {email}")
    print(f"해시: {hash1}")
    print(f"일관성 (같은 입력 = 같은 해시): {'✅ PASS' if consistent else '❌ FAIL'}")
    print(f"고유성 (다른 입력 = 다른 해시): {'✅ PASS' if unique else '❌ FAIL'}")

    return consistent and unique


def test_tamper_detection():
    """데이터 변조 감지 테스트 (GCM 인증 태그)"""
    print("\n" + "=" * 60)
    print("테스트 7: 데이터 무결성/변조 감지")
    print("=" * 60)

    plaintext = "중요한 개인정보"
    encrypted = encrypt(plaintext)

    # 암호문 일부 변조
    import base64
    encrypted_bytes = base64.b64decode(encrypted)
    # 중간 바이트 변조
    tampered_bytes = encrypted_bytes[:20] + bytes([encrypted_bytes[20] ^ 0xFF]) + encrypted_bytes[21:]
    tampered = base64.b64encode(tampered_bytes).decode('utf-8')

    # 변조된 데이터 복호화 시도
    tamper_detected = False
    try:
        decrypt(tampered)
        print("❌ 변조 감지 실패 - 복호화가 성공함")
    except ValueError as e:
        tamper_detected = True
        print(f"✅ 변조 감지 성공: {e}")

    return tamper_detected


def run_all_tests():
    """모든 테스트 실행"""
    print("\n" + "=" * 60)
    print("  AES-256 암호화 서비스 테스트")
    print("=" * 60)

    results = {
        "기본 암호화/복호화": test_basic_encryption(),
        "암호화 고유성": test_encryption_uniqueness(),
        "딕셔너리 암호화": test_dict_encryption(),
        "대화 이력 암호화": test_chat_data_encryption(),
        "마스터 키 생성": test_key_generation(),
        "검색용 해시": test_search_hash(),
        "변조 감지": test_tamper_detection(),
    }

    print("\n" + "=" * 60)
    print("  테스트 결과 요약")
    print("=" * 60)

    passed = 0
    failed = 0
    for name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {name}: {status}")
        if result:
            passed += 1
        else:
            failed += 1

    print(f"\n총 {len(results)}개 테스트 중 {passed}개 성공, {failed}개 실패")
    print("=" * 60)

    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
