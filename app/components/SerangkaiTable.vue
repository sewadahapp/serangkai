<template>
  <STable v-bind="$attrs" :data="rows">
    <SColumn
      v-for="column in safeColumns"
      :key="column.field"
      :field="column.field"
      :header="column.header"
      :footer="column.footer"
      :sortable="column.sortable === true"
      :filterable="column.filterable === true"
      :pinned="column.pinned === 'left' || column.pinned === 'right' ? column.pinned : undefined"
    />
  </STable>
</template>

<script setup lang="ts">
import STable from '@sewadah/selaras/components/Table.vue'
import SColumn from '@sewadah/selaras/components/Column'

/**
 * Declarative Selaras table bridge.
 *
 * Selaras' table API declares columns as `<SColumn>` children. Comark content
 * carries JSON, so this wrapper converts the validated column descriptors into
 * real Selaras column components instead of reimplementing the table.
 */
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  data?: Array<Record<string, unknown>>
  columns?: Array<Record<string, unknown>>
}>(), {
  data: () => [],
  columns: () => [],
})

const rows = computed(() => Array.isArray(props.data) ? props.data : [])

const safeColumns = computed(() => (Array.isArray(props.columns) ? props.columns : [])
  .filter(column => column && typeof column.field === 'string' && column.field.length <= 120)
  .slice(0, 30)
  .map(column => ({
    field: String(column.field),
    header: typeof column.header === 'string' ? column.header : undefined,
    footer: typeof column.footer === 'string' ? column.footer : undefined,
    sortable: column.sortable === true,
    filterable: column.filterable === true,
    pinned: column.pinned,
  })))
</script>
