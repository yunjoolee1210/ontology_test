"""
활동 이력 관리 테스트
"""
import sys
import os
import asyncio

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from app.db.activity_manager import activity_manager


async def test_guest_session():
    """게스트 세션 테스트"""
    print("\n" + "=" * 60)
    print("테스트 1: 게스트 세션 생성 및 조회")
    print("=" * 60)

    await activity_manager.connect()

    # 게스트 세션 생성
    session_id = await activity_manager.create_guest_session(
        ip_address="192.168.1.100",
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        ttl_hours=24
    )
    print(f"생성된 세션 ID: {session_id}")

    # 세션 조회
    session = await activity_manager.get_guest_session(session_id)
    print(f"세션 조회 결과:")
    print(f"  - IP 주소 (복호화됨): {session.get('ip_address')}")
    print(f"  - User Agent: {session.get('user_agent')}")
    print(f"  - 만료 시간: {session.get('expires_at')}")

    # IP가 올바르게 복호화되었는지 확인
    passed = session.get('ip_address') == "192.168.1.100"
    print(f"\n결과: {'✅ PASS' if passed else '❌ FAIL'}")
    return passed, session_id


async def test_chat_history(session_id: str):
    """대화 이력 테스트"""
    print("\n" + "=" * 60)
    print("테스트 2: 대화 이력 저장 및 조회 (암호화)")
    print("=" * 60)

    # 대화 이력 저장
    chat_id = await activity_manager.create_chat_history(
        session_id=session_id,
        user_message="투석 환자인데요, 오늘 저녁에 뭘 먹으면 좋을까요?",
        assistant_message="투석 환자분께서는 칼륨과 인 섭취에 주의가 필요합니다. 오늘 저녁은 흰쌀밥과 삶은 닭가슴살을 추천드립니다.",
        agent_type="nutrition",
        context={"ckd_stage": "CKD5", "dialysis_type": "HD"},
        tokens_used=150,
        response_time_ms=1200
    )
    print(f"저장된 대화 ID: {chat_id}")

    # 피드백 업데이트
    await activity_manager.update_chat_feedback(
        chat_id=chat_id,
        thumbs_up=True,
        satisfaction_score=5,
        feedback_text="정말 도움이 많이 됐어요!"
    )
    print("피드백 업데이트 완료")

    # 대화 이력 조회 (복호화)
    history = await activity_manager.get_chat_history(session_id=session_id, limit=10)
    print(f"\n조회된 대화 이력: {len(history)}건")

    if history:
        chat = history[0]
        print(f"  - 사용자 메시지: {chat.get('user_message', '')[:50]}...")
        print(f"  - AI 응답: {chat.get('assistant_message', '')[:50]}...")
        print(f"  - context: {chat.get('context')}")
        print(f"  - thumbs_up: {chat.get('thumbs_up')}")
        print(f"  - satisfaction_score: {chat.get('satisfaction_score')}")
        print(f"  - 피드백: {chat.get('feedback_text')}")

    # 관리자용 통계
    stats = await activity_manager.get_chat_stats_for_admin()
    print(f"\n대화 통계:")
    print(f"  - 총 대화 수: {stats.get('total_conversations')}")
    print(f"  - Thumbs Up: {stats.get('thumbs_up_count')}")
    print(f"  - Thumbs Down: {stats.get('thumbs_down_count')}")
    print(f"  - 평균 만족도: {stats.get('avg_satisfaction_score')}")

    passed = len(history) > 0 and history[0].get('thumbs_up') == True
    print(f"\n결과: {'✅ PASS' if passed else '❌ FAIL'}")
    return passed


