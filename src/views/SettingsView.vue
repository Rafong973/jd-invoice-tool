<template>
  <div class="settings-view">
    <h2>设置</h2>

    <div class="section card">
      <h3 class="section-title">Cookie 管理</h3>

      <div v-if="store.cookie" class="cookie-status">
        <span class="status-dot logged"></span>
        <span>当前已保存 Cookie</span>
      </div>
      <div v-else class="cookie-status">
        <span class="status-dot unlogged"></span>
        <span>未保存 Cookie</span>
      </div>

      <CookieInput v-model="cookieText" />

      <div class="btn-group">
        <button class="btn btn-primary" :disabled="!cookieText || store.loading" @click="handleSave">
          保存 Cookie
        </button>
        <button class="btn btn-secondary" :disabled="!store.cookie" @click="handleDelete">
          删除 Cookie
        </button>
      </div>

      <div v-if="message" :class="['msg', messageType]">
        {{ message }}
      </div>
    </div>

    <div class="section card">
      <h3 class="section-title">发票抬头管理</h3>
      <TitleManager :titles="store.titles" @save="handleSaveTitles" />
    </div>

    <div class="section card">
      <h3 class="section-title">关于</h3>
      <p class="about-text">京东发票管理工具 v1.0.0</p>
      <p class="about-text">基于 Tauri + Vue3 构建</p>
    </div>

    <LoadingOverlay :visible="store.loading" text="处理中..." />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import type { InvoiceTitle } from '@/types/title'
import CookieInput from '@/components/CookieInput.vue'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import TitleManager from '@/components/TitleManager.vue'

const store = useAppStore()
const cookieText = ref(store.cookie || '')
const message = ref('')
const messageType = ref<'success' | 'error'>('success')

onMounted(() => {
  store.loadTitles()
})

async function handleSave() {
  if (!cookieText.value.trim()) return
  store.loading = true
  message.value = ''
  try {
    await store.setCookie(cookieText.value.trim())
    messageType.value = 'success'
    message.value = 'Cookie 保存成功'
  } catch (e: unknown) {
    messageType.value = 'error'
    message.value = e instanceof Error ? e.message : String(e)
  } finally {
    store.loading = false
  }
}

async function handleDelete() {
  store.loading = true
  message.value = ''
  try {
    await store.clearCookie()
    cookieText.value = ''
    messageType.value = 'success'
    message.value = 'Cookie 已删除'
  } catch (e: unknown) {
    messageType.value = 'error'
    message.value = e instanceof Error ? e.message : String(e)
  } finally {
    store.loading = false
  }
}

async function handleSaveTitles(titles: InvoiceTitle[]) {
  await store.saveTitlesData(titles)
}
</script>

<style scoped>
.settings-view h2 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 20px;
}

.section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #333;
}

.cookie-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #666;
  margin-bottom: 16px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.logged {
  background-color: #52c41a;
}

.status-dot.unlogged {
  background-color: #fa8c16;
}

.btn-group {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.msg {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
}

.msg.success {
  background-color: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.msg.error {
  background-color: #fff2f0;
  color: #e2231a;
  border: 1px solid #ffccc7;
}

.about-text {
  font-size: 14px;
  color: #999;
  margin-bottom: 4px;
}
</style>
