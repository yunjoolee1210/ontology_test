import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, Plus, Trash2, Search, MapPin, Phone, Building2,
  Droplets, Scale, Activity, FileText, ChevronDown, X,
  Heart, ShieldCheck, Dumbbell, AlertCircle,
} from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';
import { listDialysisLogs, addDialysisLog, deleteDialysisLog, DialysisLog, NewDialysisLog } from '../services/dialysisApi';

type Tab = '투석 코치' | '투석 병원' | '투석 기록';

// ── 샘플 병원 데이터 ─────────────────────────────────────────────
const HOSPITALS = [
  { id: '1', name: '서울대학교병원', region: '서울', address: '서울 종로구 대학로 101', phone: '02-2072-2114', hasDialysis: true, nightDialysis: false },
  { id: '2', name: '삼성서울병원', region: '서울', address: '서울 강남구 일원로 81', phone: '02-3410-2114', hasDialysis: true, nightDialysis: true },
  { id: '3', name: '세브란스병원', region: '서울', address: '서울 서대문구 연세로 50-1', phone: '02-2228-1234', hasDialysis: true, nightDialysis: false },
  { id: '4', name: '서울아산병원', region: '서울', address: '서울 송파구 올림픽로 43길 88', phone: '02-3010-3114', hasDialysis: true, nightDialysis: true },
  { id: '5', name: '분당서울대학교병원', region: '경기', address: '경기 성남시 분당구 구미로 173번길 82', phone: '031-787-7114', hasDialysis: true, nightDialysis: false },
  { id: '6', name: '아주대학교병원', region: '경기', address: '경기 수원시 영통구 월드컵로 164', phone: '031-219-5114', hasDialysis: true, nightDialysis: true },
  { id: '7', name: '인하대학교병원', region: '인천', address: '인천 중구 인항로 27', phone: '032-890-2114', hasDialysis: true, nightDialysis: false },
  { id: '8', name: '부산대학교병원', region: '부산', address: '부산 서구 구덕로 179', phone: '051-240-7000', hasDialysis: true, nightDialysis: true },
  { id: '9', name: '양산부산대학교병원', region: '경남', address: '경남 양산시 물금읍 금오로 20', phone: '055-360-1004', hasDialysis: true, nightDialysis: false },
  { id: '10', name: '전남대학교병원', region: '광주', address: '광주 동구 제봉로 42', phone: '062-220-5114', hasDialysis: true, nightDialysis: false },
  { id: '11', name: '충남대학교병원', region: '대전', address: '대전 중구 문화로 282', phone: '042-280-7114', hasDialysis: true, nightDialysis: false },
  { id: '12', name: '경북대학교병원', region: '대구', address: '대구 중구 동덕로 130', phone: '053-200-5114', hasDialysis: true, nightDialysis: true },
  { id: '13', name: '강동경희대학교병원', region: '서울', address: '서울 강동구 동남로 892', phone: '02-440-7000', hasDialysis: true, nightDialysis: true },
  { id: '14', name: '고려대학교 안암병원', region: '서울', address: '서울 성북구 고려대로 73', phone: '02-920-5114', hasDialysis: true, nightDialysis: false },
  { id: '15', name: '원주세브란스기독병원', region: '강원', address: '강원 원주시 일산로 20', phone: '033-741-0114', hasDialysis: true, nightDialysis: false },
];

const REGIONS = ['전체', '서울', '경기', '인천', '부산', '경남', '광주', '대전', '대구', '강원'];

