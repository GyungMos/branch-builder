import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ZoomableImage.css';

/**
 * 사진 뷰어용 이미지: 누르면 전체 화면 원본 크기로 확대(끌어서/스크롤로 이동), 다시 누르면 원래대로
 */
export default function ZoomableImage({ src, alt, className = '' }) {
  const [zoom, setZoom] = useState(null); // { x, y } 누른 위치 비율
  const boxRef = useRef(null);
  const fullRef = useRef(null);

  // 사진이 바뀌면 확대 해제
  useEffect(() => { setZoom(null); }, [src]);

  const openZoom = (e) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
  };

  const closeZoom = (e) => {
    e.stopPropagation();
    setZoom(null);
  };

  // 확대한 위치가 화면 가운데 오도록 스크롤
  const centerOnTap = () => {
    const box = boxRef.current;
    const img = fullRef.current;
    if (!box || !img || !zoom || !img.offsetWidth) return;
    box.scrollLeft = img.offsetWidth * zoom.x - box.clientWidth / 2;
    box.scrollTop = img.offsetHeight * zoom.y - box.clientHeight / 2;
  };

  // 이미 불러온 사진이면 onLoad가 안 올 수 있어 한 번 더 맞춤
  useEffect(() => {
    if (zoom) requestAnimationFrame(centerOnTap);
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        setZoom(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [zoom]);

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={`${className} zoomable-img`}
        onClick={openZoom}
        title="누르면 크게 보기"
      />
      {zoom && createPortal(
        <div className="zoomable-overlay" ref={boxRef} onClick={closeZoom}>
          <img ref={fullRef} src={src} alt={alt} className="zoomable-full" onLoad={centerOnTap} />
          <button type="button" className="zoomable-close" onClick={closeZoom} aria-label="확대 닫기">
            ✕ 확대 닫기
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