async def test_meal_records(session_id: str):
    """식단 기록 테스트"""
    print("\n" + "=" * 60)
    print("테스트 3: 식단 기록 저장 및 조회 (암호화)")
    print("=" * 60)

    # 식단 기록 저장
    meal_id = await activity_manager.create_meal_record(
        session_id=session_id,
        meal_type="dinner",
        food_name="현미밥, 삶은 닭가슴살, 시금치나물",
        meal_description="저녁 식단 - 단백질 위주로 구성",
        nutrition_analysis={
            "calories": 450,
            "protein": 35,
            "sodium": 800,
            "potassium": 600,
            "phosphorus": 300
        },
        user_notes="오늘은 염분을 좀 줄여봤어요"
    )
    print(f"저장된 식단 기록 ID: {meal_id}")

    # 식단 기록 조회
    records = await activity_manager.get_meal_records(session_id=session_id, limit=10)
    print(f"\n조회된 식단 기록: {len(records)}건")

    if records:
        meal = records[0]
        print(f"  - 음식명: {meal.get('food_name')}")
        print(f"  - 설명: {meal.get('meal_description')}")
        print(f"  - 영양 분석: {meal.get('nutrition_analysis')}")
        print(f"  - 메모: {meal.get('user_notes')}")

    passed = len(records) > 0 and records[0].get('food_name') == "현미밥, 삶은 닭가슴살, 시금치나물"
    print(f"\n결과: {'✅ PASS' if passed else '❌ FAIL'}")
    return passed


async def test_quiz_history(session_id: str):
    """퀴즈 이력 테스트"""
    print("\n" + "=" * 60)
    print("테스트 4: 퀴즈 이력 저장 및 조회 (암호화)")
    print("=" * 60)

    # 퀴즈 이력 저장
    quiz_id_1 = await activity_manager.create_quiz_history(
        session_id=session_id,
        quiz_id="quiz_001",
        quiz_title="신장병 환자의 칼륨 섭취",
        user_answer="바나나는 칼륨이 높아 투석 환자는 주의해야 한다",
        correct_answer="바나나는 칼륨이 높아 투석 환자는 주의해야 한다",
        is_correct=True,
        time_spent_seconds=45,
        points_earned=10,
        feedback_text="정답입니다! 바나나 100g당 칼륨이 약 360mg 포함되어 있습니다."
    )

    quiz_id_2 = await activity_manager.create_quiz_history(
        session_id=session_id,
        quiz_id="quiz_002",
        quiz_title="투석 환자의 수분 섭취",
        user_answer="무제한",
        correct_answer="제한 필요",
        is_correct=False,
        time_spent_seconds=30,
        points_earned=0,
        feedback_text="투석 환자는 수분 섭취를 제한해야 합니다."
    )

    print(f"저장된 퀴즈 기록 ID 1: {quiz_id_1}")
    print(f"저장된 퀴즈 기록 ID 2: {quiz_id_2}")

    # 퀴즈 이력 조회
    history = await activity_manager.get_quiz_history(session_id=session_id, limit=10)
    print(f"\n조회된 퀴즈 이력: {len(history)}건")

    # 퀴즈 통계
    stats = await activity_manager.get_quiz_stats(session_id=session_id)
    print(f"\n퀴즈 통계:")
    print(f"  - 총 퀴즈 수: {stats.get('total_quizzes')}")
    print(f"  - 정답 수: {stats.get('correct_count')}")
    print(f"  - 오답 수: {stats.get('incorrect_count')}")
    print(f"  - 정답률: {stats.get('accuracy_rate')}%")
    print(f"  - 총 획득 포인트: {stats.get('total_points_earned')}")

    passed = stats.get('total_quizzes') == 2 and stats.get('correct_count') == 1
    print(f"\n결과: {'✅ PASS' if passed else '❌ FAIL'}")
    return passed


