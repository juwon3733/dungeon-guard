// 도트풍 UI 틀과 글자. 틀은 코드로 그린다(마왕군 색).
const FRAME_THEMES = {
    panel: { top: '#251b3a', bottom: '#120d20', border: '#07040e', light: '#5d4a86', shade: '#0b0714' },
    dark: { top: '#191328', bottom: '#0d0918', border: '#05030a', light: '#3f3358', shade: '#07050e' },
    button: { top: '#6d3fc2', bottom: '#44258a', border: '#120828', light: '#b89bf0', shade: '#2c1763' },
    buttonHover: { top: '#8c5bea', bottom: '#5a33b4', border: '#120828', light: '#e0ceff', shade: '#3b2085' },
    gold: { top: '#d99a36', bottom: '#94601a', border: '#241304', light: '#ffe2a0', shade: '#5f3a0c' },
    goldHover: { top: '#f2b64f', bottom: '#b57a24', border: '#241304', light: '#fff1c8', shade: '#744a10' },
    off: { top: '#2e2a3b', bottom: '#201d2a', border: '#08060e', light: '#413c50', shade: '#15131c' },
    danger: { top: '#8a2f3c', bottom: '#5c1f29', border: '#1e0a0e', light: '#d46a7a', shade: '#3d141b' },
    dangerHover: { top: '#b23a4b', bottom: '#7f2533', border: '#1e0a0e', light: '#ff9aa8', shade: '#55171f' },
    speech: { top: '#fff7e4', bottom: '#e6d8bd', border: '#1c1428', light: '#ffffff', shade: '#c4b394' }
};

const UIKit = {
    framePath(ctx, x, y, w, h, c) {
        ctx.beginPath();
        ctx.moveTo(x + c, y);
        ctx.lineTo(x + w - c, y);
        ctx.lineTo(x + w - c, y + c / 2);
        ctx.lineTo(x + w - c / 2, y + c / 2);
        ctx.lineTo(x + w - c / 2, y + c);
        ctx.lineTo(x + w, y + c);
        ctx.lineTo(x + w, y + h - c);
        ctx.lineTo(x + w - c / 2, y + h - c);
        ctx.lineTo(x + w - c / 2, y + h - c / 2);
        ctx.lineTo(x + w - c, y + h - c / 2);
        ctx.lineTo(x + w - c, y + h);
        ctx.lineTo(x + c, y + h);
        ctx.lineTo(x + c, y + h - c / 2);
        ctx.lineTo(x + c / 2, y + h - c / 2);
        ctx.lineTo(x + c / 2, y + h - c);
        ctx.lineTo(x, y + h - c);
        ctx.lineTo(x, y + c);
        ctx.lineTo(x + c / 2, y + c);
        ctx.lineTo(x + c / 2, y + c / 2);
        ctx.lineTo(x + c, y + c / 2);
        ctx.closePath();
    },

    frame(ctx, x, y, w, h, themeName, corner) {
        const theme = FRAME_THEMES[themeName] || FRAME_THEMES.panel;
        const c = corner === undefined ? 8 : corner;
        const grad = ctx.createLinearGradient(0, y, 0, y + h);
        grad.addColorStop(0, theme.top);
        grad.addColorStop(1, theme.bottom);
        this.framePath(ctx, x, y, w, h, c);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = theme.border;
        ctx.stroke();
        const i = 5;
        ctx.fillStyle = theme.light;
        ctx.fillRect(x + c, y + i, w - c * 2, 2);
        ctx.fillRect(x + i, y + c, 2, h - c * 2);
        ctx.fillStyle = theme.shade;
        ctx.fillRect(x + c, y + h - i - 2, w - c * 2, 2);
        ctx.fillRect(x + w - i - 2, y + c, 2, h - c * 2);
    },

    // 어떤 배경에서도 읽히도록 검은 외곽선을 두른 글자
    text(ctx, str, x, y, size, color, align, weight) {
        ctx.font = `${weight || ''} ${size}px ${UI_FONT}`.trim();
        ctx.textAlign = align || 'left';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(4, size / 5);
        ctx.strokeStyle = '#07040e';
        ctx.strokeText(str, x, y);
        ctx.fillStyle = color || '#ffffff';
        ctx.fillText(str, x, y);
    },

    plain(ctx, str, x, y, size, color, align) {
        ctx.font = `${size}px ${UI_FONT}`;
        ctx.textAlign = align || 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color || '#ffffff';
        ctx.fillText(str, x, y);
    },

    bar(ctx, x, y, w, h, ratio, colorTop, colorBottom) {
        ctx.fillStyle = '#07040e';
        ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
        ctx.fillStyle = '#231a33';
        ctx.fillRect(x, y, w, h);
        const fill = Math.round(w * clamp(ratio, 0, 1));
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, colorTop);
        g.addColorStop(1, colorBottom);
        ctx.fillStyle = g;
        ctx.fillRect(x, y, fill, h);
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillRect(x, y, fill, 3);
    }
};
