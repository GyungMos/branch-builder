import { useState } from 'react';
import NeonIcon from '../common/NeonIcon';
import ModalPortal from '../common/ModalPortal';

export default function BranchForm({ branch, onSubmit, onClose }) {
  const [name, setName] = useState(branch?.name || '');
  const [address, setAddress] = useState(branch?.address || '');
  const [description, setDescription] = useState(branch?.description || '');

  // 부동산 & 임대차 제원
  const prop = branch?.property || {};
  const [landArea, setLandArea] = useState(prop.landArea || '');
  const [floorHeight, setFloorHeight] = useState(prop.floorHeight || '');
  const [zoning, setZoning] = useState(prop.zoning || '');
  const [parkingSpaces, setParkingSpaces] = useState(prop.parkingSpaces || '');
  const [deposit, setDeposit] = useState(prop.deposit || '');
  const [monthlyRent, setMonthlyRent] = useState(prop.monthlyRent || '');
  const [maintenanceFee, setMaintenanceFee] = useState(prop.maintenanceFee || '');
  const [rentFreeStart, setRentFreeStart] = useState(prop.rentFreeStart || '');
  const [rentFreeEnd, setRentFreeEnd] = useState(prop.rentFreeEnd || '');
  const [leaseEnd, setLeaseEnd] = useState(prop.leaseEnd || '');
  const [termsMemo, setTermsMemo] = useState(prop.termsMemo || '');

  const [showPropertyFields, setShowPropertyFields] = useState(Boolean(branch?.property));
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        address: address.trim(),
        description: description.trim(),
        property: {
          landArea: landArea ? Number(landArea) : null,
          floorHeight: floorHeight ? Number(floorHeight) : null,
          zoning: zoning.trim(),
          parkingSpaces: parkingSpaces ? Number(parkingSpaces) : null,
          deposit: deposit ? Number(deposit) : null,
          monthlyRent: monthlyRent ? Number(monthlyRent) : null,
          maintenanceFee: maintenanceFee ? Number(maintenanceFee) : null,
          rentFreeStart,
          rentFreeEnd,
          leaseEnd,
          termsMemo: termsMemo.trim(),
        },
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal" id="branch-form-modal" style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NeonIcon name="building" color="emerald" size="sm" />
            <h2 className="modal-title">{branch ? '지점 정보 수정' : '새 정비소 지점 추가'}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="branch-name">지점명 *</label>
              <input
                id="branch-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 서초점, 강남1호점, 판교검사소"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="branch-address">주소</label>
              <input
                id="branch-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="지번 또는 도로명 주소를 입력하세요"
              />
            </div>
            <div className="form-group">
              <label htmlFor="branch-desc">지점 메모</label>
              <textarea
                id="branch-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="부지 특성, 인근 상권, 오픈 목표일 등 메모"
                rows={2}
              />
            </div>

            {/* 부동산 및 임대차 제원 토글 */}
            <div style={{ marginTop: 12, borderTop: '1px solid var(--color-surface-border)', paddingTop: 12 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowPropertyFields(!showPropertyFields)}
                style={{ width: '100%', justifyContent: 'space-between', display: 'flex' }}
              >
                <span>📐 부지 제원 & 임대차/렌트프리 조건 (선택)</span>
                <span>{showPropertyFields ? '▲ 접기' : '▼ 펼치기'}</span>
              </button>

              {showPropertyFields && (
                <div style={{ background: 'var(--color-bg-secondary)', padding: 12, borderRadius: 8, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group">
                      <label style={{ fontSize: 11 }}>대지 면적 (㎡)</label>
                      <input
                        type="number"
                        placeholder="예: 450"
                        value={landArea}
                        onChange={(e) => setLandArea(e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: 11 }}>건물 층고 (m, 리프트 높이)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="예: 5.2"
                        value={floorHeight}
                        onChange={(e) => setFloorHeight(e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group">
                      <label style={{ fontSize: 11 }}>용도지역</label>
                      <input
                        type="text"
                        placeholder="예: 제2종근린생활시설"
                        value={zoning}
                        onChange={(e) => setZoning(e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: 11 }}>주차 가능 대수</label>
                      <input
                        type="number"
                        placeholder="예: 8"
                        value={parkingSpaces}
                        onChange={(e) => setParkingSpaces(e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group">
                      <label style={{ fontSize: 11 }}>보증금 (원)</label>
                      <input
                        type="number"
                        placeholder="예: 100000000"
                        value={deposit}
                        onChange={(e) => setDeposit(e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: 11 }}>월 임대료 (원)</label>
                      <input
                        type="number"
                        placeholder="예: 7000000"
                        value={monthlyRent}
                        onChange={(e) => setMonthlyRent(e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group">
                      <label style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>렌트프리 시작일</label>
                      <input
                        type="date"
                        value={rentFreeStart}
                        onChange={(e) => setRentFreeStart(e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>렌트프리 종료일 (D-Day)</label>
                      <input
                        type="date"
                        value={rentFreeEnd}
                        onChange={(e) => setRentFreeEnd(e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: 11 }}>임대차 특약사항 (원상복구/간판 등)</label>
                    <input
                      type="text"
                      placeholder="예: 간판 설치 지자체 신고 완료, 바닥 에폭시 원상복구 제외"
                      value={termsMemo}
                      onChange={(e) => setTermsMemo(e.target.value)}
                      style={{ fontSize: 12 }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !name.trim()}>
              {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : (branch ? '수정 저장' : '지점 등록')}
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}