async def test_community_activity(session_id: str):
    """커뮤니티 활동 로그 테스트"""
    print("\n" + "=" * 60)
    print("테스트 5: 커뮤니티 활동 로그 저장 및 조회 (암호화)")
    print("=" * 60)

    # 활동 로그 저장
    log_id = await activity_manager.create_community_activity_log(
        session_id=session_id,
        action_type="create_post",
        target_type="post",
        target_id="post_12345",
        action_detail="저염 식단 도전 후기 작성",
        content_preview="오늘부터 저염 식단을 시작했습니다...",
        metadata={"post_type": "BOARD", "category": "diet"}
    )
    print(f"저장된 활동 로그 ID: {log_id}")

    # 댓글 활동
    await activity_manager.create_community_activity_log(
        session_id=session_id,
        action_type="create_comment",
        target_type="comment",
        target_id="comment_67890",
        action_detail="저도 시작했어요!",
        metadata={"parent_post_id": "post_12345"}
    )

    # 좋아요 활동
    await activity_manager.create_community_activity_log(
        session_id=session_id,
        action_type="like_post",
        target_type="post",
        target_id="post_12345"
    )

    # 활동 로그 조회
    logs = await activity_manager.get_community_activity_logs(
        session_id=session_id, limit=10
    )
    print(f"\n조회된 활동 로그: {len(logs)}건")

    for log in logs:
        detail = log.get('action_detail') or 'N/A'
        print(f"  - {log.get('action_type')}: {detail[:30] if detail else 'N/A'}")

    # 관리자용 통계
    stats = await activity_manager.get_community_stats_for_admin()
    print(f"\n커뮤니티 활동 통계:")
    print(f"  - 총 활동 수: {stats.get('total_activities')}")
    print(f"  - 활동 타입별: {stats.get('by_action_type')}")

    passed = len(logs) >= 3
    print(f"\n결과: {'✅ PASS' if passed else '❌ FAIL'}")
    return passed


async def test_guest_to_user_conversion(session_id: str):
    """게스트 → 회원 전환 테스트"""
    print("\n" + "=" * 60)
    print("테스트 6: 게스트 세션 → 회원 전환")
    print("=" * 60)

    user_id = "user_converted_123"

    # 전환 전 데이터 확인
    chat_before = await activity_manager.get_chat_history(session_id=session_id)
    print(f"전환 전 대화 이력 - user_id: {chat_before[0].get('user_id') if chat_before else 'N/A'}")

    # 게스트 → 회원 전환
    success = await activity_manager.convert_guest_to_user(session_id, user_id)
    print(f"전환 결과: {'성공' if success else '실패'}")

    # 전환 후 데이터 확인
    chat_after = await activity_manager.get_chat_history(session_id=session_id)
    print(f"전환 후 대화 이력 - user_id: {chat_after[0].get('user_id') if chat_after else 'N/A'}")

    # 회원 세션 조회
    session = await activity_manager.get_guest_session(session_id)
    print(f"세션 상태:")
    print(f"  - is_converted: {session.get('is_converted')}")
    print(f"  - converted_user_id: {session.get('converted_user_id')}")

    passed = (
        success and
        session.get('is_converted') == True and
        chat_after[0].get('user_id') == user_id
    )
    print(f"\n결과: {'✅ PASS' if passed else '❌ FAIL'}")
    return passed


async def run_all_tests():
    """모든 테스트 실행"""
    print("\n" + "=" * 60)
    print("  활동 이력 관리 (Activity Manager) 테스트")
    print("=" * 60)

    results = {}

    try:
        # 테스트 1: 게스트 세션
        passed, session_id = await test_guest_session()
        results["게스트 세션 생성"] = passed

        # 테스트 2: 대화 이력
        results["대화 이력 (암호화)"] = await test_chat_history(session_id)

        # 테스트 3: 식단 기록
        results["식단 기록 (암호화)"] = await test_meal_records(session_id)

        # 테스트 4: 퀴즈 이력
        results["퀴즈 이력 (암호화)"] = await test_quiz_history(session_id)

        # 테스트 5: 커뮤니티 활동
        results["커뮤니티 활동 (암호화)"] = await test_community_activity(session_id)

        # 테스트 6: 게스트 → 회원 전환
        results["게스트→회원 전환"] = await test_guest_to_user_conversion(session_id)

    finally:
        await activity_manager.close()

    # 결과 요약
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
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
