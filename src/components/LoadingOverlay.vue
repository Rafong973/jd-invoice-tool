<template>
  <div v-if="visible" class="overlay">
    <div class="spinner">
      <div class="dot dot1"></div>
      <div class="dot dot2"></div>
      <div class="dot dot3"></div>
    </div>
    <p class="text">{{ text }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  text?: string
}>()
</script>

<style scoped>
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.spinner {
  display: flex;
  gap: 8px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: #e2231a;
  animation: bounce 1.4s ease-in-out infinite;
}

.dot1 { animation-delay: -0.32s; }
.dot2 { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.text {
  margin-top: 16px;
  font-size: 14px;
  color: #666;
}
</style>
