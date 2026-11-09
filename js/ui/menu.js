// 전투 메뉴(Esc 또는 오른쪽 위 톱니): 판을 멈추고 계속, 설정, 본부로(스토리: 마지막 라운드부터 이어하기), 항복
// 항복은 입력(Game.act 'surrender')이라 도전 기록 재생에도 남는다. 두 번 눌러야 한다
const BATTLE_MENU = { w: 640, h: 720 };
// 단축키 표. Q, W, E는 이번 판 마왕의 스킬 이름이다(E는 권능으로 열렸을 때만)
function battleMenuKeys() {
    const skill = slot => LORD_SKILLS[Game.skillKey(slot)].name;
    const third = Game.thirdSkill();
    return [['S', '소환'], ['Q', skill(0)], ['W', skill(1)], ...(third ? [['E', LORD_SKILLS[third.key].name]] : []), ['G', '강화'], ['A', '자동 합치기'], ['Space', '다음 라운드'],
        ['F', '배속'], ['P', '일시정지'], ['Tab', '탭 바꾸기']];
}

Object.assign(UI, {
    battleMenu: false,
    menuWasPaused: false,
    surrenderArmed: 0, // 남은 확인 시간(초). 0보다 크면 한 번 더 누르면 항복

    openBattleMenu() {
        if (!Game.inPlay() || this.battleMenu) return;
        this.cancel();
        this.battleMenu = true;
        this.hqSettings = false;
        this.surrenderArmed = 0;
        this.menuWasPaused = Game.paused;
        Game.paused = true;
        Sfx.play('click');
    },

    closeBattleMenu() {
        if (!this.battleMenu) return;
        this.battleMenu = false;
        this.hqSettings = false;
        this.surrenderArmed = 0;
        Game.paused = this.menuWasPaused;
    },

    menuRect() {
        const M = BATTLE_MENU;
        return { x: GAME_WIDTH / 2 - M.w / 2, y: (GAME_HEIGHT - M.h) / 2, w: M.w, h: M.h };
    },

    layoutBattleMenu() {
        if (this.hqSettings) {
            this.layoutSettings(); // js/ui/hq.js (닫기는 메뉴로 돌아온다)
            return;
        }
        const R = this.menuRect();
        const x = R.x + 70;
        const w = R.w - 140;
        let y = R.y + 132;
        const add = (id, opts) => {
            this.button(id, x, y, w, 76, Object.assign({ size: 28 }, opts));
            y += 90;
        };
        add('menu_resume', { label: '계속', icon: 'retry', theme: 'gold', onClick: () => this.closeBattleMenu() });
        add('menu_settings', { label: '설정', icon: 'gear', onClick: () => { this.hqSettings = true; } });
        const save = !Game.challenge && Game.readRunSave();
        if (save) add('menu_hq', { label: '본부로', icon: 'lord', sub: `라운드 ${save.waveIndex + 1}부터 이어하기`, onClick: () => this.leaveToHQ() });
        const armed = this.surrenderArmed > 0;
        add('menu_surrender', {
            label: armed ? '정말 항복? 한 번 더' : '항복', icon: 'close', theme: 'danger', size: armed ? 24 : 28,
            sub: Game.challenge ? '지금 라운드로 기록' : null, onClick: () => this.pressSurrender()
        });
    },

    // 스토리 판을 두고 본부로: 마지막 준비 단계의 저장은 남는다(본부의 이어하기)
    leaveToHQ() {
        this.battleMenu = false;
        this.hqSettings = false;
        Game.paused = false;
        this.openHQ();
    },

    pressSurrender() {
        if (this.surrenderArmed <= 0) {
            this.surrenderArmed = 3;
            Sfx.play('mergeFail');
            return;
        }
        this.battleMenu = false;
        this.hqSettings = false;
        this.surrenderArmed = 0;
        Game.paused = false;
        Game.act({ kind: 'surrender' });
    },

    // 메뉴가 열려 있을 때의 키: Esc(설정 → 메뉴 → 닫기)
    onBattleMenuKey(code) {
        if (code === 'KeyM') return false;
        if (code === 'Escape') {
            if (this.hqSettings) this.hqSettings = false;
            else this.closeBattleMenu();
        }
        return true;
    },

    drawBattleMenu(ctx) {
        const T = UI_THEME;
        ctx.fillStyle = T.dim;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        if (this.hqSettings) {
            this.drawHqSettings(ctx);
            return;
        }
        const R = this.menuRect();
        UIKit.panel(ctx, R.x, R.y, R.w, R.h);
        UIKit.text(ctx, '메뉴', R.x + R.w / 2, R.y + 62, 44, T.gold, 'center', 'bold');
        const st = Game.stage && stageDef(Game.stage);
        const where = Game.challenge ? { daily: '일일 도전', abyss: '끝없는 심연', raid: '주간 토벌전' }[Game.challenge.kind] : st ? `${st.no}. ${st.name}` : '';
        UIKit.text(ctx, `${where} · 라운드 ${Game.waveIndex + 1}`, R.x + R.w / 2, R.y + 96, 20, T.creamSoft, 'center');
        // 아래: 단축키
        const last = this.buttons.filter(b => b.id.startsWith('menu_')).reduce((m, b) => Math.max(m, b.y + b.h), 0);
        const ky0 = last + 28;
        ctx.fillStyle = T.parchmentDark;
        ctx.fillRect(R.x + 50, ky0 - 14, R.w - 100, 2);
        battleMenuKeys().forEach(([key, label], i) => {
            const kx = R.x + 50 + (i % 3) * 182;
            const ky = ky0 + Math.floor(i / 3) * 46;
            const kw = this.drawKeyCap(ctx, key, kx, ky + 2, 18);
            UIKit.text(ctx, label, kx + kw + 8, ky + 19, 18, T.creamSoft, 'left');
        });
    }
});
