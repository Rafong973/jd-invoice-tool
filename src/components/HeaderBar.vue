<template>
  <header class="header">
    <div class="header-left">
      <h1 class="logo" @click="goHome">京东发票管理</h1>
    </div>
    <nav class="header-nav">
      <router-link v-if="store.isLoggedIn" to="/" class="nav-link">发票列表</router-link>
      <router-link v-if="store.isLoggedIn" to="/exchange" class="nav-link">换开发票</router-link>
      <router-link to="/settings" class="nav-link">设置</router-link>
      <span v-if="store.isLoggedIn" class="status-badge">已登录</span>
      <span v-else class="status-badge unlogin">未登录</span>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const router = useRouter()

function goHome() {
  if (store.isLoggedIn) {
    router.push('/')
  } else {
    router.push('/login')
  }
}
</script>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  background: white;
  border-bottom: 1px solid #eee;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.logo {
  font-size: 18px;
  font-weight: 600;
  color: #e2231a;
  cursor: pointer;
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 20px;
}

.nav-link {
  text-decoration: none;
  color: #666;
  font-size: 14px;
  padding: 6px 12px;
  border-radius: 4px;
  transition: all 0.2s;
}

.nav-link:hover,
.nav-link.router-link-active {
  color: #e2231a;
  background-color: #fff5f5;
}

.status-badge {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 12px;
  background-color: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.status-badge.unlogin {
  background-color: #fff7e6;
  color: #fa8c16;
  border-color: #ffd591;
}
</style>
