<template>
  <div id="app">
    <HeaderBar />
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import HeaderBar from '@/components/HeaderBar.vue'

const store = useAppStore()
const router = useRouter()

onMounted(async () => {
  await store.initCookie()
  if (!store.isLoggedIn) {
    router.push('/login')
  }
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: #f5f5f5;
  color: #333;
}

#app {
  min-height: 100vh;
}

.main-content {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-primary {
  background-color: #e2231a;
  color: white;
}

.btn-primary:hover {
  background-color: #c41d15;
}

.btn-secondary {
  background-color: #f0f0f0;
  color: #333;
}

.btn-secondary:hover {
  background-color: #e0e0e0;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  margin-bottom: 12px;
}

.input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.input:focus {
  border-color: #e2231a;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #999;
}

.error-msg {
  background-color: #fff2f0;
  border: 1px solid #ffccc7;
  color: #e2231a;
  padding: 10px 14px;
  border-radius: 6px;
  margin-bottom: 16px;
}
</style>
