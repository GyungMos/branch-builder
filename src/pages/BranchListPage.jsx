import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranches } from '../hooks/useFirestore';
import BranchCard from '../components/branch/BranchCard';
import BranchForm from '../components/branch/BranchForm';
import NeonIcon from '../components/common/NeonIcon';
import './BranchListPage.css';

export default function BranchListPage() {
  const { branches, loading, addBranch, deleteBranch } = useBranches();
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const filteredBranches = branches.filter(b =>
    b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdd = async (data) => {
    try {
      await addBranch(data);
      setShowForm(false);
    } catch (err) {
      console.error('Error adding branch:', err);
    }
  };

  const handleDelete = async (branchId) => {
    if (window.confirm('정말 이 지점을 삭제하시겠습니까?')) {
      try {
        await deleteBranch(branchId);
      } catch (err) {
        console.error('Error deleting branch:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <div className="page" id="branch-list-page">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NeonIcon name="building" color="emerald" size="md" />
            <span>지점 관리</span>
          </h1>
          <p className="text-secondary text-sm" style={{ marginTop: 4 }}>
            {branches.length}개 지점 오픈 및 운영 현황
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} id="goto-dashboard-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <NeonIcon name="dashboard" color="cyan" size="sm" badge={false} />
            <span>통합 대시보드</span>
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)} id="add-branch-btn">
            <span>+</span> 새 지점
          </button>
        </div>
      </div>

      {branches.length > 3 && (
        <div className="branch-search">
          <input
            type="text"
            placeholder="🔍 지점 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="branch-search-input"
          />
        </div>
      )}

      {filteredBranches.length > 0 ? (
        <div className="branch-grid stagger-children">
          {filteredBranches.map(branch => (
            <BranchCard
              key={branch.id}
              branch={branch}
              onClick={() => navigate(`/branch/${branch.id}`)}
              onDelete={() => handleDelete(branch.id)}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state animate-fade-in-up">
          <NeonIcon name="building" color="emerald" size="xl" style={{ margin: '0 auto 16px' }} />
          <div className="empty-state-title">
            {searchQuery ? '검색 결과가 없습니다' : '아직 등록된 지점이 없습니다'}
          </div>
          <div className="empty-state-desc">
            {searchQuery
              ? '다른 키워드로 검색해보세요'
              : '새 지점을 추가하여 오픈 프로세스를 관리해보세요'
            }
          </div>
          {!searchQuery && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <span>+</span> 첫 번째 지점 추가하기
            </button>
          )}
        </div>
      )}

      {/* 모바일 FAB */}
      <button className="fab" onClick={() => setShowForm(true)} id="fab-add-branch" aria-label="새 지점 추가">
        +
      </button>

      {showForm && (
        <BranchForm
          onSubmit={handleAdd}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
