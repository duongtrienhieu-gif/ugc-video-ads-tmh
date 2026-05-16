import { create } from 'zustand'
import { supabase, requireUserId } from '../lib/supabase'
import type { Product, Model, Script, VoicePreset, VoiceHistoryItem, BRoll } from './types'
import { useAppStore } from './appStore'

// ── Row → TypeScript helpers ────────────────────────────────────────────────

/**
 * Detect if a text looks like a CTA (call-to-action) rather than actual ingredients.
 * Used to filter out legacy CTA text leaking into the new Ingredients field after
 * the schema rename. Old products had CTAs like "DAFTAR UNTUK DAPATKAN HARGA..."
 * stored in the `cta` column — we don't want to surface those as "ingredients".
 */
function looksLikeCTA(text: string): boolean {
  if (!text) return false
  const t = text.trim()
  if (!t) return false
  const upper = t.toUpperCase()
  // Common CTA / marketing imperatives across English, Malay, Vietnamese
  const ctaKeywords = [
    // Malay
    'DAFTAR', 'BELI SEKARANG', 'BELI NOW', 'TEMPAH', 'TAWARAN',
    'JOM BELI', 'KLIK DI SINI', 'KLIK SINI',
    // Vietnamese
    'MUA NGAY', 'ĐẶT HÀNG', 'ĐĂNG KÝ', 'NHẬN NGAY', 'ĐẶT MUA',
    'NHẤN VÀO ĐÂY', 'CLICK NGAY',
    // English
    'BUY NOW', 'ORDER NOW', 'ORDER TODAY', 'CLICK HERE', 'REGISTER NOW',
    'SUBSCRIBE', 'SHOP NOW', 'GET IT NOW', 'GET YOURS', 'SIGN UP',
    'JOIN NOW', 'LEARN MORE', 'CLAIM NOW', 'CLAIM YOUR',
  ]
  return ctaKeywords.some((kw) => upper.includes(kw))
}

function toProduct(row: Record<string, unknown>): Product {
  // Read from new column first; fallback to legacy `cta` column.
  // Strip CTA-like text — those were stored in the old `cta` column and leak in.
  const rawIngredients = ((row.ingredients ?? row.cta) as string) ?? ''
  const cleanIngredients = looksLikeCTA(rawIngredients) ? '' : rawIngredients

  return {
    id: row.id as string,
    createdAt: row.created_at as number,
    productName: (row.product_name as string) ?? '',
    productDescription: (row.product_description as string) ?? '',
    targetMarket: (row.target_market as string) ?? '',
    painPoints: (row.pain_points as string) ?? '',
    usps: (row.usps as string) ?? '',
    benefits: (row.benefits as string) ?? '',
    offer: (row.offer as string) ?? '',
    ingredients: cleanIngredients,
    productImage: (row.product_image as string) ?? '',
  }
}

function toModel(row: Record<string, unknown>): Model {
  const params = (row.character_params as Record<string, unknown>) ?? {}
  return {
    id: row.id as string,
    createdAt: row.created_at as number,
    name: (row.label as string) ?? '',
    characterImage: (row.character_image as string) ?? '',
    notes: (params.notes as string) ?? '',
    source: ((params.source as string) ?? 'manual-import') as Model['source'],
    jsonProfile: (params.jsonProfile as Record<string, unknown>) ?? null,
    variants: Array.isArray(params.variants) ? (params.variants as Model['variants']) : undefined,
  }
}

function toScript(row: Record<string, unknown>): Script {
  return {
    id: row.id as string,
    createdAt: row.created_at as number,
    title: (row.title as string) ?? '',
    scriptText: (row.full_script as string) ?? '',
    linkedProductId: (row.hook as string) ?? '',
    source: ((row.body as string) ?? 'manual') as Script['source'],
  }
}

