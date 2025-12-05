import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';

// Mock Data
const initialGoals = [
  {
    id: 1,
    name: '크레아티닌',
    unit: 'mg/dL',
    currentValue: 1.2,
    targetValue: 1.0,
    direction: 'down' as const
  },
  {
    id: 2,
    name: 'eGFR',
    unit: 'mL/min',
    currentValue: 65,
    targetValue: 70,
    direction: 'up' as const
  },
  {
    id: 3,
    name: '칼륨(K)',
    unit: 'mEq/L',
    currentValue: 4.2,
    targetValue: 4.0,
    direction: 'down' as const
  },
  {
    id: 4,
    name: '인(P)',
    unit: 'mg/dL',
    currentValue: 3.8,
    targetValue: 3.5,
    direction: 'down' as const
  }
];

export function GoalsPage() {
  const navigate = useNavigate();
  const [goals, setGoals] = useState(initialGoals);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleEdit = (id: number, currentTarget: number) => {
    setEditingId(id);
    setEditValue(currentTarget.toString());
  };

  const handleSave = (id: number) => {
    setGoals(goals.map(g =>
      g.id === id ? { ...g, targetValue: parseFloat(editValue) || g.targetValue } : g
    ));
    setEditingId(null);
    setEditValue('');
  };

  const getProgressPercent = (current: number, target: number, direction: 'up' | 'down') => {
    if (direction === 'up') {
      return Math.min((current / target) * 100, 100);
    } else {
      // For values that should go down, lower is better
      const diff = target / current;
      return Math.min(diff * 100, 100);
    }
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 90) return '#00C9B7';
    if (percent >= 70) return '#FFB84D';
    return '#EF4444';
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Mobile Header */}
      <div className="lg:hidden">
        <MobileHeader title="목표 수치 기록" />
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:flex items-center h-16 px-6 border-b border-[#E5E7EB] relative">
        <button
          onClick={() => navigate('/mypage')}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="마이페이지로 돌아가기"
        >
          <ChevronLeft size={24} className="text-[#1F2937]" />
        </button>
        <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl font-bold text-[#1F2937]">목표 수치 기록</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-5 pb-24 lg:pb-10">
        <div className="max-w-2xl mx-auto">
          {/* Info Card */}
          <div className="bg-gradient-to-r from-[#F2FFFD] to-[#F8F4FE] rounded-xl p-4 mb-6 border border-[#E5E7EB]">
            <div className="flex items-center gap-3">
              <Target size={24} className="text-[#00C9B7]" />
              <div>
                <p className="text-sm font-medium text-[#1F2937]">나만의 건강 목표를 설정하세요</p>
                <p className="text-xs text-[#6B7280]">목표 수치를 설정하고 진행 상황을 확인할 수 있습니다.</p>
              </div>
            </div>
          </div>

          {/* Goals List */}
          <div className="space-y-4">
            {goals.map((goal) => {
              const percent = getProgressPercent(goal.currentValue, goal.targetValue, goal.direction);
              const progressColor = getProgressColor(percent);

              return (
                <div
                  key={goal.id}
                  className="p-5 rounded-xl border border-[#E5E7EB] bg-white"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-[#1F2937]">{goal.name}</span>
                      {goal.direction === 'up' ? (
                        <TrendingUp size={16} className="text-[#00C9B7]" />
                      ) : (
                        <TrendingDown size={16} className="text-[#00C9B7]" />
                      )}
                    </div>
                    <span className="text-xs text-[#9CA3AF]">{goal.unit}</span>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-xs text-[#9CA3AF]">현재</span>
                      <p className="text-lg font-bold text-[#1F2937]">{goal.currentValue}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-[#9CA3AF]">목표</span>
                      {editingId === goal.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-20 px-2 py-1 text-lg font-bold text-right border border-[#00C9B7] rounded-lg outline-none"
                          />
                          <button
                            onClick={() => handleSave(goal.id)}
                            className="px-3 py-1 text-sm bg-[#00C9B7] text-white rounded-lg"
                          >
                            저장
                          </button>
                        </div>
                      ) : (
                        <p
                          className="text-lg font-bold text-[#00C9B7] cursor-pointer hover:underline"
                          onClick={() => handleEdit(goal.id, goal.targetValue)}
                        >
                          {goal.targetValue}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${percent}%`,
                        backgroundColor: progressColor
                      }}
                    />
                  </div>
                  <p className="text-xs text-[#9CA3AF] mt-2 text-right">
                    달성률 {Math.round(percent)}%
                  </p>
                </div>
              );
            })}
          </div>

          {/* Add Goal Button */}
          <button
            className="w-full mt-6 py-4 rounded-xl border-2 border-dashed border-[#E5E7EB] text-[#9CA3AF] font-medium hover:border-[#00C9B7] hover:text-[#00C9B7] transition-colors"
          >
            + 새 목표 추가
          </button>
        </div>
      </div>
    </div>
  );
}