// ── 투석 코치 탭 ─────────────────────────────────────────────────
function CoachTab() {
  const [open, setOpen] = useState<string | null>('what');

  const toggle = (id: string) => setOpen(p => p === id ? null : id);

  const sections = [
    {
      id: 'what',
      title: '투석이란?',
      icon: <Droplets size={18} className="text-[#00C9B7]" />,
      content: (
        <div className="space-y-3 text-sm text-[#374151] leading-relaxed">
          <p>신장은 혈액 속 노폐물과 과잉 수분을 걸러 소변으로 내보내는 장기입니다. 만성신장병 말기(5기)에 이르면 신장이 이 기능을 충분히 수행하지 못해 <strong>투석</strong>이 필요합니다.</p>
          <p>투석은 신장 기능을 인공적으로 대체하여 혈액 내 요독·수분·전해질을 조절하는 치료법입니다.</p>
          <div className="p-3 rounded-xl bg-[#F0FDFA] border border-[#CCFBF1]">
            <p className="font-semibold text-[#0F766E] mb-1">주요 적용 기준</p>
            <ul className="list-disc pl-4 space-y-1 text-xs">
              <li>GFR(사구체여과율) 10 mL/min/1.73㎡ 미만</li>
              <li>심각한 요독 증상(오심, 구토, 의식 저하)</li>
              <li>조절 불가능한 고칼륨혈증·폐부종</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'compare',
      title: '혈액투석 vs 복막투석 비교',
      icon: <Activity size={18} className="text-[#9F7AEA]" />,
      content: (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#F9FAFB]">
                <th className="p-2.5 text-left border border-[#E5E7EB] text-[#374151] font-semibold">항목</th>
                <th className="p-2.5 text-center border border-[#E5E7EB] text-[#00C9B7] font-semibold">혈액투석 (HD)</th>
                <th className="p-2.5 text-center border border-[#E5E7EB] text-[#9F7AEA] font-semibold">복막투석 (PD)</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['치료 장소', '병원 (주 3회)', '가정 (매일)'],
                ['1회 시간', '4~5시간', '4~8시간 (자동화 시 취침 중)'],
                ['혈관 접근', '동정맥루 / 카테터', '복막 카테터'],
                ['식이제한', '수분·칼륨 엄격', '상대적으로 유연'],
                ['자유도', '병원 스케줄 의존', '생활 패턴 유지 가능'],
                ['감염 위험', '혈류 감염', '복막염'],
                ['적합 대상', '심혈관 안정 필요 시', '잔여 신기능 있을 때'],
              ].map(([item, hd, pd]) => (
                <tr key={item} className="even:bg-[#FAFAFA]">
                  <td className="p-2.5 border border-[#E5E7EB] font-medium text-[#374151]">{item}</td>
                  <td className="p-2.5 border border-[#E5E7EB] text-center text-[#374151]">{hd}</td>
                  <td className="p-2.5 border border-[#E5E7EB] text-center text-[#374151]">{pd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
    {
      id: 'access',
      title: '혈관 접근로 종류',
      icon: <ShieldCheck size={18} className="text-[#2563EB]" />,
      content: (
        <div className="space-y-3">
          {[
            { name: '동정맥루 (AVF)', desc: '자신의 동맥과 정맥을 연결해 만든 접근로. 가장 권장되는 방법으로 혈류량이 풍부하고 감염·혈전 위험이 낮습니다.', badge: '권장', badgeColor: 'bg-green-100 text-green-700' },
            { name: '동정맥 이식편 (AVG)', desc: '인공혈관을 동맥과 정맥 사이에 이식합니다. 자신의 혈관이 불량할 때 사용하며 혈전 위험이 다소 높습니다.', badge: '차선', badgeColor: 'bg-yellow-100 text-yellow-700' },
            { name: '중심정맥 카테터 (CVC)', desc: '목이나 가슴의 큰 정맥에 삽입하는 카테터입니다. 즉시 사용 가능하나 감염 위험이 높아 임시 수단으로 사용됩니다.', badge: '임시', badgeColor: 'bg-red-100 text-red-700' },
          ].map(({ name, desc, badge, badgeColor }) => (
            <div key={name} className="p-3 rounded-xl border border-[#EEF0F2]">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-semibold text-sm text-[#1F2937]">{name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>{badge}</span>
              </div>
              <p className="text-xs text-[#6B7280] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'daily',
      title: '일상생활 가이드',
      icon: <Dumbbell size={18} className="text-[#D97706]" />,
      content: (
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: <Droplets size={20} className="text-[#2563EB]" />, title: '수분 관리', desc: '1일 소변량 + 500mL 이내로 제한. 투석 간 체중 증가 3% 미만 유지', bg: '#EFF6FF' },
            { icon: <Heart size={20} className="text-[#DC2626]" />, title: '식이 관리', desc: '칼륨·인 함량이 낮은 식품 선택. 저염식 (나트륨 2000mg/일 이하)', bg: '#FFF5F5' },
            { icon: <Dumbbell size={20} className="text-[#16A34A]" />, title: '운동', desc: '주 3~5회 유산소 운동 30분 권장. 동정맥루 팔 과부하 주의', bg: '#F0FDF4' },
            { icon: <ShieldCheck size={20} className="text-[#D97706]" />, title: '감염 예방', desc: '투석 부위 청결 유지. 발열·발적 시 즉시 병원 방문', bg: '#FFFBEB' },
          ].map(({ icon, title, desc, bg }) => (
            <div key={title} className="p-3 rounded-xl border border-[#EEF0F2]" style={{ background: bg }}>
              <div className="mb-2">{icon}</div>
              <div className="text-sm font-bold text-[#1F2937] mb-1">{title}</div>
              <p className="text-xs text-[#6B7280] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'warning',
      title: '응급 증상 및 주의사항',
      icon: <AlertCircle size={18} className="text-[#EF4444]" />,
      content: (
        <div className="space-y-2">
          <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA]">
            <p className="text-xs font-semibold text-[#991B1B] mb-2">즉시 병원 방문이 필요한 증상</p>
            <ul className="text-xs text-[#7F1D1D] space-y-1 list-disc pl-4">
              <li>호흡곤란, 가슴 통증</li>
              <li>동정맥루 부위 출혈·감염(발열, 발적, 부종)</li>
              <li>투석 후 심한 저혈압·의식 저하</li>
              <li>48시간 이상 소변 없음</li>
            </ul>
          </div>
          <p className="text-xs text-[#6B7280] px-1">※ 이 정보는 의료 참고용이며, 개인의 상태에 따라 담당 의료진과 반드시 상담하세요.</p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {sections.map(({ id, title, icon, content }) => (
        <div key={id} className="rounded-2xl border border-[#EEF0F2] overflow-hidden">
          <button
            onClick={() => toggle(id)}
            className="w-full flex items-center justify-between px-4 py-3.5 bg-white hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              {icon}
              <span className="font-semibold text-[#1F2937] text-sm">{title}</span>
            </div>
            <ChevronDown
              size={18}
              className="text-gray-400 transition-transform duration-200"
              style={{ transform: open === id ? 'rotate(180deg)' : 'none' }}
            />
          </button>
          {open === id && (
            <div className="px-4 pb-4 pt-1 bg-white border-t border-[#EEF0F2]">
              {content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── 투석 병원 탭 ─────────────────────────────────────────────────
function HospitalTab() {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('전체');
  const [nightOnly, setNightOnly] = useState(false);

  const filtered = HOSPITALS.filter(h => {
    const matchQuery = !query || h.name.includes(query) || h.address.includes(query);
    const matchRegion = region === '전체' || h.region === region;
    const matchNight = !nightOnly || h.nightDialysis;
    return matchQuery && matchRegion && matchNight;
  });

  return (
    <div>
      {/* 검색 */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="병원명 또는 주소로 검색"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-1 focus:ring-[#00C9B7] focus:border-[#00C9B7]"
        />
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <select
          value={region}
          onChange={e => setRegion(e.target.value)}
          className="px-3 py-2 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] focus:outline-none focus:ring-1 focus:ring-[#00C9B7] bg-white"
        >
          {REGIONS.map(r => <option key={r}>{r}</option>)}
        </select>
        <button
          onClick={() => setNightOnly(p => !p)}
          className={`px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${nightOnly ? 'bg-[#00C9B7] text-white border-[#00C9B7]' : 'border-[#E5E7EB] text-[#6B7280] bg-white'}`}
        >
          야간 투석
        </button>
      </div>

      {/* 결과 수 */}
      <p className="text-xs text-[#9CA3AF] mb-3">{filtered.length}개 병원</p>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[#9CA3AF]">
          <Building2 className="mx-auto mb-3 opacity-30" size={40} />
          <p>검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(h => (
            <div key={h.id} className="p-4 rounded-2xl border border-[#EEF0F2] bg-white hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-bold text-[#1F2937] text-sm leading-snug">{h.name}</h3>
                <div className="flex gap-1 flex-shrink-0">
                  {h.hasDialysis && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E6F9F7] text-[#00A99A] font-medium">투석실</span>
                  )}
                  {h.nightDialysis && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EFE9FF] text-[#7C3AED] font-medium">야간</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#6B7280] mb-1">
                <MapPin size={12} className="flex-shrink-0" />
                <span>{h.address}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                <Phone size={12} className="flex-shrink-0" />
                <a href={`tel:${h.phone}`} className="hover:text-[#00C9B7]">{h.phone}</a>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-[#9CA3AF] text-center mt-4">※ 실제 운영 현황은 병원에 직접 확인하세요.</p>
    </div>
  );
}

// ── 투석 기록 탭 ─────────────────────────────────────────────────
const EMPTY_FORM: NewDialysisLog = {
  treatmentDate: new Date().toISOString().slice(0, 10),
  fluidRemovalL: null,
  weightBefore: null,
  weightAfter: null,
  bpBefore: '',
  bpAfter: '',
  symptoms: '',
};

function LogTab() {
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('accessToken');
  const [logs, setLogs] = useState<DialysisLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewDialysisLog>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) { setLoading(false); return; }
    listDialysisLogs().then(setLogs).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!form.treatmentDate) return;
    setSaving(true);
    try {
      const added = await addDialysisLog(form);
      setLogs(prev => [added, ...prev]);
      setShowForm(false);
      setForm(EMPTY_FORM);
    } catch (e: any) {
      alert(e.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('기록을 삭제하시겠습니까?')) return;
    await deleteDialysisLog(id);
    setLogs(prev => prev.filter(l => l.id !== id));
  };

  if (!isLoggedIn) {
    return (
      <div className="text-center py-20 text-[#9CA3AF]">
        <FileText className="mx-auto mb-4 opacity-30" size={40} />
        <p className="mb-4">투석 기록은 로그인 후 이용할 수 있습니다.</p>
        <button onClick={() => navigate('/login')} className="px-5 py-2.5 rounded-xl bg-[#00C9B7] text-white text-sm font-medium">
          로그인
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* 새 기록 버튼 */}
      <button
        onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-semibold mb-6 hover:opacity-90 transition-opacity"
        style={{ background: 'linear-gradient(135deg,#00C8B4,#9F7AEA)' }}
      >
        <Plus size={18} /> 새 투석 기록 작성
      </button>

      {/* 기록 작성 폼 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-[#1F2937]">투석 기록 작성</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-gray-100"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#374151] mb-1 block">치료 날짜 *</label>
                <input type="date" value={form.treatmentDate}
                  onChange={e => setForm(p => ({ ...p, treatmentDate: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-1 focus:ring-[#00C9B7]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#374151] mb-1 block flex items-center gap-1"><Droplets size={12} className="text-[#2563EB]" />제거 수분량 (L)</label>
                  <input type="number" step="0.1" placeholder="예: 2.5"
                    value={form.fluidRemovalL ?? ''}
                    onChange={e => setForm(p => ({ ...p, fluidRemovalL: e.target.value ? +e.target.value : null }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-1 focus:ring-[#00C9B7]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#374151] mb-1 block flex items-center gap-1"><Scale size={12} className="text-[#16A34A]" />시작 체중 (kg)</label>
                  <input type="number" step="0.1" placeholder="예: 65.2"
                    value={form.weightBefore ?? ''}
                    onChange={e => setForm(p => ({ ...p, weightBefore: e.target.value ? +e.target.value : null }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-1 focus:ring-[#00C9B7]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#374151] mb-1 block flex items-center gap-1"><Scale size={12} className="text-[#D97706]" />종료 체중 (kg)</label>
                  <input type="number" step="0.1" placeholder="예: 62.8"
                    value={form.weightAfter ?? ''}
                    onChange={e => setForm(p => ({ ...p, weightAfter: e.target.value ? +e.target.value : null }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-1 focus:ring-[#00C9B7]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#374151] mb-1 block flex items-center gap-1"><Activity size={12} className="text-[#EF4444]" />혈압 전 (mmHg)</label>
                  <input type="text" placeholder="예: 140/90"
                    value={form.bpBefore}
                    onChange={e => setForm(p => ({ ...p, bpBefore: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-1 focus:ring-[#00C9B7]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#374151] mb-1 block flex items-center gap-1"><Activity size={12} className="text-[#9F7AEA]" />혈압 후 (mmHg)</label>
                  <input type="text" placeholder="예: 125/80"
                    value={form.bpAfter}
                    onChange={e => setForm(p => ({ ...p, bpAfter: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-1 focus:ring-[#00C9B7]" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#374151] mb-1 block">증상 메모</label>
                <textarea rows={3} placeholder="투석 중 또는 후 증상을 기록하세요"
                  value={form.symptoms}
                  onChange={e => setForm(p => ({ ...p, symptoms: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#00C9B7]" />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl border border-[#E5E7EB] text-sm text-[#6B7280] hover:bg-gray-50">
                취소
              </button>
              <button onClick={handleSave} disabled={saving || !form.treatmentDate}
                className="flex-1 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#00C8B4,#9F7AEA)' }}>
                {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 기록 목록 */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#00C9B7]" size={32} /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-[#9CA3AF]">
          <FileText className="mx-auto mb-3 opacity-30" size={40} />
          <p>아직 투석 기록이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map(log => (
            <div key={log.id} className="p-4 rounded-2xl border border-[#EEF0F2] bg-white">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="font-bold text-[#1F2937]">{log.treatmentDate}</span>
                  {log.fluidRemovalL != null && (
                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] font-medium">
                      제거 {log.fluidRemovalL}L
                    </span>
                  )}
                </div>
                <button onClick={() => handleDelete(log.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-400 transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-[#6B7280]">
                {log.weightBefore != null && (
                  <span className="flex items-center gap-1"><Scale size={11} /> 시작 {log.weightBefore}kg</span>
                )}
                {log.weightAfter != null && (
                  <span className="flex items-center gap-1"><Scale size={11} /> 종료 {log.weightAfter}kg</span>
                )}
                {log.bpBefore && (
                  <span className="flex items-center gap-1"><Activity size={11} /> 혈압 전 {log.bpBefore}</span>
                )}
                {log.bpAfter && (
                  <span className="flex items-center gap-1"><Activity size={11} /> 혈압 후 {log.bpAfter}</span>
                )}
              </div>

              {log.symptoms && (
                <p className="mt-2 text-xs text-[#374151] bg-[#F9FAFB] rounded-lg px-3 py-2 leading-relaxed">
                  {log.symptoms}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────────
export function DialysisCarePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('투석 코치');

  const tabs: Tab[] = ['투석 코치', '투석 병원', '투석 기록'];

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="lg:hidden">
        <MobileHeader title="투석케어" showMenu={true} showProfile={true} />
      </div>

      <div className="flex-1 overflow-y-auto pb-24 lg:pb-10">
        <div className="max-w-2xl mx-auto px-5 lg:px-7 pt-5">

          {/* 탭 */}
          <div className="border-b border-[#E5E7EB] mb-6">
            <div className="flex gap-6">
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="relative pb-3 text-sm transition-all duration-200 whitespace-nowrap"
                  style={{
                    color: activeTab === tab ? '#00C9B7' : '#9CA3AF',
                    fontWeight: activeTab === tab ? 600 : 400,
                  }}
                >
                  {tab}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#9F7AEA] rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {activeTab === '투석 코치' && <CoachTab />}
          {activeTab === '투석 병원' && <HospitalTab />}
          {activeTab === '투석 기록' && <LogTab />}
        </div>
      </div>
    </div>
  );
}
