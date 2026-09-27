import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';

export default defineConfig([
  // ios·android 는 Capacitor 가 생성한다(안에 웹 빌드 사본이 들어 있다)
  globalIgnores(['dist', 'ios', 'android']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // prettier와 충돌하는 포맷 규칙 끄기 (항상 마지막에 위치)
      prettier,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
]);
