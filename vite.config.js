import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/tesla-hub/',   // GitHub 레포 이름과 동일하게
})
