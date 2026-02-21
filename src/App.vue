<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const countries = ref<Country[]>([])
const issues = ref<Issue[]>([])
const stamps = ref<Stamp[]>([])
const libraryItems = ref<LibraryItem[]>([])
const selectedCountry = ref<Country | null>(null)
const selectedStamp = ref<Stamp | null>(null)
const currentView = ref<'home' | 'catalog' | 'library'>('catalog')

const ownedTotal = computed(() => libraryItems.value.reduce((sum, item) => sum + (item.quantity ?? 0), 0))
const ownedUnique = computed(() => libraryItems.value.length)

onMounted(async () => {
  await Promise.all([loadCountries(), loadLibrary()])
})

async function loadCountries() {
  countries.value = await window.api.getCountries()
}

async function loadLibrary() {
  libraryItems.value = await window.api.getMyLibrary()
}

async function loadCountry(country: Country) {
  currentView.value = 'catalog'
  selectedCountry.value = country
  selectedStamp.value = null
  const data = await window.api.getIssuesByCountry(country.id)
  issues.value = data.issues
  stamps.value = data.stamps
}

function showLibrary() {
  currentView.value = 'library'
  selectedCountry.value = null
  selectedStamp.value = null
}

function selectStamp(stamp: Stamp) {
  selectedStamp.value = stamp
}

function selectLibraryItem(item: LibraryItem) {
  if (!item.stamp_id || !item.stamp_name) {
    return
  }

  selectedStamp.value = {
    id: item.stamp_id,
    issue_id: item.issue_id ?? 0,
    name: item.stamp_name,
    face_value: item.face_value ?? '',
    currency: item.currency ?? '',
    catalog_no: item.catalog_no ?? '',
    main_image_path: item.main_image_path,
    price_mint: item.price_mint,
    owned_count: item.quantity,
    notes: item.item_note ?? item.stamp_notes ?? undefined,
  }
}

function getStampsForIssue(issueId: number) {
  return stamps.value.filter((stamp) => stamp.issue_id === issueId)
}
</script>

