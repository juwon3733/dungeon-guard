// 작은 그림 아이콘(SVG). 글자 대신 쓴다.
import type { ReactNode } from 'react';

const S = ({ children, size = 18, title }: { children: ReactNode; size?: number; title?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} style={{ verticalAlign: '-3px', flex: 'none' }}>
    {title && <title>{title}</title>}
    {children}
  </svg>
);

export const IconGold = (p: { size?: number }) => (
  <S size={p.size} title="금화"><ellipse cx="12" cy="15" rx="8" ry="4" fill="#9a6b1e" /><ellipse cx="12" cy="12" rx="8" ry="4" fill="#e3b04b" /><ellipse cx="12" cy="11.5" rx="5" ry="2.2" fill="#f5d27a" /></S>
);
export const IconMana = (p: { size?: number }) => (
  <S size={p.size} title="마석"><path d="M12 2 L19 9 L12 22 L5 9 Z" fill="#7d4ad8" /><path d="M12 2 L15 9 L12 22 L9 9 Z" fill="#b38cff" /><path d="M5 9 H19" stroke="#e6d8ff" strokeWidth="1" /></S>
);
export const IconFame = (p: { size?: number }) => (
  <S size={p.size} title="명성"><path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" fill="#d4a24c" /></S>
);
export const IconArmy = (p: { size?: number }) => (
  <S size={p.size} title="군단"><path d="M4 21V5l8-3 8 3v16" fill="none" stroke="#b8a888" strokeWidth="2" /><path d="M8 21v-6h8v6" fill="#6b5a44" /></S>
);
export const IconThreat = (p: { size?: number }) => (
  <S size={p.size} title="위협도"><path d="M12 3c4 0 7 3 7 7 0 3-2 4-2 6H7c0-2-2-3-2-6 0-4 3-7 7-7z" fill="#d9d2c4" /><circle cx="9" cy="10" r="1.8" fill="#1a1216" /><circle cx="15" cy="10" r="1.8" fill="#1a1216" /><rect x="8" y="17" width="8" height="4" rx="1" fill="#d9d2c4" /></S>
);
export const IconSword = (p: { size?: number }) => (
  <S size={p.size}><path d="M19 3l-8 8M14 3h5v5" stroke="#d4a24c" strokeWidth="2" fill="none" /><path d="M6 15l3 3M4 20l3-3" stroke="#b8a888" strokeWidth="2" /></S>
);
// 방(본부 메뉴)
export const RoomIcon = ({ k, size = 22 }: { k: string; size?: number }) => {
  switch (k) {
    case 'map': return <S size={size}><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" fill="#c9b07a" /><path d="M9 4v14M15 6v14" stroke="#7a6440" strokeWidth="1.2" /><circle cx="15" cy="11" r="1.6" fill="#a33245" /></S>;
    case 'army': return <S size={size}><path d="M6 20V9l6-5 6 5v11z" fill="#6b5a44" /><path d="M10 20v-5h4v5" fill="#2a2018" /><path d="M12 4v-2" stroke="#a33245" strokeWidth="2" /></S>;
    case 'dungeon': return <S size={size}><path d="M3 21h18M5 21V10h14v11" stroke="#9a8e7c" strokeWidth="2" fill="#3a3038" /><path d="M9 21v-6a3 3 0 016 0v6" fill="#1a1216" /></S>;
    case 'summon': return <S size={size}><circle cx="12" cy="12" r="8" fill="none" stroke="#8a5ad8" strokeWidth="1.6" /><path d="M12 4l2.4 12-6.3-7.5h7.8L9.6 16z" fill="none" stroke="#b38cff" strokeWidth="1.2" /></S>;
    case 'prison': return <S size={size}><rect x="5" y="4" width="14" height="16" fill="#3a3038" /><path d="M8 4v16M12 4v16M16 4v16" stroke="#9a8e7c" strokeWidth="1.6" /></S>;
    case 'dorm': return <S size={size}><path d="M4 18v-6h16v6M4 14h16" stroke="#c9a0a0" strokeWidth="1.6" fill="none" /><rect x="5" y="10" width="5" height="3" rx="1" fill="#e6c4c4" /><path d="M3 20h18" stroke="#9a8e7c" strokeWidth="1.6" /></S>;
    default: return null;
  }
};
