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
        </div>

        <div style="text-align: center; margin-top: 6px" v-if="false">
          <button class="btn btn-text" @click="switchAccountLogin">切换账号登录（无缓存）</button>
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
          <li>访问 m.jd.com 相关页面，获取 Cookie</li>
          <li>粘贴到上方文本框，点击保存</li>
        </ol>
      </div>
    </div>

    <LoadingOverlay :visible="loading" text="正在保存..." />
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from "vue"
  import { useRouter } from "vue-router"
  import {
    openLoginWindow,
    openLoginWindowClean,
    closeLoginWindow,
    closeLoginWindowClean,
    extractCookies,
    extractCookiesClean,
    isLoginWindowOpen,
    isLoginWindowCleanOpen
  } from "@/api"
  import { useAppStore } from "@/stores/app"
  import CookieInput from "@/components/CookieInput.vue"
  import LoadingOverlay from "@/components/LoadingOverlay.vue"

  const store = useAppStore()
  const router = useRouter()
  const cookieText = ref("")
  const loading = ref(false)
  const loginWindowOpen = ref(false)
  const loginWindowCleanOpen = ref(false)
  const extracting = ref(false)
  const extractingClean = ref(false)
  const autoLoginDetected = ref(false)
  const loginSuccessDetected = ref(false)

  let checkInterval: ReturnType<typeof setInterval> | null = null

  async function checkLoginWindow() {
    try {
      loginWindowOpen.value = await isLoginWindowOpen()
      loginWindowCleanOpen.value = await isLoginWindowCleanOpen()
    } catch (e) {
      loginWindowOpen.value = false
      loginWindowCleanOpen.value = false
    }
  }

  async function openInternalLogin() {
    store.error = null
    autoLoginDetected.value = false
    loginSuccessDetected.value = false
    try {
      await openLoginWindow()
      loginWindowOpen.value = true
      startAutoLoginCheck()
    } catch (e) {
      store.error = e instanceof Error ? e.message : String(e)
    }
  }

  async function switchAccountLogin() {
    store.error = null
    autoLoginDetected.value = false
    loginSuccessDetected.value = false

    if (checkInterval) {
      clearInterval(checkInterval)
      checkInterval = null
    }

    if (loginWindowCleanOpen.value) {
      await closeLoginWindowClean()
    }
    if (loginWindowOpen.value) {
      await closeLoginWindow()
    }
    loginWindowOpen.value = false
    loginWindowCleanOpen.value = false

    try {
      await openLoginWindowClean()
      loginWindowCleanOpen.value = true
      startAutoLoginCheckClean()
    } catch (e) {
      store.error = e instanceof Error ? e.message : String(e)
    }
  }

  function startAutoLoginCheck() {
    if (checkInterval) clearInterval(checkInterval)

    checkInterval = setInterval(async () => {
      if (!loginWindowOpen.value || autoLoginDetected.value || extracting.value) {
        return
      }

      try {
        const isOpen = await isLoginWindowOpen()
        console.log("Check: window open =", isOpen)
        if (!isOpen) {
          loginWindowOpen.value = false
          clearInterval(checkInterval!)
          return
        }

        const cookies = await extractCookies()
        console.log("Check: got cookies =", cookies ? "yes" : "no", cookies?.substring(0, 50))
        if (cookies && cookies.length > 0) {
          console.log("Auto-detected cookies, saving...")
          autoLoginDetected.value = true
          clearInterval(checkInterval!)

          await closeLoginWindow()
          loginWindowOpen.value = false
          await store.setCookie(cookies)
          setTimeout(() => router.push("/"), 500)
        }
      } catch (e: any) {
        console.log("Check: error =", e?.message || e)
      }
    }, 2000)
  }

  function startAutoLoginCheckClean() {
    if (checkInterval) clearInterval(checkInterval)

    checkInterval = setInterval(async () => {
      if (!loginWindowCleanOpen.value || autoLoginDetected.value || extractingClean.value) {
        return
      }

      try {
        const isOpen = await isLoginWindowCleanOpen()
        console.log("Check clean: window open =", isOpen)
        if (!isOpen) {
          loginWindowCleanOpen.value = false
          clearInterval(checkInterval!)
          return
        }

        const cookies = await extractCookiesClean()
        console.log("Check clean: got cookies =", cookies ? "yes" : "no", cookies?.substring(0, 50))
        if (cookies && cookies.length > 0) {
          console.log("Auto-detected clean cookies, saving...")
          autoLoginDetected.value = true
          clearInterval(checkInterval!)

          await closeLoginWindowClean()
          loginWindowCleanOpen.value = false
          await store.setCookie(cookies)
          setTimeout(() => router.push("/"), 500)
        }
      } catch (e: any) {
        console.log("Check clean: error =", e?.message || e)
      }
    }, 2000)
  }

  async function closeLoginWindowAction() {
    if (checkInterval) {
      clearInterval(checkInterval)
      checkInterval = null
    }
    try {
      await closeLoginWindow()
      loginWindowOpen.value = false
    } catch (e) {
      store.error = e instanceof Error ? e.message : String(e)
    }
  }

  async function extractAndSaveCookies() {
    extracting.value = true
    store.error = null

    try {
      const cookies = await extractCookies()
      await closeLoginWindow()
      await store.setCookie(cookies)
      setTimeout(() => router.push("/"), 500)
    } catch (e) {
      store.error = e instanceof Error ? e.message : String(e)
    } finally {
      extracting.value = false
    }
  }

  async function handleSaveManual() {
    if (!cookieText.value.trim()) return
    loading.value = true
    store.error = null
    try {
      await store.setCookie(cookieText.value.trim())
      router.push("/")
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
    content: "";
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

  .btn-outline {
    background: transparent;
    color: #666;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    width: 100%;
    padding: 12px;
  }

  .btn-outline:hover:not(:disabled) {
    background: #f5f5f5;
    border-color: #ccc;
  }

  .btn-outline:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .divider-small {
    margin: 16px 0;
    text-align: center;
    color: #ccc;
    font-size: 13px;
    position: relative;
  }

  .divider-small::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 1px;
    background: #eee;
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