<template>
  <div class="grid grid-cols-[280px_1fr_auto] h-screen bg-black text-white font-sans overflow-hidden p-2 gap-2">
    <aside class="flex flex-col gap-2 overflow-hidden">
      <div class="bg-dark rounded-xl p-5 shadow-lg">
        <h1 class="text-spotify text-xl font-black mb-4 tracking-tighter">STAMPDESK</h1>
        <nav class="flex flex-col gap-3 font-bold text-gray-400">
          <button
            @click="currentView = 'home'"
            :class="['hover:text-white transition text-left cursor-pointer', currentView === 'home' ? 'text-white' : '']"
          >
            Home
          </button>
          <button
            @click="currentView = 'catalog'"
            :class="['hover:text-white transition text-left cursor-pointer', currentView === 'catalog' ? 'text-white' : '']"
          >
            Catalog
          </button>
          <button
            @click="showLibrary"
            :class="['hover:text-white transition text-left cursor-pointer', currentView === 'library' ? 'text-white' : '']"
          >
            My Library
          </button>
        </nav>
      </div>

      <div class="bg-dark rounded-xl flex-1 overflow-y-auto p-4">
        <template v-if="currentView === 'catalog'">
          <div class="flex items-center justify-between mb-4 px-2">
            <p class="text-xs font-bold text-gray-500 uppercase tracking-widest">Countries</p>
          </div>

          <div
            v-for="country in countries"
            :key="country.id"
            @click="loadCountry(country)"
            :class="[
              'flex items-center gap-3 p-2 rounded-md cursor-pointer group mb-1',
              selectedCountry?.id === country.id ? 'bg-card-hover text-white' : 'text-gray-400 hover:bg-card-hover/40 hover:text-white',
            ]"
          >
            <div class="w-10 h-10 bg-card rounded shadow-lg shrink-0"></div>
            <div class="truncate">
              <div class="font-bold text-sm truncate">{{ country.name }}</div>
              <div class="text-[10px] opacity-60">Since {{ country.valid_from }}</div>
            </div>
          </div>
        </template>

        <template v-else-if="currentView === 'library'">
          <p class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">Summary</p>
          <div class="grid grid-cols-2 gap-2">
            <div class="bg-card rounded-lg p-3">
              <p class="text-[10px] text-gray-500 uppercase">Owned pieces</p>
              <p class="text-2xl font-black">{{ ownedTotal }}</p>
            </div>
            <div class="bg-card rounded-lg p-3">
              <p class="text-[10px] text-gray-500 uppercase">Unique items</p>
              <p class="text-2xl font-black">{{ ownedUnique }}</p>
            </div>
          </div>
        </template>

        <div v-else class="p-2 text-center text-sm text-gray-400">
          Welcome to StampDesk
        </div>
      </div>
    </aside>

    <main class="bg-linear-to-b from-gray-900 to-black rounded-xl overflow-y-auto relative flex flex-col">
      <nav class="sticky top-0 z-30 flex items-center justify-between p-4 bg-gray-900/40 backdrop-blur-md">
        <h2 class="text-sm font-bold uppercase tracking-widest text-gray-400">
          {{ currentView === 'catalog' ? 'Catalog' : currentView === 'library' ? 'My Library' : 'Home' }}
        </h2>
      </nav>

      <div class="p-8 pt-4">
        <template v-if="currentView === 'catalog'">
          <div v-if="!selectedCountry" class="h-[60vh] flex items-center justify-center text-center opacity-30">
            <div>
              <p class="text-xl uppercase tracking-[0.2em]">Select a country</p>
            </div>
          </div>

          <template v-else>
            <header class="mb-8">
              <h2 class="text-6xl font-black tracking-tighter mb-2">{{ selectedCountry.name }}</h2>
              <div class="text-sm font-bold text-gray-400">{{ issues.length }} issues in catalog</div>
            </header>

            <section v-for="issue in issues" :key="issue.id" class="mb-12">
              <h3 class="text-xl font-bold mb-6 flex items-center gap-4 text-gray-400">
                {{ issue.year }} <span class="h-px flex-1 bg-white/10"></span>
              </h3>

              <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                <div
                  v-for="stamp in getStampsForIssue(issue.id)"
                  :key="stamp.id"
                  @click="selectStamp(stamp)"
                  :class="[
                    'bg-card p-3 rounded-lg hover:bg-card-hover transition-all cursor-pointer relative',
                    selectedStamp?.id === stamp.id ? 'bg-card-hover ring-1 ring-white/20' : '',
                    stamp.owned_count === 0 ? 'opacity-50 grayscale hover:grayscale-0' : '',
                  ]"
                >
                  <div
                    v-if="stamp.owned_count > 0"
                    class="absolute top-2 left-2 bg-spotify text-black rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black z-10 shadow-lg"
                  >
                    {{ stamp.owned_count }}
                  </div>
                  <div class="aspect-square bg-gray-800 rounded-md mb-3 flex items-center justify-center overflow-hidden shadow-inner">
                    <img v-if="stamp.main_image_path" :src="`stamp://${stamp.main_image_path}`" class="w-full h-full object-contain" />
                    <span v-else class="text-xs text-gray-500">No image</span>
                  </div>
                  <div class="font-bold truncate text-sm">{{ stamp.name }}</div>
                  <div class="text-[11px] text-gray-500 mt-1 font-mono uppercase">{{ stamp.catalog_no }}</div>
                </div>
              </div>
            </section>
          </template>
        </template>

        <template v-else-if="currentView === 'library'">
          <div v-if="libraryItems.length === 0" class="h-[60vh] flex items-center justify-center text-center opacity-40">
            <div>
              <h3 class="text-2xl font-bold">Your library is empty</h3>
              <p class="text-gray-500 mt-2">Add rows into collection_item and they will appear here.</p>
            </div>
          </div>

          <div v-else class="space-y-3">
            <button
              v-for="item in libraryItems"
              :key="item.collection_item_id"
              @click="selectLibraryItem(item)"
              class="w-full text-left bg-card hover:bg-card-hover transition rounded-lg p-4 border border-transparent hover:border-white/10 cursor-pointer"
            >
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="font-bold text-base">{{ item.stamp_name || 'Unknown item' }}</p>
                  <p class="text-xs text-gray-400 mt-1">
                    {{ item.country_name || 'Unknown country' }} | {{ item.issue_year || 'n/a' }} | {{ item.catalog_no || 'n/a' }}
                  </p>
                  <p v-if="item.variant_name" class="text-xs text-gray-500 mt-1">Variant: {{ item.variant_name }}</p>
                </div>
                <div class="text-right">
                  <p class="text-xs uppercase text-gray-500">Quantity</p>
                  <p class="text-xl font-black text-spotify">{{ item.quantity }}</p>
                </div>
              </div>
            </button>
          </div>
        </template>

        <template v-else>
          <div class="h-[60vh] flex items-center justify-center text-center">
            <div>
              <h2 class="text-3xl font-bold">Welcome to StampDesk</h2>
              <p class="text-gray-500 mt-2">Use Catalog for reference and My Library for your owned items.</p>
            </div>
          </div>
        </template>
      </div>
    </main>

    <aside
      v-if="selectedStamp"
      class="w-80 bg-dark rounded-xl p-5 flex flex-col gap-6 animate-in slide-in-from-right-4 duration-300"
    >
      <div class="flex items-center justify-between">
        <h3 class="font-bold">Stamp Details</h3>
        <button @click="selectedStamp = null" class="text-gray-500 hover:text-white text-xl cursor-pointer">x</button>
      </div>

      <div class="bg-card rounded-lg overflow-hidden shadow-2xl">
        <div class="aspect-square flex items-center justify-center p-4">
          <img v-if="selectedStamp.main_image_path" :src="`stamp://${selectedStamp.main_image_path}`" class="w-full h-full object-contain shadow-md" />
          <div v-else class="text-sm text-gray-500">No image</div>
        </div>
      </div>

      <div>
        <h2 class="text-2xl font-black mb-1 leading-tight">{{ selectedStamp.name }}</h2>
        <p class="text-spotify font-bold italic">{{ selectedStamp.catalog_no || 'n/a' }}</p>
      </div>

      <div class="flex flex-col gap-4 text-sm border-t border-white/5 pt-4">
        <div class="flex justify-between">
          <span class="text-gray-500">Nominal</span>
          <span class="font-mono">{{ selectedStamp.face_value }} {{ selectedStamp.currency }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">Catalog Price</span>
          <span class="text-spotify font-bold">{{ selectedStamp.price_mint ?? '--' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">Owned</span>
          <span class="text-spotify">{{ selectedStamp.owned_count }}</span>
        </div>
      </div>

      <div class="flex-1 bg-white/5 rounded-lg p-3 text-xs text-gray-400 leading-relaxed overflow-y-auto">
        {{ selectedStamp.notes || 'No extra notes available.' }}
      </div>
    </aside>
  </div>
</template>

<style scoped>
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
