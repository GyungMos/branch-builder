import './NeonIcon.css';

/**
 * 3D Neon Icon Component
 * @param {string} name - 아이콘 이름
 * @param {string} size - 'sm' (28px), 'md' (38px), 'lg' (48px), 'xl' (60px)
 * @param {string} color - 'emerald' | 'cyan' | 'amber' | 'violet' | 'blue' | 'coral' | 'rose' | 'danger'
 * @param {boolean} badge - 3D 캡슐 배지 스타일 여부 (기본 true)
 * @param {string} className - 추가 클래스
 */
export default function NeonIcon({
  name = 'building',
  size = 'md',
  color = 'emerald',
  badge = true,
  className = '',
  style = {},
}) {
  const iconId = `neon-grad-${name}-${color}`;

  const renderPath = () => {
    switch (name) {
      case 'building': // 정비소 / 지점 / 건축
        return (
          <>
            {/* 정비소 박공 지붕 */}
            <path d="M2 10l10-7 10 7" stroke={`url(#${iconId})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 10v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V10" stroke={`url(#${iconId})`} strokeWidth="2.2" fill={`url(#${iconId}-fill)`} fillOpacity="0.3" />
            {/* 정비소 셔터 / 출입문 */}
            <path d="M8 22V13a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v9" stroke={`url(#${iconId})`} strokeWidth="2" fill={`url(#${iconId}-fill)`} fillOpacity="0.45" />
            <line x1="8" y1="16" x2="16" y2="16" stroke={`url(#${iconId})`} strokeWidth="1.8" />
            <line x1="8" y1="19" x2="16" y2="19" stroke={`url(#${iconId})`} strokeWidth="1.8" />
          </>
        );

      case 'dashboard': // 통합 대시보드
        return (
          <>
            <rect x="3" y="3" width="7.5" height="9" rx="2" stroke={`url(#${iconId})`} strokeWidth="2.2" fill={`url(#${iconId}-fill)`} fillOpacity="0.4" />
            <rect x="13.5" y="3" width="7.5" height="5" rx="2" stroke={`url(#${iconId})`} strokeWidth="2.2" fill={`url(#${iconId}-fill)`} fillOpacity="0.25" />
            <rect x="13.5" y="11" width="7.5" height="10" rx="2" stroke={`url(#${iconId})`} strokeWidth="2.2" fill={`url(#${iconId}-fill)`} fillOpacity="0.4" />
            <rect x="3" y="15" width="7.5" height="6" rx="2" stroke={`url(#${iconId})`} strokeWidth="2.2" fill={`url(#${iconId}-fill)`} fillOpacity="0.25" />
          </>
        );

      case 'calendar': // 일정 / 타임라인
        return (
          <>
            <rect x="3" y="4" width="18" height="18" rx="3" stroke={`url(#${iconId})`} strokeWidth="2.2" fill={`url(#${iconId}-fill)`} fillOpacity="0.25" />
            <path d="M16 2v4M8 2v4M3 10h18" stroke={`url(#${iconId})`} strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="8" cy="14" r="1.3" fill={`url(#${iconId})`} />
            <circle cx="12" cy="14" r="1.3" fill={`url(#${iconId})`} />
            <circle cx="16" cy="14" r="1.3" fill={`url(#${iconId})`} />
            <circle cx="8" cy="18" r="1.3" fill={`url(#${iconId})`} />
            <circle cx="12" cy="18" r="1.3" fill={`url(#${iconId})`} />
          </>
        );

      case 'money': // 비용 / 지출
      case 'budget': // 예산
        return (
          <>
            <rect x="2" y="5" width="20" height="14" rx="3" stroke={`url(#${iconId})`} strokeWidth="2.2" fill={`url(#${iconId}-fill)`} fillOpacity="0.3" />
            <circle cx="12" cy="12" r="3.2" stroke={`url(#${iconId})`} strokeWidth="2.2" fill={`url(#${iconId}-fill)`} fillOpacity="0.5" />
            <path d="M5 12h.01M19 12h.01" stroke={`url(#${iconId})`} strokeWidth="3" strokeLinecap="round" />
          </>
        );

      case 'land': // 토지 / 임대 / 부지
        return (
          <>
            <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" stroke={`url(#${iconId})`} strokeWidth="2" fill={`url(#${iconId}-fill)`} fillOpacity="0.25" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="9" y1="3" x2="9" y2="18" stroke={`url(#${iconId})`} strokeWidth="1.8" />
            <line x1="15" y1="6" x2="15" y2="21" stroke={`url(#${iconId})`} strokeWidth="1.8" />
          </>
        );

      case 'design': // 설계 / 제도 / 삼각자
      case 'ruler':
        return (
          <>
            <path d="M2 22h20L2 2v20z" stroke={`url(#${iconId})`} strokeWidth="2.2" fill={`url(#${iconId}-fill)`} fillOpacity="0.2" strokeLinejoin="round" />
            <path d="M6 18h8L6 10v8z" stroke={`url(#${iconId})`} strokeWidth="2" fill={`url(#${iconId}-fill)`} fillOpacity="0.4" strokeLinejoin="round" />
            <line x1="2" y1="18" x2="4" y2="18" stroke={`url(#${iconId})`} strokeWidth="1.8" />
            <line x1="2" y1="14" x2="5" y2="14" stroke={`url(#${iconId})`} strokeWidth="1.8" />
            <line x1="2" y1="10" x2="4" y2="10" stroke={`url(#${iconId})`} strokeWidth="1.8" />
          </>
        );

      case 'permit': // 인허가 / 승인 스탬프
        return (
          <>
            <circle cx="12" cy="9" r="6" stroke={`url(#${iconId})`} strokeWidth="2.2" fill={`url(#${iconId}-fill)`} fillOpacity="0.35" />
            <path d="m9 9 2 2 4-4" stroke={`url(#${iconId})`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8.2 14.5L6 22l6-3 6 3-2.2-7.5" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={`url(#${iconId}-fill)`} fillOpacity="0.2" />
          </>
        );

      case 'construction': // 건축 / 시공
        return (
          <>
            <path d="M2 20h20M5 20V5l7-3 7 3v15" stroke={`url(#${iconId})`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="9" y1="9" x2="9.01" y2="9" stroke={`url(#${iconId})`} strokeWidth="3" strokeLinecap="round" />
            <line x1="15" y1="9" x2="15.01" y2="9" stroke={`url(#${iconId})`} strokeWidth="3" strokeLinecap="round" />
            <line x1="9" y1="14" x2="9.01" y2="14" stroke={`url(#${iconId})`} strokeWidth="3" strokeLinecap="round" />
            <line x1="15" y1="14" x2="15.01" y2="14" stroke={`url(#${iconId})`} strokeWidth="3" strokeLinecap="round" />
            <path d="M12 2v20" stroke={`url(#${iconId})`} strokeWidth="1.6" strokeDasharray="2 2" />
          </>
        );

      case 'interior': // 인테리어 / 도장 / 마감
        return (
          <>
            <rect x="3" y="3" width="14" height="6" rx="2" stroke={`url(#${iconId})`} strokeWidth="2.2" fill={`url(#${iconId}-fill)`} fillOpacity="0.4" />
            <path d="M17 6h3a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-8v4" stroke={`url(#${iconId})`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="10" y="16" width="4" height="6" rx="1" stroke={`url(#${iconId})`} strokeWidth="2" fill={`url(#${iconId}-fill)`} fillOpacity="0.5" />
          </>
        );

      case 'etc': // 기타 / 패키지
      case 'package':
      case 'box':
        return (
          <>
            <path d="M12 2l9 5.2v9.6L12 22l-9-5.2V7.2L12 2z" stroke={`url(#${iconId})`} strokeWidth="2.2" fill={`url(#${iconId}-fill)`} fillOpacity="0.25" strokeLinejoin="round" />
            <line x1="12" y1="12" x2="21" y2="7.2" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="12" x2="12" y2="22" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="12" x2="3" y2="7.2" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
          </>
        );

      case 'equipment': // 정비 장비 / 리프트
        return (
          <>
            {/* 리프트 기둥 및 받침대 */}
            <path d="M4 21h16M7 21V6M17 21V6" stroke={`url(#${iconId})`} strokeWidth="2.3" strokeLinecap="round" />
            <rect x="5" y="10" width="14" height="3.5" rx="1.5" stroke={`url(#${iconId})`} strokeWidth="2.2" fill={`url(#${iconId}-fill)`} fillOpacity="0.5" />
            <circle cx="12" cy="5" r="2.2" stroke={`url(#${iconId})`} strokeWidth="2.2" fill={`url(#${iconId}-fill)`} fillOpacity="0.4" />
          </>
        );

      case 'wrench': // 공구 / 수리 / 정비
        return (
          <path
            d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
            stroke={`url(#${iconId})`}
            strokeWidth="2.2"
            fill={`url(#${iconId}-fill)`}
            fillOpacity="0.35"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'partner': // 협력업체 / 파트너 / 담당자
      case 'users':
        return (
          <>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke={`url(#${iconId})`} strokeWidth="2.3" strokeLinecap="round" />
            <circle cx="9" cy="7" r="4" stroke={`url(#${iconId})`} strokeWidth="2.2" fill={`url(#${iconId}-fill)`} fillOpacity="0.35" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={`url(#${iconId})`} strokeWidth="2.2" strokeLinecap="round" />
          </>
        );

      case 'compliance': // 법정 시설 / 인허가 / 안전
      case 'shield':
        return (
          <>
            <path
              d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
              stroke={`url(#${iconId})`}
              strokeWidth="2.3"
              fill={`url(#${iconId}-fill)`}
              fillOpacity="0.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="m9 12 2 2 4-4" stroke={`url(#${iconId})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </>
        );

      case 'log': // 현장 일일 일지 / 메모
      case 'edit':
        return (
          <>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={`url(#${iconId})`} strokeWidth="2.2" strokeLinecap="round" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke={`url(#${iconId})`} strokeWidth="2.2" fill={`url(#${iconId}-fill)`} fillOpacity="0.4" strokeLinecap="round" strokeLinejoin="round" />
          </>
        );

      case 'document': // 서류 / 계약서
      case 'file':
        return (
          <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={`url(#${iconId})`} strokeWidth="2.2" fill={`url(#${iconId}-fill)`} fillOpacity="0.25" />
            <polyline points="14 2 14 8 20 8" stroke={`url(#${iconId})`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="16" y1="13" x2="8" y2="13" stroke={`url(#${iconId})`} strokeWidth="2.2" strokeLinecap="round" />
            <line x1="16" y1="17" x2="8" y2="17" stroke={`url(#${iconId})`} strokeWidth="2.2" strokeLinecap="round" />
            <line x1="10" y1="9" x2="8" y2="9" stroke={`url(#${iconId})`} strokeWidth="2.2" strokeLinecap="round" />
          </>
        );

      case 'photo': // 사진 / 현장 갤러리
      case 'image':
        return (
          <>
            <rect x="3" y="3" width="18" height="18" rx="2" stroke={`url(#${iconId})`} strokeWidth="2" fill={`url(#${iconId}-fill)`} fillOpacity="0.15" />
            <circle cx="8.5" cy="8.5" r="1.5" fill={`url(#${iconId})`} />
            <polyline points="21 15 16 10 5 21" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={`url(#${iconId}-fill)`} fillOpacity="0.25" />
          </>
        );

      case 'phone': // 전화 걸기
        return (
          <path
            d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
            stroke={`url(#${iconId})`}
            strokeWidth="2"
            fill={`url(#${iconId}-fill)`}
            fillOpacity="0.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'property': // 부동산 / 부지 제원
      case 'home':
        return (
          <>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke={`url(#${iconId})`} strokeWidth="2" fill={`url(#${iconId}-fill)`} fillOpacity="0.2" />
            <polyline points="9 22 9 12 15 12 15 22" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </>
        );

      case 'check': // 완료 / 확인
        return <polyline points="20 6 9 17 4 12" stroke={`url(#${iconId})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />;

      case 'alert': // 경고 / 주의
        return (
          <>
            <polygon points="12 2 2 22 22 22" stroke={`url(#${iconId})`} strokeWidth="2" fill={`url(#${iconId}-fill)`} fillOpacity="0.25" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="9" x2="12" y2="13" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="17" r="1" fill={`url(#${iconId})`} />
          </>
        );

      case 'plus': // 추가
        return (
          <>
            <circle cx="12" cy="12" r="9" stroke={`url(#${iconId})`} strokeWidth="2" fill={`url(#${iconId}-fill)`} fillOpacity="0.2" />
            <line x1="12" y1="8" x2="12" y2="16" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
            <line x1="8" y1="12" x2="16" y2="12" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
          </>
        );

      case 'download': // 다운로드 / 백업
        return (
          <>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke={`url(#${iconId})`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="7 10 12 15 17 10" stroke={`url(#${iconId})`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="15" x2="12" y2="3" stroke={`url(#${iconId})`} strokeWidth="2.2" strokeLinecap="round" />
          </>
        );

      case 'upload': // 업로드 / 복원
        return (
          <>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke={`url(#${iconId})`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="17 8 12 3 7 8" stroke={`url(#${iconId})`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="3" x2="12" y2="15" stroke={`url(#${iconId})`} strokeWidth="2.2" strokeLinecap="round" />
          </>
        );

      case 'trash': // 삭제 / 휴지통
        return (
          <>
            <polyline points="3 6 5 6 21 6" stroke={`url(#${iconId})`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke={`url(#${iconId})`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill={`url(#${iconId}-fill)`} fillOpacity="0.2" />
            <line x1="10" y1="11" x2="10" y2="17" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
            <line x1="14" y1="11" x2="14" y2="17" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
          </>
        );

      case 'sync': // 동기화 / 새로고침
      case 'refresh':
        return (
          <>
            <polyline points="23 4 23 10 17 10" stroke={`url(#${iconId})`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="1 20 1 14 7 14" stroke={`url(#${iconId})`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke={`url(#${iconId})`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </>
        );

      case 'arrow-right': // 우측 화살표
        return (
          <>
            <line x1="5" y1="12" x2="19" y2="12" stroke={`url(#${iconId})`} strokeWidth="2.4" strokeLinecap="round" />
            <polyline points="12 5 19 12 12 19" stroke={`url(#${iconId})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </>
        );

      case 'chart': // 차트 / 통계
        return (
          <>
            <line x1="18" y1="20" x2="18" y2="10" stroke={`url(#${iconId})`} strokeWidth="2.4" strokeLinecap="round" />
            <line x1="12" y1="20" x2="12" y2="4" stroke={`url(#${iconId})`} strokeWidth="2.4" strokeLinecap="round" />
            <line x1="6" y1="20" x2="6" y2="14" stroke={`url(#${iconId})`} strokeWidth="2.4" strokeLinecap="round" />
          </>
        );

      case 'search': // 검색
      case 'magnifier':
        return (
          <>
            <circle cx="11" cy="11" r="7" stroke={`url(#${iconId})`} strokeWidth="2.2" fill={`url(#${iconId}-fill)`} fillOpacity="0.2" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" stroke={`url(#${iconId})`} strokeWidth="2.4" strokeLinecap="round" />
          </>
        );

      case 'bank': // 은행 / 계좌
        return (
          <>
            <path d="M3 21h18M3 10h18M12 3l9 4.5H3L12 3z" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={`url(#${iconId}-fill)`} fillOpacity="0.25" />
            <line x1="5" y1="10" x2="5" y2="21" stroke={`url(#${iconId})`} strokeWidth="2" />
            <line x1="10" y1="10" x2="10" y2="21" stroke={`url(#${iconId})`} strokeWidth="2" />
            <line x1="14" y1="10" x2="14" y2="21" stroke={`url(#${iconId})`} strokeWidth="2" />
            <line x1="19" y1="10" x2="19" y2="21" stroke={`url(#${iconId})`} strokeWidth="2" />
          </>
        );

      case 'pin': // 위치 / 핀 / 좌표
        return (
          <>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke={`url(#${iconId})`} strokeWidth="2.2" fill={`url(#${iconId}-fill)`} fillOpacity="0.3" />
            <circle cx="12" cy="10" r="3" stroke={`url(#${iconId})`} strokeWidth="2.2" fill={`url(#${iconId})`} />
          </>
        );

      case 'settings': // 설정 / 톱니바퀴
      case 'gear':
        return (
          <>
            <circle cx="12" cy="12" r="3" stroke={`url(#${iconId})`} strokeWidth="2.2" fill={`url(#${iconId}-fill)`} fillOpacity="0.3" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
              stroke={`url(#${iconId})`}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        );

      case 'sun': // 해 / 맑음 / 라이트모드
        return (
          <>
            <circle cx="12" cy="12" r="5" stroke={`url(#${iconId})`} strokeWidth="2" fill={`url(#${iconId}-fill)`} fillOpacity="0.3" />
            <line x1="12" y1="1" x2="12" y2="3" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="21" x2="12" y2="23" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
            <line x1="1" y1="12" x2="3" y2="12" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
            <line x1="21" y1="12" x2="23" y2="12" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
          </>
        );

      case 'moon': // 달 / 다크모드
        return (
          <path
            d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
            stroke={`url(#${iconId})`}
            strokeWidth="2.2"
            fill={`url(#${iconId}-fill)`}
            fillOpacity="0.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'cloud': // 구름 / 흐림
        return (
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" stroke={`url(#${iconId})`} strokeWidth="2" fill={`url(#${iconId}-fill)`} fillOpacity="0.3" strokeLinecap="round" strokeLinejoin="round" />
        );

      case 'rain': // 비 / 우천
        return (
          <>
            <path d="M16 13a4 4 0 0 0-7.78-1.34A5 5 0 0 0 4 16h13a3 3 0 0 0 0-6h-.5" stroke={`url(#${iconId})`} strokeWidth="2" fill={`url(#${iconId}-fill)`} fillOpacity="0.25" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="8" y1="19" x2="7" y2="22" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="19" x2="11" y2="22" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
            <line x1="16" y1="19" x2="15" y2="22" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
          </>
        );

      case 'snow': // 눈 / 강설
        return (
          <>
            <line x1="12" y1="2" x2="12" y2="22" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
            <line x1="3.34" y1="7" x2="20.66" y2="17" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
            <line x1="3.34" y1="17" x2="20.66" y2="7" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" />
          </>
        );

      case 'history': // 활동 이력 / 타임라인 / 시간
      case 'activity':
      case 'timeline':
      case 'clock':
        return (
          <>
            <circle cx="12" cy="12" r="9" stroke={`url(#${iconId})`} strokeWidth="2" fill={`url(#${iconId}-fill)`} fillOpacity="0.15" />
            <polyline points="12 6 12 12 16 14" stroke={`url(#${iconId})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </>
        );

      default:
        return <circle cx="12" cy="12" r="8" stroke={`url(#${iconId})`} strokeWidth="2" />;
    }
  };

  return (
    <span
      className={`neon-icon-wrapper neon-theme-${color} ${badge ? 'neon-icon-badge' : 'neon-icon-inline'} neon-icon-${size} ${className}`}
      style={style}
    >
      <svg className="neon-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={iconId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--neon-color-1, #34d399)" />
            <stop offset="100%" stopColor="var(--neon-color-2, #059669)" />
          </linearGradient>
          <linearGradient id={`${iconId}-fill`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--neon-color-1, #34d399)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--neon-color-2, #059669)" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        {renderPath()}
      </svg>
    </span>
  );
}