function toVoice(row: Record<string, unknown>): VoicePreset {
  return {
    id: row.id as string,
    createdAt: row.created_at as number,
    label: (row.label as string) ?? '',
    voiceName: (row.voice_name as string) ?? '',
    gender: ((row.gender as string) ?? 'Female') as 'Female' | 'Male',
    styleInstructions: (row.style_instructions as string) ?? '',
    creativity: (row.creativity as number) ?? 1.3,
    ambience: ((row.ambience as string) ?? 'Studio') as 'Studio' | 'Small Room',
    linkedModelId: (row.linked_model_id as string) ?? '',
  }
}

function toVoiceHistory(row: Record<string, unknown>): VoiceHistoryItem {
  let packed: Record<string, string> = {}
  try { packed = JSON.parse((row.label as string) ?? '{}') } catch { /* empty */ }
  return {
    id: row.id as string,
    createdAt: row.created_at as number,
    voiceName: (row.voice_name as string) ?? '',
    voiceId: packed.voiceId ?? '',
    modelId: packed.modelId ?? '',
    scriptText: (row.script as string) ?? '',
    scriptPreview: packed.scriptPreview ?? '',
    audioUrl: (row.audio_url as string) ?? '',
    duration: (row.duration as number) ?? 0,
  }
}

function toBRoll(row: Record<string, unknown>): BRoll {
  let packed: Record<string, string | undefined> = {}
  try { packed = JSON.parse((row.label as string) ?? '{}') } catch { /* empty */ }
  return {
    id: row.id as string,
    createdAt: row.created_at as number,
    imageUrl: (row.image_url as string) ?? '',
    prompt: (row.prompt as string) ?? '',
    videoUrl: (row.video_url as string) || undefined,
    videos: (row.videos as BRoll['videos']) ?? [],
    productId: packed.productId ?? undefined,
    modelId: packed.modelId ?? undefined,
    scriptId: packed.scriptId ?? undefined,
  }
}

// Show insert errors as toast so user knows data didn't save
function reportError(action: string, error: { message?: string } | null) {
  if (!error) return
  const msg = error.message ?? String(error)
  console.error(`${action} error:`, msg)
  try {
    useAppStore.getState().addToast(`${action} thất bại: ${msg}`, 'error')
  } catch { /* appStore may not be ready */ }
}

// ── Store ────────────────────────────────────────────────────────────────────

interface BankState {
  products: Product[]
  models: Model[]
  scripts: Script[]
  voices: VoicePreset[]
  voiceHistory: VoiceHistoryItem[]
  brolls: BRoll[]
  loading: boolean

  loadAll: () => Promise<void>

  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => Promise<void>
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  getProductById: (id: string) => Product | undefined

  addModel: (model: Omit<Model, 'id' | 'createdAt'>) => Promise<void>
  updateModel: (id: string, updates: Partial<Model>) => Promise<void>
  deleteModel: (id: string) => Promise<void>
  getModelById: (id: string) => Model | undefined

  addScript: (script: Omit<Script, 'id' | 'createdAt'>) => Promise<void>
  updateScript: (id: string, updates: Partial<Script>) => Promise<void>
  deleteScript: (id: string) => Promise<void>
  getScriptById: (id: string) => Script | undefined

  addVoice: (voice: Omit<VoicePreset, 'id' | 'createdAt'>) => Promise<void>
  updateVoice: (id: string, updates: Partial<VoicePreset>) => Promise<void>
  deleteVoice: (id: string) => Promise<void>
  getVoiceById: (id: string) => VoicePreset | undefined

  addBRoll: (broll: Omit<BRoll, 'id' | 'createdAt'>) => Promise<void>
  updateBRoll: (id: string, updates: Partial<BRoll>) => Promise<void>
  deleteBRoll: (id: string) => Promise<void>
  getBRollById: (id: string) => BRoll | undefined

  addVoiceHistory: (item: VoiceHistoryItem) => Promise<void>
  deleteVoiceHistory: (id: string) => Promise<void>
  clearVoiceHistory: () => Promise<void>
}

// Guard against concurrent loadAll calls (React StrictMode runs effects twice)
let loadAllInFlight: Promise<void> | null = null

