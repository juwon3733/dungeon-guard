// 본부의 업적 게시판(hqView 'progress'): 업적, 마왕 숙련도, 일일·주간 임무 세 탭과 칭호 고르기.
// 표와 계산은 js/game/progress.js. UI 객체에 메서드를 더한다(hq.js와 같은 방식)
Object.assign(UI, {
    progressTab: 'ach',

    layoutHqProgress() {
        const tabs = [['ach', '업적'], ['mastery', '숙련도'], ['missions', '임무']];
        tabs.forEach(([id, label], i) => {
            this.button(`prog_tab_${id}`, 520 + i * 300, 30, 280, 64, {
                tab: 'collection', on: this.progressTab === id, label, onClick: () => { this.progressTab = id; Sfx.play('click'); }
            });
        });
        if (this.progressTab === 'ach') {
            // 칭호가 있는 업적 칸을 누르면 그 칭호를 단다(다시 누르면 뗀다)
            ACHIEVEMENTS.forEach((a, i) => {
                if (!a.title || !Progress.data.done.includes(a.id)) return;
                const r = this.achRect(i);
                this.button(`ach_title_${a.id}`, r.x + r.w - 160, r.y + r.h - 46, 136, 34, {
                    label: Progress.data.title === a.title ? '칭호 떼기' : '칭호 달기', size: 18, theme: Progress.data.title === a.title ? undefined : 'gold',
                    onClick: () => { Progress.setTitle(Progress.data.title === a.title ? '' : a.title); Sfx.play('click'); }
                });
            });
        }
    },

    achRect(i) {
        const cols = 4;
        const w = 438;
        const h = 112;
        return { x: 50 + (i % cols) * (w + 12), y: 130 + Math.floor(i / cols) * (h + 10), w, h };
    },

    drawHqProgress(ctx) {
        const T = UI_THEME;
        UIKit.text(ctx, '업적 게시판', 60, 62, 40, T.cream, 'left', 'bold');
        if (Progress.data.title) UIKit.text(ctx, `칭호 · ${Progress.data.title}`, 60, 104, 22, T.gold, 'left', 'bold');
        if (this.progressTab === 'ach') this.drawAchievements(ctx);
        else if (this.progressTab === 'mastery') this.drawMastery(ctx);
        else this.drawMissions(ctx);
    },

    // 진행 막대: 도트 칸(2px 단위), 채운 쪽은 color
    progressBar(ctx, x, y, w, h, ratio, color) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = color;
        ctx.fillRect(x + 2, y + 2, Math.round((w - 4) * clamp(ratio, 0, 1) / 2) * 2, h - 4);
    },

    drawAchievements(ctx) {
        const T = UI_THEME;
        const done = Progress.data.done;
        UIKit.text(ctx, `${done.length} / ${ACHIEVEMENTS.length} 달성`, GAME_WIDTH - 260, 110, 22, T.creamSoft, 'right', 'bold');
        ACHIEVEMENTS.forEach((a, i) => {
            const r = this.achRect(i);
            const ok = done.includes(a.id);
            UIKit.panel(ctx, r.x, r.y, r.w, r.h, { tint: ok ? null : 'shade' });
            if (ok) UIKit.gradeFrame(ctx, r.x, r.y, r.w, r.h, T.goldLine, 3);
            UIKit.ink(ctx, a.name, r.x + 26, r.y + 32, 22, ok ? T.inkWax : T.ink, 'left', 'bold');
            UIKit.ink(ctx, a.desc, r.x + 26, r.y + 58, 16, T.inkSoft, 'left');
            const v = Progress.statValue(a.stat);
            if (!ok) {
                this.progressBar(ctx, r.x + 26, r.y + 76, r.w - 210, 12, v / a.need, '#c46bff');
                UIKit.ink(ctx, `${Math.min(v, a.need).toLocaleString()} / ${a.need.toLocaleString()}`, r.x + r.w - 26, r.y + 83, 16, T.inkSoft, 'right');
            }
            if (a.title) UIKit.ink(ctx, `칭호 · ${a.title}`, r.x + r.w - 26, r.y + 32, 16, ok ? T.inkWax : T.inkSoft, 'right', 'bold');
        });
    },

    drawMastery(ctx) {
        const T = UI_THEME;
        Object.values(DEMON_LORDS).forEach((lord, i) => {
            const x = 80 + (i % 4) * 450;
            const y = 150 + Math.floor(i / 4) * 400;
            const lv = Progress.masteryLevel(lord.id);
            const frame = Progress.masteryFrame(lord.id);
            const xp = Progress.data.mastery[lord.id] || 0;
            UIKit.panel(ctx, x, y, 420, 380);
            // 초상: 숙련도 테두리 색(10레벨은 흐르는 무지개)
            const color = frame.rainbow ? UIKit.gradeFill(ctx, MONSTER_GRADES.mythic.color, x + 110, y + 20, 200, 200) : frame.color;
            UIKit.gradeFrame(ctx, x + 110, y + 20, 200, 200, color, 6);
            this.drawLordPortrait(ctx, lord, x + 118, y + 28, 184);
            UIKit.ink(ctx, lord.name, x + 210, y + 252, 24, T.ink, 'center', 'bold');
            UIKit.ink(ctx, `숙련도 ${lv} · ${frame.name} 테두리`, x + 210, y + 284, 18, T.inkWax, 'center', 'bold');
            const next = MASTERY_XP[lv];
            const prev = MASTERY_XP[lv - 1];
            this.progressBar(ctx, x + 40, y + 298, 340, 16, next ? (xp - prev) / (next - prev) : 1, frame.rainbow ? T.gold : frame.color);
            UIKit.ink(ctx, next ? `${xp.toLocaleString()} / ${next.toLocaleString()}` : '최고 레벨', x + 210, y + 334, 18, T.inkSoft, 'center');
        });
        UIKit.text(ctx, '그 마왕으로 버틴 라운드(층)만큼, 임무를 이루면 더 오른다', GAME_WIDTH / 2, 1040, 20, T.creamSoft, 'center');
    },

    drawMissions(ctx) {
        const T = UI_THEME;
        const list = Progress.refreshMissions();
        const m = Progress.data.missions;
        const block = (title, picks, store, kind, y, xp) => {
            UIKit.text(ctx, title, 120, y, 30, T.gold, 'left', 'bold');
            UIKit.text(ctx, `하나에 숙련도 ${xp}`, GAME_WIDTH - 120, y, 20, T.creamSoft, 'right');
            picks.forEach((p, i) => {
                const need = p[kind];
                const v = Math.min(store[p.id] || 0, need);
                const ok = m.claimed.includes(`${kind === 'daily' ? 'd' : 'w'}:${p.id}`);
                const ry = y + 30 + i * 110;
                UIKit.panel(ctx, 100, ry, GAME_WIDTH - 200, 96, { tint: ok ? null : 'shade' });
                if (ok) UIKit.gradeFrame(ctx, 100, ry, GAME_WIDTH - 200, 96, T.goldLine, 3);
                UIKit.ink(ctx, p.text.replace('{n}', need.toLocaleString()), 140, ry + 40, 26, ok ? T.inkWax : T.ink, 'left', 'bold');
                this.progressBar(ctx, 140, ry + 62, GAME_WIDTH - 560, 16, v / need, ok ? '#ffd25a' : '#4fd1c5');
                UIKit.ink(ctx, ok ? '완료' : `${v.toLocaleString()} / ${need.toLocaleString()}`, GAME_WIDTH - 140, ry + 52, 24, ok ? T.inkWax : T.inkSoft, 'right', 'bold');
            });
        };
        block('오늘의 임무', list.daily, m.daily, 'daily', 160, MISSION_RULES.dailyXp);
        block('이번 주 임무', list.weekly, m.weekly, 'weekly', 580, MISSION_RULES.weeklyXp);
    }
});
