import process from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const owner = process.env.GITHUB_REPOSITORY_OWNER
const isUserSite = owner && repoName && repoName.toLowerCase() === `${owner.toLowerCase()}.github.io`

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.GITHUB_ACTIONS ? (isUserSite ? '/' : `/${repoName}/`) : '/',
})