export const useBankStore = create<BankState>((set, get) => ({
  products: [],
  models: [],
  scripts: [],
  voices: [],
  voiceHistory: [],
  brolls: [],
  loading: false,

  loadAll: async () => {
    if (loadAllInFlight) return loadAllInFlight
    loadAllInFlight = (async () => {
      set({ loading: true })
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          console.warn('[loadAll] No user — skipping')
          set({ loading: false })
          return
        }

        console.log('[loadAll] Loading data for user:', { id: user.id, email: user.email })

        const [p, m, s, v, vh, b] = await Promise.all([
          supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('models').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('scripts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('voices').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('voice_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('brolls').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        ])

        console.log('[loadAll] Counts:', {
          products: p.data?.length ?? `ERROR: ${p.error?.message}`,
          models: m.data?.length ?? `ERROR: ${m.error?.message}`,
          scripts: s.data?.length ?? `ERROR: ${s.error?.message}`,
          voices: v.data?.length ?? `ERROR: ${v.error?.message}`,
          voice_history: vh.data?.length ?? `ERROR: ${vh.error?.message}`,
          brolls: b.data?.length ?? `ERROR: ${b.error?.message}`,
        })

        // Report any per-table errors to user so they know data fetch failed
        if (p.error)  reportError('Tải sản phẩm',  p.error)
        if (m.error)  reportError('Tải Avatar AI',  m.error)
        if (s.error)  reportError('Tải kịch bản',  s.error)
        if (v.error)  reportError('Tải giọng đọc', v.error)
        if (vh.error) reportError('Tải lịch sử',   vh.error)
        if (b.error)  reportError('Tải B-Roll',    b.error)

        set((prev) => ({
          products:     p.error  ? prev.products     : (p.data  ?? []).map(toProduct),
          models:       m.error  ? prev.models       : (m.data  ?? []).map(toModel),
          scripts:      s.error  ? prev.scripts      : (s.data  ?? []).map(toScript),
          voices:       v.error  ? prev.voices       : (v.data  ?? []).map(toVoice),
          voiceHistory: vh.error ? prev.voiceHistory : (vh.data ?? []).map(toVoiceHistory),
          brolls:       b.error  ? prev.brolls       : (b.data  ?? []).map(toBRoll),
          loading: false,
        }))
      } catch (e) {
        console.error('loadAll error:', e)
        set({ loading: false })
      } finally {
        loadAllInFlight = null
      }
    })()
    return loadAllInFlight
  },

  // ── Products ──────────────────────────────────────────────────────────────
  addProduct: async (product) => {
    const tempId = crypto.randomUUID()
    const tempItem: Product = { id: tempId, createdAt: Date.now(), ...product }
    set((s) => ({ products: [tempItem, ...s.products] }))
    try {
      const user_id = await requireUserId()
      console.log('[addProduct] inserting with user_id:', user_id)
      const { data: row, error } = await supabase.from('products').insert({
        user_id,
        product_name: product.productName,
        product_description: product.productDescription,
        target_market: product.targetMarket,
        pain_points: product.painPoints,
        usps: product.usps,
        benefits: product.benefits,
        offer: product.offer,
        cta: product.ingredients,  // legacy column name — stores ingredients
        product_image: product.productImage,
      }).select().single()
      if (error) {
        reportError('Lưu sản phẩm', error)
        set((s) => ({ products: s.products.filter((p) => p.id !== tempId) }))
      } else if (row) {
        set((s) => ({ products: s.products.map((p) => p.id === tempId ? toProduct(row) : p) }))
      }
    } catch (e) {
      reportError('Lưu sản phẩm', { message: e instanceof Error ? e.message : String(e) })
      set((s) => ({ products: s.products.filter((p) => p.id !== tempId) }))
    }
  },

  updateProduct: async (id, updates) => {
    const patch: Record<string, unknown> = {}
    if (updates.productName !== undefined) patch.product_name = updates.productName
    if (updates.productDescription !== undefined) patch.product_description = updates.productDescription
    if (updates.targetMarket !== undefined) patch.target_market = updates.targetMarket
    if (updates.painPoints !== undefined) patch.pain_points = updates.painPoints
    if (updates.usps !== undefined) patch.usps = updates.usps
    if (updates.benefits !== undefined) patch.benefits = updates.benefits
    if (updates.offer !== undefined) patch.offer = updates.offer
    if (updates.ingredients !== undefined) patch.cta = updates.ingredients  // legacy column name
    if (updates.productImage !== undefined) patch.product_image = updates.productImage
    const { error } = await supabase.from('products').update(patch).eq('id', id)
    if (error) reportError('Cập nhật sản phẩm', error)
    else set((s) => ({ products: s.products.map((p) => p.id === id ? { ...p, ...updates } : p) }))
  },

  deleteProduct: async (id) => {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) reportError('Xóa sản phẩm', error)
    else set((s) => ({ products: s.products.filter((p) => p.id !== id) }))
  },

  getProductById: (id) => get().products.find((p) => p.id === id),

  // ── Models ────────────────────────────────────────────────────────────────
  addModel: async (model) => {
    const tempId = crypto.randomUUID()
    const tempItem: Model = { id: tempId, createdAt: Date.now(), ...model }
    set((s) => ({ models: [tempItem, ...s.models] }))
    try {
      const user_id = await requireUserId()
      const { data: row, error } = await supabase.from('models').insert({
        user_id,
        label: model.name,
        character_image: model.characterImage,
        character_params: {
          notes: model.notes,
          source: model.source,
          jsonProfile: model.jsonProfile,
          variants: model.variants ?? [],
        },
      }).select().single()
      if (error) {
        reportError('Lưu Avatar AI', error)
        set((s) => ({ models: s.models.filter((m) => m.id !== tempId) }))
      } else if (row) {
        set((s) => ({ models: s.models.map((m) => m.id === tempId ? toModel(row) : m) }))
      }
    } catch (e) {
      reportError('Lưu Avatar AI', { message: e instanceof Error ? e.message : String(e) })
      set((s) => ({ models: s.models.filter((m) => m.id !== tempId) }))
    }
  },

  updateModel: async (id, updates) => {
    const patch: Record<string, unknown> = {}
    if (updates.name !== undefined) patch.label = updates.name
    if (updates.characterImage !== undefined) patch.character_image = updates.characterImage
    if (
      updates.notes !== undefined ||
      updates.source !== undefined ||
      updates.jsonProfile !== undefined ||
      updates.variants !== undefined
    ) {
      const current = get().models.find((m) => m.id === id)
      patch.character_params = {
        notes: updates.notes ?? current?.notes ?? '',
        source: updates.source ?? current?.source ?? 'manual-import',
        jsonProfile: updates.jsonProfile !== undefined ? updates.jsonProfile : current?.jsonProfile ?? null,
        variants: updates.variants !== undefined ? updates.variants : current?.variants ?? undefined,
      }
    }
    const { error } = await supabase.from('models').update(patch).eq('id', id)
    if (error) reportError('Cập nhật Avatar AI', error)
    else set((s) => ({ models: s.models.map((m) => m.id === id ? { ...m, ...updates } : m) }))
  },

  deleteModel: async (id) => {
    const { error } = await supabase.from('models').delete().eq('id', id)
    if (error) reportError('Xóa Avatar AI', error)
    else set((s) => ({ models: s.models.filter((m) => m.id !== id) }))
  },

  getModelById: (id) => get().models.find((m) => m.id === id),

  // ── Scripts ───────────────────────────────────────────────────────────────
  addScript: async (script) => {
    const tempId = crypto.randomUUID()
    const tempItem: Script = { id: tempId, createdAt: Date.now(), ...script }
    set((s) => ({ scripts: [tempItem, ...s.scripts] }))
    try {
      const user_id = await requireUserId()
      const { data: row, error } = await supabase.from('scripts').insert({
        user_id,
        title: script.title,
        full_script: script.scriptText,
        hook: script.linkedProductId,
        body: script.source,
        cta: '',
      }).select().single()
      if (error) {
        reportError('Lưu kịch bản', error)
        set((s) => ({ scripts: s.scripts.filter((sc) => sc.id !== tempId) }))
      } else if (row) {
        set((s) => ({ scripts: s.scripts.map((sc) => sc.id === tempId ? toScript(row) : sc) }))
      }
    } catch (e) {
      reportError('Lưu kịch bản', { message: e instanceof Error ? e.message : String(e) })
      set((s) => ({ scripts: s.scripts.filter((sc) => sc.id !== tempId) }))
    }
  },

  updateScript: async (id, updates) => {
    const patch: Record<string, unknown> = {}
    if (updates.title !== undefined) patch.title = updates.title
    if (updates.scriptText !== undefined) patch.full_script = updates.scriptText
    if (updates.linkedProductId !== undefined) patch.hook = updates.linkedProductId
    if (updates.source !== undefined) patch.body = updates.source
    const { error } = await supabase.from('scripts').update(patch).eq('id', id)
    if (error) reportError('Cập nhật kịch bản', error)
    else set((s) => ({ scripts: s.scripts.map((sc) => sc.id === id ? { ...sc, ...updates } : sc) }))
  },

  deleteScript: async (id) => {
    const { error } = await supabase.from('scripts').delete().eq('id', id)
    if (error) reportError('Xóa kịch bản', error)
    else set((s) => ({ scripts: s.scripts.filter((sc) => sc.id !== id) }))
  },

  getScriptById: (id) => get().scripts.find((s) => s.id === id),

  // ── Voices ────────────────────────────────────────────────────────────────
  addVoice: async (voice) => {
    const tempId = crypto.randomUUID()
    const tempItem: VoicePreset = { id: tempId, createdAt: Date.now(), ...voice }
    set((s) => ({ voices: [tempItem, ...s.voices] }))
    try {
      const user_id = await requireUserId()
      const { data: row, error } = await supabase.from('voices').insert({
        user_id,
        label: voice.label,
        voice_name: voice.voiceName,
        gender: voice.gender,
        style_instructions: voice.styleInstructions,
        creativity: voice.creativity,
        ambience: voice.ambience,
        linked_model_id: voice.linkedModelId,
      }).select().single()
      if (error) {
        reportError('Lưu giọng đọc', error)
        set((s) => ({ voices: s.voices.filter((v) => v.id !== tempId) }))
      } else if (row) {
        set((s) => ({ voices: s.voices.map((v) => v.id === tempId ? toVoice(row) : v) }))
      }
    } catch (e) {
      reportError('Lưu giọng đọc', { message: e instanceof Error ? e.message : String(e) })
      set((s) => ({ voices: s.voices.filter((v) => v.id !== tempId) }))
    }
  },

  updateVoice: async (id, updates) => {
    const patch: Record<string, unknown> = {}
    if (updates.label !== undefined) patch.label = updates.label
    if (updates.voiceName !== undefined) patch.voice_name = updates.voiceName
    if (updates.gender !== undefined) patch.gender = updates.gender
    if (updates.styleInstructions !== undefined) patch.style_instructions = updates.styleInstructions
    if (updates.creativity !== undefined) patch.creativity = updates.creativity
    if (updates.ambience !== undefined) patch.ambience = updates.ambience
    if (updates.linkedModelId !== undefined) patch.linked_model_id = updates.linkedModelId
    const { error } = await supabase.from('voices').update(patch).eq('id', id)
    if (error) reportError('Cập nhật giọng đọc', error)
    else set((s) => ({ voices: s.voices.map((v) => v.id === id ? { ...v, ...updates } : v) }))
  },

  deleteVoice: async (id) => {
    const { error } = await supabase.from('voices').delete().eq('id', id)
    if (error) reportError('Xóa giọng đọc', error)
    else set((s) => ({ voices: s.voices.filter((v) => v.id !== id) }))
  },

  getVoiceById: (id) => get().voices.find((v) => v.id === id),

  // ── Voice History ─────────────────────────────────────────────────────────
  addVoiceHistory: async (item) => {
    try {
      const user_id = await requireUserId()
      const { error } = await supabase.from('voice_history').insert({
        id: item.id,
        user_id,
        created_at: item.createdAt,
        voice_name: item.voiceName,
        audio_url: item.audioUrl,
        duration: item.duration,
        script: item.scriptText,
        label: JSON.stringify({ voiceId: item.voiceId, modelId: item.modelId, scriptPreview: item.scriptPreview }),
      })
      if (error) reportError('Lưu lịch sử giọng', error)
    } catch (e) {
      reportError('Lưu lịch sử giọng', { message: e instanceof Error ? e.message : String(e) })
    }
    set((s) => ({ voiceHistory: [item, ...s.voiceHistory] }))
  },

  deleteVoiceHistory: async (id) => {
    const { error } = await supabase.from('voice_history').delete().eq('id', id)
    if (error) reportError('Xóa lịch sử', error)
    else set((s) => ({ voiceHistory: s.voiceHistory.filter((h) => h.id !== id) }))
  },

  clearVoiceHistory: async () => {
    const user_id = await requireUserId()
    const { error } = await supabase.from('voice_history').delete().eq('user_id', user_id)
    if (error) reportError('Xóa lịch sử', error)
    else set({ voiceHistory: [] })
  },

  // ── BRolls ────────────────────────────────────────────────────────────────
  addBRoll: async (broll) => {
    const tempId = crypto.randomUUID()
    const tempItem: BRoll = { id: tempId, createdAt: Date.now(), videos: [], ...broll }
    set((s) => ({ brolls: [tempItem, ...s.brolls] }))
    try {
      const user_id = await requireUserId()
      const { data: row, error } = await supabase.from('brolls').insert({
        user_id,
        image_url: broll.imageUrl,
        prompt: broll.prompt,
        video_url: broll.videoUrl ?? '',
        videos: broll.videos ?? [],
        label: JSON.stringify({ productId: broll.productId ?? null, modelId: broll.modelId ?? null, scriptId: broll.scriptId ?? null }),
      }).select().single()
      if (error) {
        reportError('Lưu B-Roll', error)
        set((s) => ({ brolls: s.brolls.filter((b) => b.id !== tempId) }))
      } else if (row) {
        set((s) => ({ brolls: s.brolls.map((b) => b.id === tempId ? toBRoll(row) : b) }))
      }
    } catch (e) {
      reportError('Lưu B-Roll', { message: e instanceof Error ? e.message : String(e) })
      set((s) => ({ brolls: s.brolls.filter((b) => b.id !== tempId) }))
    }
  },

  updateBRoll: async (id, updates) => {
    const patch: Record<string, unknown> = {}
    if (updates.imageUrl !== undefined) patch.image_url = updates.imageUrl
    if (updates.prompt !== undefined) patch.prompt = updates.prompt
    if (updates.videoUrl !== undefined) patch.video_url = updates.videoUrl
    if (updates.videos !== undefined) patch.videos = updates.videos
    if (updates.productId !== undefined || updates.modelId !== undefined || updates.scriptId !== undefined) {
      const current = get().brolls.find((b) => b.id === id)
      patch.label = JSON.stringify({
        productId: updates.productId !== undefined ? (updates.productId ?? null) : (current?.productId ?? null),
        modelId: updates.modelId !== undefined ? (updates.modelId ?? null) : (current?.modelId ?? null),
        scriptId: updates.scriptId !== undefined ? (updates.scriptId ?? null) : (current?.scriptId ?? null),
      })
    }
    const { error } = await supabase.from('brolls').update(patch).eq('id', id)
    if (error) reportError('Cập nhật B-Roll', error)
    else set((s) => ({ brolls: s.brolls.map((b) => b.id === id ? { ...b, ...updates } : b) }))
  },

  deleteBRoll: async (id) => {
    const { error } = await supabase.from('brolls').delete().eq('id', id)
    if (error) reportError('Xóa B-Roll', error)
    else set((s) => ({ brolls: s.brolls.filter((b) => b.id !== id) }))
  },

  getBRollById: (id) => get().brolls.find((b) => b.id === id),
}))
