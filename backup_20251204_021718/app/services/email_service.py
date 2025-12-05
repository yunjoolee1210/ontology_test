"""
이메일 서비스 모듈
이메일 인증, 비밀번호 재설정 등 이메일 발송 기능
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# 이메일 설정
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USER)
FROM_NAME = os.getenv("FROM_NAME", "CareGuide")

# 프론트엔드 URL
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


def _create_email_template(title: str, content: str, button_text: str = None, button_url: str = None) -> str:
    """이메일 HTML 템플릿 생성"""
    button_html = ""
    if button_text and button_url:
        button_html = f"""
        <tr>
            <td align="center" style="padding: 30px 0;">
                <a href="{button_url}"
                   style="background-color: #4F46E5; color: white; padding: 14px 28px;
                          text-decoration: none; border-radius: 8px; font-weight: bold;
                          display: inline-block;">
                    {button_text}
                </a>
            </td>
        </tr>
        """

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; background-color: #f5f5f5;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="background-color: #4F46E5; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                                <h1 style="color: white; margin: 0; font-size: 24px;">CareGuide</h1>
                                <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 14px;">만성콩팥병 환자를 위한 건강관리 플랫폼</p>
                            </td>
                        </tr>
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px 30px;">
                                <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px;">{title}</h2>
                                <div style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                                    {content}
                                </div>
                            </td>
                        </tr>
                        <!-- Button -->
                        {button_html}
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f9fafb; padding: 20px 30px; border-radius: 0 0 12px 12px; text-align: center;">
                                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                    이 이메일은 CareGuide에서 자동 발송되었습니다.<br>
                                    문의사항이 있으시면 support@careguide.com으로 연락해 주세요.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


async def send_email(
    to_email: str,
    subject: str,
    html_content: str
) -> bool:
    """
    이메일 발송

    Args:
        to_email: 수신자 이메일
        subject: 제목
        html_content: HTML 본문

    Returns:
        bool: 발송 성공 여부
    """
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.warning("SMTP credentials not configured. Email not sent.")
        # 개발 환경에서는 콘솔에 출력
        logger.info(f"[DEV] Email to: {to_email}")
        logger.info(f"[DEV] Subject: {subject}")
        return True  # 개발 환경에서는 성공으로 처리

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
        msg["To"] = to_email

        html_part = MIMEText(html_content, "html", "utf-8")
        msg.attach(html_part)

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL, to_email, msg.as_string())

        logger.info(f"✅ Email sent to: {to_email}")
        return True

    except Exception as e:
        logger.error(f"❌ Failed to send email: {e}")
        return False


async def send_verification_email(to_email: str, verification_token: str) -> bool:
    """
    이메일 인증 메일 발송

    Args:
        to_email: 수신자 이메일
        verification_token: 인증 토큰

    Returns:
        bool: 발송 성공 여부
    """
    verification_url = f"{FRONTEND_URL}/verify-email?token={verification_token}"

    content = """
    <p>안녕하세요!</p>
    <p>CareGuide 회원가입을 환영합니다.</p>
    <p>아래 버튼을 클릭하여 이메일 인증을 완료해 주세요.</p>
    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
        이 링크는 24시간 동안 유효합니다.<br>
        본인이 요청하지 않은 경우 이 이메일을 무시해 주세요.
    </p>
    """

    html = _create_email_template(
        title="이메일 인증",
        content=content,
        button_text="이메일 인증하기",
        button_url=verification_url
    )

    return await send_email(to_email, "[CareGuide] 이메일 인증을 완료해 주세요", html)


async def send_password_reset_email(to_email: str, reset_token: str) -> bool:
    """
    비밀번호 재설정 메일 발송

    Args:
        to_email: 수신자 이메일
        reset_token: 재설정 토큰

    Returns:
        bool: 발송 성공 여부
    """
    reset_url = f"{FRONTEND_URL}/reset-password?token={reset_token}"

    content = """
    <p>안녕하세요!</p>
    <p>비밀번호 재설정 요청을 받았습니다.</p>
    <p>아래 버튼을 클릭하여 새 비밀번호를 설정해 주세요.</p>
    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
        이 링크는 15분 동안 유효합니다.<br>
        본인이 요청하지 않은 경우 이 이메일을 무시해 주세요.
    </p>
    """

    html = _create_email_template(
        title="비밀번호 재설정",
        content=content,
        button_text="비밀번호 재설정",
        button_url=reset_url
    )

    return await send_email(to_email, "[CareGuide] 비밀번호 재설정 안내", html)


async def send_welcome_email(to_email: str, user_name: str) -> bool:
    """
    가입 환영 메일 발송

    Args:
        to_email: 수신자 이메일
        user_name: 사용자 이름

    Returns:
        bool: 발송 성공 여부
    """
    content = f"""
    <p>안녕하세요, <strong>{user_name}</strong>님!</p>
    <p>CareGuide 가족이 되신 것을 환영합니다. 🎉</p>
    <p>CareGuide는 만성콩팥병 환자분들의 건강한 일상을 위한 다양한 기능을 제공합니다:</p>
    <ul style="color: #4b5563; line-height: 1.8;">
        <li><strong>AI 건강 상담</strong> - 신장 건강에 대한 궁금증을 해결하세요</li>
        <li><strong>영양 관리</strong> - 맞춤형 식단과 영양 정보를 확인하세요</li>
        <li><strong>건강 기록</strong> - 검사 수치를 기록하고 추이를 확인하세요</li>
        <li><strong>커뮤니티</strong> - 같은 경험을 가진 분들과 소통하세요</li>
    </ul>
    <p>지금 바로 시작해 보세요!</p>
    """

    html = _create_email_template(
        title="CareGuide에 오신 것을 환영합니다!",
        content=content,
        button_text="CareGuide 시작하기",
        button_url=FRONTEND_URL
    )

    return await send_email(to_email, "[CareGuide] 가입을 환영합니다!", html)
