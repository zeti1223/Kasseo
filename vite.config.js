import { fileURLToPath, URL } from 'node:url'
import { execSync } from 'node:child_process'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

function getGitCommitInfo() {
  let commitHash = ''
  let commitDate = ''
  try {
    commitHash = execSync('git rev-parse --short HEAD').toString().trim()
    commitDate = execSync('git log -1 --format=%cI').toString().trim()
  } catch {
    commitHash = process.env.GITHUB_SHA ? process.env.GITHUB_SHA.substring(0, 7) : ''
    commitDate = new Date().toISOString()
  }
  return { commitHash, commitDate }
}

const { commitHash, commitDate } = getGitCommitInfo()

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    define: {
      __APP_COMMIT_HASH__: JSON.stringify(commitHash),
      __APP_COMMIT_DATE__: JSON.stringify(commitDate),
      __APP_REPO_URL__: JSON.stringify('https://github.com/zeti1223/Kasseo'),
    },
    plugins: [vue()],
    base: '/',
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: Number(env.PORT) || 5173,
      allowedHosts: true,
    },
  }
})
