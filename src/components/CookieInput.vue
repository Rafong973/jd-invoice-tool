<template>
  <div class="cookie-input">
    <label class="label">京东 Cookie</label>
    <textarea
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      class="textarea"
      placeholder="请粘贴从浏览器获取的京东 Cookie..."
      rows="4"
    />
    <p class="hint">
      获取方法：登录京东 → F12 开发者工具 → Network → 复制任意请求的 Cookie
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<style scoped>
.cookie-input {
  margin-bottom: 16px;
}

.label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: #333;
}

.textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  font-family: monospace;
  outline: none;
  resize: vertical;
  transition: border-color 0.2s;
}

.textarea:focus {
  border-color: #e2231a;
}

.hint {
  font-size: 12px;
  color: #999;
  margin-top: 6px;
  line-height: 1.5;
}
</style>
