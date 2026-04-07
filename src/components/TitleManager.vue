<template>
  <div class="title-manager">
    <div class="title-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab-btn', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="title-form">
      <div class="form-row">
        <label>抬头名称 <span class="required">*</span></label>
        <input v-model="form.titleName" class="input" placeholder="请输入抬头名称" />
      </div>
      <div class="form-row">
        <label>接收邮箱 <span class="required">*</span></label>
        <input v-model="form.email" class="input" type="email" placeholder="请输入接收邮箱" />
      </div>
      <div v-if="activeTab === 'company'" class="form-row">
        <label>税号</label>
        <input v-model="form.taxNo" class="input" placeholder="请输入纳税人识别号" />
      </div>
      <div class="form-row">
        <label class="checkbox-label">
          <input type="checkbox" v-model="form.isDefault" />
          设为默认抬头
        </label>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" @click="addTitle">添加</button>
      </div>
    </div>

    <div class="title-list">
      <div
        v-for="t in filteredTitles"
        :key="t.id"
        class="title-item"
        :class="{ default: t.isDefault }"
      >
        <div class="title-info">
          <span class="title-name">{{ t.titleName }}</span>
          <span class="email">{{ t.email }}</span>
          <span v-if="t.titleType === 'company'" class="tax-no">税号: {{ t.taxNo }}</span>
          <span v-if="t.isDefault" class="default-tag">默认</span>
        </div>
        <div class="title-actions">
          <button v-if="!t.isDefault" class="btn-link" @click="setDefault(t.id)">设为默认</button>
          <button class="btn-link danger" @click="removeTitle(t.id)">删除</button>
        </div>
      </div>
      <div v-if="filteredTitles.length === 0" class="empty-hint">暂无抬头</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { InvoiceTitle } from '@/types/title'

const props = defineProps<{
  titles: InvoiceTitle[]
}>()

const emit = defineEmits<{
  save: [titles: InvoiceTitle[]]
}>()

const tabs: { key: 'personal' | 'company'; label: string }[] = [
  { key: 'personal', label: '个人' },
  { key: 'company', label: '公司' },
]

const activeTab = ref<'personal' | 'company'>('personal')
const form = ref({ titleName: '', email: '', taxNo: '', isDefault: false })

const filteredTitles = computed(() =>
  props.titles.filter((t) => t.titleType === activeTab.value)
)

function addTitle() {
  if (!form.value.titleName.trim()) {
    alert('请输入抬头名称')
    return
  }
  if (!form.value.email.trim()) {
    alert('请输入接收邮箱')
    return
  }
  const newTitle: InvoiceTitle = {
    id: Date.now().toString(),
    titleType: activeTab.value,
    titleName: form.value.titleName.trim(),
    email: form.value.email.trim(),
    taxNo: form.value.taxNo.trim(),
    isDefault: form.value.isDefault,
  }
  let updated = [...props.titles]
  if (form.value.isDefault) {
    updated = updated.map((t) => (t.titleType === activeTab.value ? { ...t, isDefault: false } : t))
  }
  updated.push(newTitle)
  emit('save', updated)
  form.value = { titleName: '', email: '', taxNo: '', isDefault: false }
}

function setDefault(id: string) {
  const updated = props.titles.map((t) => ({
    ...t,
    isDefault: t.titleType === activeTab.value ? t.id === id : t.isDefault,
  }))
  emit('save', updated)
}

function removeTitle(id: string) {
  emit('save', props.titles.filter((t) => t.id !== id))
}
</script>

<style scoped>
.title-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.tab-btn {
  padding: 6px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.tab-btn.active {
  background: #e2231a;
  color: white;
  border-color: #e2231a;
}

.title-form {
  background: #fafafa;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 16px;
}

.form-row {
  margin-bottom: 10px;
}

.form-row label {
  display: block;
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
}

.required {
  color: #e2231a;
}

.form-row .input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #333;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.title-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.title-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: white;
  border: 1px solid #eee;
  border-radius: 6px;
}

.title-item.default {
  border-color: #b7eb8f;
  background: #f6ffed;
}

.title-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.title-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.email {
  font-size: 12px;
  color: #999;
}

.tax-no {
  font-size: 12px;
  color: #999;
}

.default-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  background: #52c41a;
  color: white;
}

.title-actions {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.btn-link {
  background: none;
  border: none;
  color: #1890ff;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}

.btn-link.danger {
  color: #ff4d4f;
}

.empty-hint {
  text-align: center;
  color: #999;
  font-size: 13px;
  padding: 20px;
}
</style>
