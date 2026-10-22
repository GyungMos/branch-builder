import './PhotoPickButtons.css';

/**
 * 사진 넣기 버튼 두 개: 휴대폰 카메라로 바로 찍기 · 앨범(파일)에서 여러 장 고르기
 * onChange는 일반 <input type="file">의 change 이벤트와 같음
 */
export default function PhotoPickButtons({ onChange, disabled = false }) {
  return (
    <div className="photo-pick">
      <label className={`btn btn-secondary btn-sm photo-pick-btn ${disabled ? 'disabled' : ''}`}>
        📷 사진 찍기
        <input type="file" accept="image/*" capture="environment" onChange={onChange} disabled={disabled} hidden />
      </label>
      <label className={`btn btn-secondary btn-sm photo-pick-btn ${disabled ? 'disabled' : ''}`}>
        🖼 앨범에서 고르기
        <input type="file" accept="image/*" multiple onChange={onChange} disabled={disabled} hidden />
      </label>
    </div>
  );
}
