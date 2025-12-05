import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronLeft, Loader2 } from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface LabResults {
  creatinine?: { value: number; unit: string };
  egfr?: { value: number; unit: string };
  potassium?: { value: number; unit: string };
  phosphorus?: { value: number; unit: string };
  hemoglobin?: { value: number; unit: string };
  albumin?: { value: number; unit: string };
  bun?: { value: number; unit: string };
  sodium?: { value: number; unit: string };
  calcium?: { value: number; unit: string };
  [key: string]: { value: number; unit: string } | undefined;
}

interface TestResult {
  id: string;
  test_date: string;
  hospital_name?: string;
  lab_results: LabResults;
  created_at: string;
}

export function HealthRecordsPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // API에서 데이터 로드
  const fetchRecords = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/test-results/list', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/login');
          return;
        }
        throw new Error('데이터를 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      if (data.success) {
        setRecords(data.results || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleEdit = (id: string) => {
    navigate(`/mypage/test-results/edit/${id}`);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch(`/api/test-results/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          setRecords(records.filter(r => r.id !== id));
        } else {
          alert('삭제에 실패했습니다.');
        }
      } catch (err) {
        alert('삭제 중 오류가 발생했습니다.');
      }
    }
  };

  // 그래프용 데이터 변환
  const chartData = [...records].reverse().map(record => ({
    date: record.test_date,
    creatinine: record.lab_results.creatinine?.value,
    gfr: record.lab_results.egfr?.value,
    potassium: record.lab_results.potassium?.value,
    phosphorus: record.lab_results.phosphorus?.value,
    hemoglobin: record.lab_results.hemoglobin?.value,
  }));

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-white">
        <div className="lg:hidden">
          <MobileHeader title="병원 검진 기록" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00C9B7]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Mobile Header */}
      <div className="lg:hidden">
        <MobileHeader title="병원 검진 기록" />
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
        <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl font-bold text-[#1F2937]">병원 검진 기록</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-5 pb-24 lg:pb-10">
        <div className="max-w-4xl mx-auto">
          {/* Trend Chart */}
          {chartData.length > 0 && (
            <div className="mb-6">
              <h2 className="text-[18px] font-bold text-[#1F2937] mb-4">나의 신장 건강 그래프</h2>
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="date"
                      stroke="#9CA3AF"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis
                      stroke="#9CA3AF"
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'white',
                        border: '1px solid #E5E7EB',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: '20px' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="creatinine"
                      stroke="#00C8B4"
                      strokeWidth={3}
                      name="크레아티닌"
                      dot={{ fill: '#00C8B4', r: 5 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="gfr"
                      stroke="#9F7AEA"
                      strokeWidth={3}
                      name="eGFR"
                      dot={{ fill: '#9F7AEA', r: 5 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="potassium"
                      stroke="#FFB84D"
                      strokeWidth={3}
                      name="칼륨"
                      dot={{ fill: '#FFB84D', r: 5 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="phosphorus"
                      stroke="#EF4444"
                      strokeWidth={3}
                      name="인"
                      dot={{ fill: '#EF4444', r: 5 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="hemoglobin"
                      stroke="#3B82F6"
                      strokeWidth={3}
                      name="헤모글로빈"
                      dot={{ fill: '#3B82F6', r: 5 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-[18px] font-bold text-[#1F2937]">검진 기록</h2>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-xl">
              {error}
            </div>
          )}

          {records.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[#6B7280] mb-4">등록된 검진 기록이 없습니다.</p>
              <button
                onClick={() => navigate('/mypage/test-results/add')}
                className="px-6 py-3 rounded-xl text-white font-medium"
                style={{ background: 'linear-gradient(135deg, #00C8B4 0%, #9F7AEA 100%)' }}
              >
                검진결과 등록하기
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="p-5 rounded-xl border border-[#E0E0E0] bg-white"
                  style={{ boxShadow: 'none' }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-[16px] font-bold text-[#1F2937] mb-1">{record.test_date}</h3>
                      <p className="text-sm text-[#666666]">{record.hospital_name || '병원 미입력'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(record.id)}
                        className="text-xs px-2 py-1 border border-[#E0E0E0] rounded text-[#666666]"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="text-xs px-2 py-1 border border-[#E0E0E0] rounded text-[#EF4444]"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    {record.lab_results.creatinine && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-[#999999] mb-1">크레아티닌</div>
                        <div className="text-[16px] font-bold text-[#1F2937]">
                          {record.lab_results.creatinine.value} {record.lab_results.creatinine.unit}
                        </div>
                      </div>
                    )}
                    {record.lab_results.egfr && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-[#999999] mb-1">eGFR</div>
                        <div className="text-[16px] font-bold text-[#1F2937]">
                          {record.lab_results.egfr.value} {record.lab_results.egfr.unit}
                        </div>
                      </div>
                    )}
                    {record.lab_results.bun && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-[#999999] mb-1">BUN</div>
                        <div className="text-[16px] font-bold text-[#1F2937]">
                          {record.lab_results.bun.value} {record.lab_results.bun.unit}
                        </div>
                      </div>
                    )}
                    {record.lab_results.potassium && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-[#999999] mb-1">칼륨(K)</div>
                        <div className="text-[16px] font-bold text-[#1F2937]">
                          {record.lab_results.potassium.value} {record.lab_results.potassium.unit}
                        </div>
                      </div>
                    )}
                    {record.lab_results.sodium && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-[#999999] mb-1">나트륨(Na)</div>
                        <div className="text-[16px] font-bold text-[#1F2937]">
                          {record.lab_results.sodium.value} {record.lab_results.sodium.unit}
                        </div>
                      </div>
                    )}
                    {record.lab_results.phosphorus && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-[#999999] mb-1">인(P)</div>
                        <div className="text-[16px] font-bold text-[#1F2937]">
                          {record.lab_results.phosphorus.value} {record.lab_results.phosphorus.unit}
                        </div>
                      </div>
                    )}
                    {record.lab_results.calcium && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-[#999999] mb-1">칼슘(Ca)</div>
                        <div className="text-[16px] font-bold text-[#1F2937]">
                          {record.lab_results.calcium.value} {record.lab_results.calcium.unit}
                        </div>
                      </div>
                    )}
                    {record.lab_results.hemoglobin && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-[#999999] mb-1">헤모글로빈(Hb)</div>
                        <div className="text-[16px] font-bold text-[#1F2937]">
                          {record.lab_results.hemoglobin.value} {record.lab_results.hemoglobin.unit}
                        </div>
                      </div>
                    )}
                    {record.lab_results.albumin && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-[#999999] mb-1">알부민</div>
                        <div className="text-[16px] font-bold text-[#1F2937]">
                          {record.lab_results.albumin.value} {record.lab_results.albumin.unit}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* FAB Button */}
          <button
            onClick={() => navigate('/mypage/test-results/add')}
            className="fixed bottom-24 lg:bottom-8 right-8 w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-all z-50"
            style={{ background: 'linear-gradient(135deg, rgb(0, 200, 180) 0%, rgb(159, 122, 234) 100%)' }}
          >
            <Plus size={28} color="white" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
