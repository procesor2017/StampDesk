/// <reference types="vite/client" />

interface Country {
  id: number
  name: string
  valid_from: number
  valid_to: number | null
}

interface Issue {
  id: number
  country_id: number
  title: string
  year: number
}

interface Stamp {
  id: number
  issue_id: number
  name: string
  face_value: string
  currency: string
  catalog_no: string
  main_image_path: string | null
  price_mint: number | null
  owned_count: number
  design_desc?: string
  notes?: string
}

interface LibraryItem {
  collection_item_id: number
  quantity: number
  status: 'OWNED' | 'WISH_LIST' | 'SOLD'
  item_note: string | null
  acquired_at: string | null
  stamp_variant_id: number | null
  variant_name: string | null
  stamp_id: number | null
  stamp_name: string | null
  face_value: string | null
  currency: string | null
  catalog_no: string | null
  main_image_path: string | null
  stamp_notes: string | null
  price_mint: number | null
  issue_id: number | null
  issue_title: string | null
  issue_year: number | null
  country_id: number | null
  country_name: string | null
}

interface Window {
  api: {
    getCountries: () => Promise<Country[]>
    addCountry: (name: string) => Promise<Country>
    getIssuesByCountry: (countryId: number) => Promise<{ issues: Issue[]; stamps: Stamp[] }>
    getMyLibrary: () => Promise<LibraryItem[]>
  }
}
