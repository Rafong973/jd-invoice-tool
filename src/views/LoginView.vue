<template>
  <div class="login-view">
    <div class="login-card card">
      <h2 class="title">登录京东账号</h2>
      <p class="desc">点击下方按钮打开京东登录页面，登录完成后复制 Cookie 粘贴到下方</p>

      <button class="btn btn-primary btn-large" @click="openLogin">
        打开京东登录
      </button>

      <div class="divider">
        <span>或手动粘贴 Cookie</span>
      </div>

      <CookieInput v-model="cookieText" />

      <div class="actions">
        <button class="btn btn-primary" :disabled="!cookieText || loading" @click="handleSave">
          保存并登录
        </button>
      </div>

      <div v-if="store.error" class="error-msg">
        {{ store.error }}
      </div>

      <div class="tips">
        <h4>如何获取 Cookie？</h4>
        <ol>
          <li>点击「打开京东登录」或手动访问 m.jd.com</li>
          <li>在浏览器中完成登录</li>
          <li>按 F12 打开开发者工具 → Network</li>
          <li>刷新页面，点击任意京东域名的请求</li>
          <li>在 Request Headers 中找到 Cookie，完整复制</li>
          <li>粘贴到上方文本框，点击保存</li>
        </ol>
      </div>
    </div>

    <LoadingOverlay :visible="loading" text="正在保存..." />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { openBrowser } from '@/api'
import { useAppStore } from '@/stores/app'
import CookieInput from '@/components/CookieInput.vue'
import LoadingOverlay from '@/components/LoadingOverlay.vue'

const store = useAppStore()
const router = useRouter()
const cookieText = ref('')
const loading = ref(false)

async function openLogin() {
  await openBrowser('https://passport.jd.com/new/login.aspx')
}

async function handleSave() {
  if (!cookieText.value.trim()) return
  loading.value = true
  store.error = null
  try {
    await store.setCookie(cookieText.value.trim())
    router.push('/')
  } catch (e: unknown) {
    store.error = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-view {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 100px);
}

.login-card {
  max-width: 520px;
  width: 100%;
}

.title {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.desc {
  font-size: 14px;
  color: #999;
  margin-bottom: 24px;
}

.btn-large {
  width: 100%;
  padding: 12px;
  font-size: 16px;
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 24px 0;
  color: #ccc;
  font-size: 13px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #eee;
}

.actions {
  margin-top: 16px;
}

.actions .btn {
  width: 100%;
  padding: 10px;
}

.tips {
  margin-top: 24px;
  padding: 16px;
  background: #fafafa;
  border-radius: 6px;
}

.tips h4 {
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
}

.tips ol {
  padding-left: 20px;
  font-size: 13px;
  color: #888;
  line-height: 1.8;
}
</style>
