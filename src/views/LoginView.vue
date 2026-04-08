<template>
  <div class="login-view">
    <div class="login-card card">
      <h2 class="title">登录京东账号</h2>
      <p class="desc">在应用内打开京东登录页面，登录后自动获取 Cookie</p>

      <div class="login-options">
        <button class="btn btn-primary btn-large" @click="openInternalLogin" :disabled="loginWindowOpen">
          {{ loginWindowOpen ? "登录窗口已打开" : "应用内打开京东登录" }}
        </button>

        <p v-if="loginWindowOpen" class="login-hint">请在登录窗口中完成登录，然后点击下方按钮提取 Cookie</p>

        <div v-if="loginWindowOpen" class="extract-section">
          <button class="btn btn-success btn-large" @click="extractAndSaveCookies" :disabled="extracting">
            {{ extracting ? "正在提取..." : "提取 Cookie 并登录" }}
          </button>

          <button class="btn btn-text" @click="closeLoginWindowAction">关闭登录窗口</button>
          
          <div class="clear-btns">
            <button class="btn btn-small" @click="handleClearCookies">清除 Cookies</button>
            <button class="btn btn-small" @click="handleClearCache">清除所有缓存</button>
          </div>
        </div>
      </div>

      <div class="divider">
        <span>或手动粘贴 Cookie</span>
      </div>

      <CookieInput v-model="cookieText" />

      <div class="actions">
        <button class="btn btn-secondary" :disabled="!cookieText || loading" @click="handleSaveManual">
          手动保存 Cookie
        </button>
      </div>

      <div v-if="store.error" class="error-msg">
        {{ store.error }}
      </div>

      <div class="tips">
        <h4>手动获取 Cookie 方法</h4>
        <ol>
          <li>点击「应用内打开京东登录」</li>
          <li>在登录窗口中完成登录</li>
          <li>点击「提取 Cookie 并登录」按钮</li>
          <li>如果自动提取失败，手动复制 Cookie</li>
          <li>打开浏览器开发者工具(F12) → Network</li>
          <li>访问 jd.com 相关页面，获取 Cookie</li>
          <li>粘贴到上方文本框，点击保存</li>
        </ol>
      </div>
    </div>

    <LoadingOverlay :visible="loading" text="正在保存..." />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { openLoginWindowClean, closeLoginWindowClean, clearLoginWindowCookies, clearLoginWindowCache, extractCookiesClean, isLoginWindowCleanOpen } from '@/api'
import { useAppStore } from '@/stores/app'
import CookieInput from '@/components/CookieInput.vue'
import LoadingOverlay from '@/components/LoadingOverlay.vue'

const store = useAppStore()
const router = useRouter()
const cookieText = ref('')
const loading = ref(false)
const loginWindowOpen = ref(false)
const extracting = ref(false)
const autoLoginDetected = ref(false)

let checkInterval: ReturnType<typeof setInterval> | null = null

async function checkLoginWindow() {
  try {
    loginWindowOpen.value = await isLoginWindowCleanOpen()
  } catch (e) {
    loginWindowOpen.value = false
  }
}

async function openInternalLogin() {
  store.error = null
  autoLoginDetected.value = false
  
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }
  
  if (loginWindowOpen.value) {
    await closeLoginWindowClean()
  }
  loginWindowOpen.value = false
  
  try {
    await openLoginWindowClean()
    loginWindowOpen.value = true
    startAutoLoginCheck()
  } catch (e) {
    store.error = e instanceof Error ? e.message : String(e)
  }
}

async function closeLoginWindowAction() {
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }
  if (loginWindowOpen.value) {
    await closeLoginWindowClean()
  }
  loginWindowOpen.value = false
}

async function handleClearCookies() {
  if (loginWindowOpen.value) {
    await closeLoginWindowClean()
    loginWindowOpen.value = false
  }
  await clearLoginWindowCookies()
}

async function handleClearCache() {
  if (loginWindowOpen.value) {
    await closeLoginWindowClean()
    loginWindowOpen.value = false
  }
  await clearLoginWindowCache()
}

async function extractAndSaveCookies() {
  extracting.value = true
  store.error = null
  
  try {
    const cookies = await extractCookiesClean()
    await closeLoginWindowClean()
    loginWindowOpen.value = false
    
    if (cookies) {
      await store.setCookie(cookies)
      setTimeout(() => router.push('/'), 500)
    }
  } catch (e) {
    store.error = e instanceof Error ? e.message : String(e)
  } finally {
    extracting.value = false
  }
}

function startAutoLoginCheck() {
  if (checkInterval) clearInterval(checkInterval)

  let hasCheckedBeforeLogin = false

  checkInterval = setInterval(async () => {
    if (!loginWindowOpen.value || autoLoginDetected.value || extracting.value) {
      return
    }

    try {
      const isOpen = await isLoginWindowCleanOpen()
      console.log('Check: window open =', isOpen)
      if (!isOpen) {
        loginWindowOpen.value = false
        clearInterval(checkInterval!)
        return
      }

      const cookies = await extractCookiesClean()
      console.log('Check: got cookies =', cookies ? 'yes' : 'no')
      
      if (cookies && cookies.length > 0) {
        const hasOldCookies = !cookies.includes('pt_key') && !cookies.includes('pt_pin')
        
        if (hasOldCookies && !hasCheckedBeforeLogin) {
          hasCheckedBeforeLogin = true
          console.log('Found old cookies, ignoring, waiting for login...')
          return
        }
        
        if (cookies.includes('pt_key') || cookies.includes('pt_pin')) {
          console.log('Auto-detected new login cookies, saving...')
          autoLoginDetected.value = true
          clearInterval(checkInterval!)

          await closeLoginWindowClean()
          loginWindowOpen.value = false
          await store.setCookie(cookies)
          setTimeout(() => router.push('/'), 500)
        }
      }
    } catch (e: any) {
      console.log('Check: error =', e?.message || e)
    }
  }, 2000)
}

async function handleSaveManual() {
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

onMounted(async () => {
  await checkLoginWindow()
})

onUnmounted(() => {
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }
})
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

.login-options {
  margin-bottom: 16px;
}

.btn-large {
  width: 100%;
  padding: 12px;
  font-size: 16px;
}

.btn-success {
  background: #28a745;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  margin-bottom: 8px;
}

.btn-success:hover:not(:disabled) {
  background: #218838;
}

.btn-success:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-text {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 13px;
  text-decoration: underline;
}

.btn-text:hover {
  color: #333;
}

.btn-small {
  background: #f5f5f5;
  border: 1px solid #ddd;
  color: #666;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-small:hover {
  background: #eee;
  color: #333;
}

.clear-btns {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  justify-content: center;
}

.login-hint {
  margin-top: 8px;
  font-size: 13px;
  color: #666;
  text-align: center;
}

.extract-section {
  margin-bottom: 16px;
  padding: 16px;
  background: #f0f9f0;
  border-radius: 8px;
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

.btn-secondary {
  background: #666;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.btn-secondary:hover:not(:disabled) {
  background: #555;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-msg {
  margin-top: 12px;
  padding: 10px;
  background: #fee;
  color: #c33;
  border-radius: 6px;
  font-size: 13px;
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