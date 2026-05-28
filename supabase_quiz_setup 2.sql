-- ============================================================================
-- 퀴즈미션 콘텐츠 — Supabase SQL Editor에 붙여넣고 RUN 1회
-- quizzes 테이블 + 공개 읽기 RLS + 시드 6세트(초급/중급/고급 × 객관식/OX)
-- 문제(jsonb): { question, options[], correctAnswer(0-based), explanation, points }
--   * OX 문제는 options=["O","X"] 로 통일 (correctAnswer 0=O, 1=X)
-- ============================================================================

create table if not exists public.quizzes (
  id          uuid primary key default gen_random_uuid(),
  level       text not null,                 -- 초급/중급/고급
  level_order int  not null,                 -- 1,2,3
  type        text not null,                 -- MCQ(객관식) / OX
  title       text not null,
  description text,
  points      int  not null default 100,
  questions   jsonb not null,
  created_at  timestamptz not null default now()
);

alter table public.quizzes enable row level security;
drop policy if exists quizzes_select on public.quizzes;
create policy quizzes_select on public.quizzes for select using (true);  -- 누구나 읽기

-- 재실행 시 중복 방지: 시드 전에 기존 시드 삭제
delete from public.quizzes;

insert into public.quizzes (level, level_order, type, title, description, points, questions) values
-- 초급 객관식
('초급', 1, 'MCQ', '신장병 기초 상식 (객관식)', '만성콩팥병의 기본 개념을 객관식으로 익혀요.', 40,
'[
 {"question":"만성콩팥병 환자가 특히 섭취를 조절해야 하는 무기질이 아닌 것은?","options":["칼륨","인","나트륨","비타민C"],"correctAnswer":3,"explanation":"칼륨·인·나트륨은 신장 부담을 줄이기 위해 조절합니다. 비타민C는 무기질이 아닙니다.","points":10},
 {"question":"신장의 주요 기능으로 옳은 것은?","options":["혈액의 노폐물·수분 배설","인슐린 분비","담즙 생성","산소 운반"],"correctAnswer":0,"explanation":"신장은 혈액의 노폐물과 수분을 걸러 소변으로 내보냅니다.","points":10},
 {"question":"다음 중 칼륨이 특히 많은 과일은?","options":["사과","바나나","배","포도"],"correctAnswer":1,"explanation":"바나나는 칼륨 함량이 높아 섭취에 주의가 필요합니다.","points":10},
 {"question":"만성콩팥병의 가장 흔한 원인 질환은?","options":["당뇨병","감기","빈혈","천식"],"correctAnswer":0,"explanation":"당뇨병과 고혈압이 만성콩팥병의 주요 원인입니다.","points":10}
]'::jsonb),
-- 초급 OX
('초급', 1, 'OX', '신장병 기초 OX', 'O/X로 푸는 기초 신장 상식.', 40,
'[
 {"question":"신장은 보통 우리 몸에 2개 있다.","options":["O","X"],"correctAnswer":0,"explanation":"신장은 좌우 1쌍, 2개입니다.","points":10},
 {"question":"물은 많이 마실수록 신장에 무조건 좋다.","options":["O","X"],"correctAnswer":1,"explanation":"신장병 단계·상태에 따라 수분 제한이 필요할 수 있어 의료진 상담이 필요합니다.","points":10},
 {"question":"바나나는 칼륨이 높은 과일이다.","options":["O","X"],"correctAnswer":0,"explanation":"바나나는 대표적인 고칼륨 과일입니다.","points":10},
 {"question":"만성콩팥병은 초기에 증상이 뚜렷하게 나타난다.","options":["O","X"],"correctAnswer":1,"explanation":"초기엔 증상이 거의 없어 검사로 발견되는 경우가 많습니다.","points":10}
]'::jsonb),
-- 중급 객관식
('중급', 2, 'MCQ', '식이관리 중급 (객관식)', '신장병 식이관리 핵심을 객관식으로.', 40,
'[
 {"question":"신장병 환자의 단백질 섭취 원칙으로 옳은 것은?","options":["무제한으로 많이","단계에 맞춘 양질의 단백질 적정량","완전 금지","식물성만 허용"],"correctAnswer":1,"explanation":"질환 단계에 맞춰 양질의 단백질을 적정량 섭취합니다.","points":10},
 {"question":"인(P) 섭취를 줄이기 위해 제한하는 식품은?","options":["흰쌀밥","가공식품·유제품·견과류","양배추","오이"],"correctAnswer":1,"explanation":"가공식품·유제품·견과류에는 인이 많습니다.","points":10},
 {"question":"나트륨 섭취를 줄이는 방법으로 옳지 않은 것은?","options":["국물은 적게 먹기","가공식품 줄이기","소금 대신 다양한 향신료 사용","라면 국물까지 다 마시기"],"correctAnswer":3,"explanation":"국물에는 나트륨이 많아 다 마시면 섭취량이 늘어납니다.","points":10},
 {"question":"채소의 칼륨을 줄이는 조리법으로 옳은 것은?","options":["생으로 먹기","데쳐서 물을 버리기","기름에 튀기기","그대로 볶기"],"correctAnswer":1,"explanation":"데치면 칼륨이 물로 빠져 함량을 줄일 수 있습니다.","points":10}
]'::jsonb),
-- 중급 OX
('중급', 2, 'OX', '식이관리 OX', '식이관리 핵심을 O/X로.', 40,
'[
 {"question":"채소를 데쳐 물을 버리면 칼륨을 줄일 수 있다.","options":["O","X"],"correctAnswer":0,"explanation":"데치기는 칼륨을 줄이는 대표적인 방법입니다.","points":10},
 {"question":"신장병 환자는 단백질을 무조건 많이 먹어야 한다.","options":["O","X"],"correctAnswer":1,"explanation":"단계에 맞춘 적정량이 중요하며 과다 섭취는 부담이 됩니다.","points":10},
 {"question":"가공식품에는 인과 나트륨이 많이 들어있다.","options":["O","X"],"correctAnswer":0,"explanation":"가공식품에는 인·나트륨 첨가물이 많습니다.","points":10},
 {"question":"국물 요리는 나트륨이 적어 많이 먹어도 괜찮다.","options":["O","X"],"correctAnswer":1,"explanation":"국물에는 나트륨이 많아 섭취량 관리가 필요합니다.","points":10}
]'::jsonb),
-- 고급 객관식
('고급', 3, 'MCQ', '신장 건강 심화 (객관식)', '투석·수치 등 심화 지식 객관식.', 40,
'[
 {"question":"사구체여과율(eGFR)이 의미하는 것은?","options":["신장의 여과(걸러내는) 기능","혈압","혈당","체지방률"],"correctAnswer":0,"explanation":"eGFR은 신장이 노폐물을 걸러내는 기능을 나타내는 지표입니다.","points":10},
 {"question":"만성콩팥병 5단계(말기신부전)의 대표적 치료는?","options":["투석 또는 신장이식","항생제 복용","물리치료","단순 휴식"],"correctAnswer":0,"explanation":"말기신부전에서는 투석이나 신장이식이 필요합니다.","points":10},
 {"question":"혈액투석 환자의 수분 관리로 옳은 것은?","options":["수분 무제한 섭취","투석 사이 체중 증가를 적정 범위로 제한","이뇨제 임의 남용","수분 완전 금지"],"correctAnswer":1,"explanation":"투석 간 체중 증가(수분)를 적정 범위로 관리해야 합니다.","points":10},
 {"question":"신장병 환자에게 빈혈이 흔한 주된 이유는?","options":["조혈호르몬(에리스로포이에틴) 생성 감소","비타민 과다","운동 부족","수면 부족"],"correctAnswer":0,"explanation":"신장의 조혈호르몬(EPO) 생성이 줄어 빈혈이 생깁니다.","points":10}
]'::jsonb),
-- 고급 OX
('고급', 3, 'OX', '신장 건강 심화 OX', '심화 지식을 O/X로.', 40,
'[
 {"question":"eGFR 수치가 낮을수록 신장 기능이 나쁜 것이다.","options":["O","X"],"correctAnswer":0,"explanation":"eGFR이 낮을수록 신장 여과 기능이 저하된 상태입니다.","points":10},
 {"question":"복막투석은 집에서도 시행할 수 있다.","options":["O","X"],"correctAnswer":0,"explanation":"복막투석은 가정에서 직접 시행하는 방식이 있습니다.","points":10},
 {"question":"신장이식을 받으면 면역억제제를 평생 복용할 필요가 없다.","options":["O","X"],"correctAnswer":1,"explanation":"이식 후 거부반응 예방을 위해 면역억제제를 지속 복용해야 합니다.","points":10},
 {"question":"만성콩팥병 환자에게 빈혈은 드문 합병증이다.","options":["O","X"],"correctAnswer":1,"explanation":"빈혈은 만성콩팥병에서 흔한 합병증입니다.","points":10}
]'::jsonb);
