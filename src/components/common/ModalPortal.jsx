import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * ModalPortal - React Portal을 사용하여 document.body 바로 아래에 모달을 렌더링합니다.
 * 이를 통해 부모 컴포넌트의 CSS transform, animation, backdrop-filter 등에 의한
 * Stacking Context(쌓임 맥락) 트랩을 완전히 탈출하고,
 * z-index가 모바일 하단 네비게이션보다 상위에 안정적으로 위치하도록 보장합니다.
 */
export default function ModalPortal({ children, onClose }) {
  useEffect(() => {
    // 모달 활성화 시 body에 클래스 추가 (스크롤 잠금 및 모바일 네비게이션 숨김)
    document.body.classList.add('modal-open');

    // ESC 키로 모달 닫기
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(children, document.body);
}
