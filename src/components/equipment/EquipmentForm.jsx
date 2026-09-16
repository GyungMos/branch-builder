import { useState } from 'react';
import NeonIcon from '../common/NeonIcon';

export default function EquipmentForm({ equipment, onSubmit, onClose }) {
  const [name, setName] = useState(equipment?.name || '');
  const [modelNumber, setModelNumber] = useState(equipment?.modelNumber || '');
  const [manufacturer, setManufacturer] = useState(equipment?.manufacturer || '');
  const [vendor, setVendor] = useState(equipment?.vendor || '');
  const [quantity, setQuantity] = useState(equipment?.quantity || 1);
  const [unitPrice, setUnitPrice] = useState(equipment?.unitPrice || '');
  const [orderDate, setOrderDate] = useState(equipment?.orderDate || '');
  const [deliveryDate, setDeliveryDate] = useState(equipment?.deliveryDate || '');
  const [warrantyPeriod, setWarrantyPeriod] = useState(equipment?.warrantyPeriod || '1년');
  const [memo, setMemo] = useState(equipment?.memo || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const q = Number(quantity) || 1;
      const u = Number(unitPrice) || 0;
      await onSubmit({
        name: name.trim(),
        modelNumber: modelNumber.trim(),
        manufacturer: manufacturer.trim(),
        vendor: vendor.trim(),
        quantity: q,
        unitPrice: u,
        totalPrice: q * u,
        orderDate,
        deliveryDate,
        warrantyPeriod: warrantyPeriod.trim(),
        memo: memo.trim(),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal" id="equipment-form-modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NeonIcon name="equipment" color="violet" size="sm" />
            <h2 className="modal-title">{equipment ? '정비 장비 수정' : '정비 장비/리프트 등록'}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
            <div className="form-group">
              <label htmlFor="eq-name">장비명 *</label>
              <input
                id="eq-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 4주식 리프트 5.5톤, 3D 휠얼라인먼트"
                required
                autoFocus
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label htmlFor="eq-model">모델명 / 규격</label>
                <input
                  id="eq-model"
                  type="text"
                  value={modelNumber}
                  onChange={(e) => setModelNumber(e.target.value)}
                  placeholder="예: HL-32H, 15HP 스크류"
                />
              </div>

              <div className="form-group">
                <label htmlFor="eq-manuf">제조사 / 브랜드</label>
                <input
                  id="eq-manuf"
                  type="text"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  placeholder="예: 호프만, 헤스본, 한국리프트"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label htmlFor="eq-qty">수량</label>
                <input
                  id="eq-qty"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="eq-price">단가 (원)</label>
                <input
                  id="eq-price"
                  type="number"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="예: 12000000"
                  min="0"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label htmlFor="eq-vendor">납품 / 발주처</label>
                <input
                  id="eq-vendor"
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="예: 대한기계, 삼양설비"
                />
              </div>

              <div className="form-group">
                <label htmlFor="eq-warranty">A/S 보증기간</label>
                <input
                  id="eq-warranty"
                  type="text"
                  value={warrantyPeriod}
                  onChange={(e) => setWarrantyPeriod(e.target.value)}
                  placeholder="예: 2년 무상"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label htmlFor="eq-order-date">발주일</label>
                <input
                  id="eq-order-date"
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="eq-deliv-date">입고 / 설치 예정일</label>
                <input
                  id="eq-deliv-date"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="eq-memo">설치 메모 (바닥 타설/전기 결선 등)</label>
              <textarea
                id="eq-memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="예: 바닥 콘크리트 두께 250mm 확보 후 케미컬 앙카 시공 필요"
                rows={2}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !name.trim()}>
              {loading ? '저장 중...' : (equipment ? '수정' : '장비 등록')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
