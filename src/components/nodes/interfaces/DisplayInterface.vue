<template>
  <div class="text-center">
    Valeur: {{ modelValue }}
  </div>
</template>

<script setup>

  const props = defineProps(["modelValue", "intf", "node"])

  const emit = defineEmits(["update:modelValue", "openSidebar"])

</script>
