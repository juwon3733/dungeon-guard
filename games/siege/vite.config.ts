import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 같은 하위 경로에서도 돌도록 상대 경로로 빌드
export default defineConfig({ base: './', plugins: [react()] });
