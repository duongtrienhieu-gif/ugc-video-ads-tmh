import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Product, Model, Script, VoicePreset, VoiceHistoryItem, BRoll } from './types'

// ── Row → TypeScript helpers ────────────────────────────────────────────────

function toProduct(row: Record<string, unknown>): Product {
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
    cta: (row.cta as string) ?? '',
    productImage: (row.product_image as string) ?? '',
  }
}

// models table: label=name, character_image=characterImage,
// character_params JSONB = { notes, source, jsonProfile }
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
  }
}

// scripts table: title=title, full_script=scriptText, hook=linkedProductId, body=source
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

// voice_history table: label=JSON({ voiceId, modelId, scriptPreview }), script=scriptText
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

// brolls table: label=JSON({ productId, modelId, scriptId })
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

  // addVoiceHistory takes full item (with id+createdAt) from generateVoice service
  addVoiceHistory: (item: VoiceHistoryItem) => Promise<void>
  deleteVoiceHistory: (id: string) => Promise<void>
  clearVoiceHistory: () => Promise<void>
}

export const useBankStore = create<BankState>((set, get) => ({
  products: [],
  models: [],
  scripts: [],
  voices: [],
  voiceHistory: [],
  brolls: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true })
    const [p, m, s, v, vh, b] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('models').select('*').order('created_at', { ascending: false }),
      supabase.from('scripts').select('*').order('created_at', { ascending: false }),
      supabase.from('voices').select('*').order('created_at', { ascending: false }),
      supabase.from('voice_history').select('*').order('created_at', { ascending: false }),
      supabase.from('brolls').select('*').order('created_at', { ascending: false }),
    ])
    set({
      products: (p.data ?? []).map(toProduct),
      models: (m.data ?? []).map(toModel),
      scripts: (s.data ?? []).map(toScript),
      voices: (v.data ?? []).map(toVoice),
      voiceHistory: (vh.data ?? []).map(toVoiceHistory),
      brolls: (b.data ?? []).map(toBRoll),
      loading: false,
    })
  },

  // ── Products ──────────────────────────────────────────────────────────────
  addProduct: async (product) => {
    const { data: row } = await supabase.from('products').insert({
      product_name: product.productName,
      product_description: product.productDescription,
      target_market: product.targetMarket,
      pain_points: product.painPoints,
      usps: product.usps,
      benefits: product.benefits,
      offer: product.offer,
      cta: product.cta,
      product_image: product.productImage,
    }).select().single()
    if (row) set((s) => ({ products: [toProduct(row), ...s.products] }))
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
    if (updates.cta !== undefined) patch.cta = updates.cta
    if (updates.productImage !== undefined) patch.product_image = updates.productImage
    await supabase.from('products').update(patch).eq('id', id)
    set((s) => ({ products: s.products.map((p) => p.id === id ? { ...p, ...updates } : p) }))
  },

  deleteProduct: async (id) => {
    await supabase.from('products').delete().eq('id', id)
    set((s) => ({ products: s.products.filter((p) => p.id !== id) }))
  },

  getProductById: (id) => get().products.find((p) => p.id === id),

  // ── Models ────────────────────────────────────────────────────────────────
  addModel: async (model) => {
    const { data: row } = await supabase.from('models').insert({
      label: model.name,
      character_image: model.characterImage,
      character_params: { notes: model.notes, source: model.source, jsonProfile: model.jsonProfile },
    }).select().single()
    if (row) set((s) => ({ models: [toModel(row), ...s.models] }))
  },

  updateModel: async (id, updates) => {
    const patch: Record<string, unknown> = {}
    if (updates.name !== undefined) patch.label = updates.name
    if (updates.characterImage !== undefined) patch.character_image = updates.characterImage
    if (updates.notes !== undefined || updates.source !== undefined || updates.jsonProfile !== undefined) {
      const current = get().models.find((m) => m.id === id)
      patch.character_params = {
        notes: updates.notes ?? current?.notes ?? '',
        source: updates.source ?? current?.source ?? 'manual-import',
        jsonProfile: updates.jsonProfile !== undefined ? updates.jsonProfile : current?.jsonProfile ?? null,
      }
    }
    await supabase.from('models').update(patch).eq('id', id)
    set((s) => ({ models: s.models.map((m) => m.id === id ? { ...m, ...updates } : m) }))
  },

  deleteModel: async (id) => {
    await supabase.from('models').delete().eq('id', id)
    set((s) => ({ models: s.models.filter((m) => m.id !== id) }))
  },

  getModelById: (id) => get().models.find((m) => m.id === id),

  // ── Scripts ───────────────────────────────────────────────────────────────
  addScript: async (script) => {
    const { data: row } = await supabase.from('scripts').insert({
      title: script.title,
      full_script: script.scriptText,
      hook: script.linkedProductId,
      body: script.source,
      cta: '',
    }).select().single()
    if (row) set((s) => ({ scripts: [toScript(row), ...s.scripts] }))
  },

  updateScript: async (id, updates) => {
    const patch: Record<string, unknown> = {}
    if (updates.title !== undefined) patch.title = updates.title
    if (updates.scriptText !== undefined) patch.full_script = updates.scriptText
    if (updates.linkedProductId !== undefined) patch.hook = updates.linkedProductId
    if (updates.source !== undefined) patch.body = updates.source
    await supabase.from('scripts').update(patch).eq('id', id)
    set((s) => ({ scripts: s.scripts.map((sc) => sc.id === id ? { ...sc, ...updates } : sc) }))
  },

  deleteScript: async (id) => {
    await supabase.from('scripts').delete().eq('id', id)
    set((s) => ({ scripts: s.scripts.filter((sc) => sc.id !== id) }))
  },

  getScriptById: (id) => get().scripts.find((s) => s.id === id),

  // ── Voices ────────────────────────────────────────────────────────────────
  addVoice: async (voice) => {
    const { data: row } = await supabase.from('voices').insert({
      label: voice.label,
      voice_name: voice.voiceName,
      gender: voice.gender,
      style_instructions: voice.styleInstructions,
      creativity: voice.creativity,
      ambience: voice.ambience,
      linked_model_id: voice.linkedModelId,
    }).select().single()
    if (row) set((s) => ({ voices: [toVoice(row), ...s.voices] }))
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
    await supabase.from('voices').update(patch).eq('id', id)
    set((s) => ({ voices: s.voices.map((v) => v.id === id ? { ...v, ...updates } : v) }))
  },

  deleteVoice: async (id) => {
    await supabase.from('voices').delete().eq('id', id)
    set((s) => ({ voices: s.voices.filter((v) => v.id !== id) }))
  },

  getVoiceById: (id) => get().voices.find((v) => v.id === id),

  // ── Voice History ─────────────────────────────────────────────────────────
  // Takes full VoiceHistoryItem (with id+createdAt) from generateVoice service
  addVoiceHistory: async (item) => {
    await supabase.from('voice_history').insert({
      id: item.id,
      created_at: item.createdAt,
      voice_name: item.voiceName,
      audio_url: item.audioUrl,
      duration: item.duration,
      script: item.scriptText,
      label: JSON.stringify({ voiceId: item.voiceId, modelId: item.modelId, scriptPreview: item.scriptPreview }),
    })
    set((s) => ({ voiceHistory: [item, ...s.voiceHistory] }))
  },

  deleteVoiceHistory: async (id) => {
    await supabase.from('voice_history').delete().eq('id', id)
    set((s) => ({ voiceHistory: s.voiceHistory.filter((h) => h.id !== id) }))
  },

  clearVoiceHistory: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('voice_history').delete().eq('user_id', user.id)
    set({ voiceHistory: [] })
  },

  // ── BRolls ────────────────────────────────────────────────────────────────
  addBRoll: async (broll) => {
    const { data: row } = await supabase.from('brolls').insert({
      image_url: broll.imageUrl,
      prompt: broll.prompt,
      video_url: broll.videoUrl ?? '',
      videos: broll.videos ?? [],
      label: JSON.stringify({ productId: broll.productId ?? null, modelId: broll.modelId ?? null, scriptId: broll.scriptId ?? null }),
    }).select().single()
    if (row) set((s) => ({ brolls: [toBRoll(row), ...s.brolls] }))
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
    await supabase.from('brolls').update(patch).eq('id', id)
    set((s) => ({ brolls: s.brolls.map((b) => b.id === id ? { ...b, ...updates } : b) }))
  },

  deleteBRoll: async (id) => {
    await supabase.from('brolls').delete().eq('id', id)
    set((s) => ({ brolls: s.brolls.filter((b) => b.id !== id) }))
  },

  getBRollById: (id) => get().brolls.find((b) => b.id === id),
}))
