import { useState, useEffect, useRef } from 'react'
import { X, Search, Plus, FolderOpen } from 'lucide-react'
import type { BankType } from '../utils/constants'
import { BANK_CONFIG } from '../utils/constants'
import { useBankStore } from '../stores/bankStore'
import { useAppStore } from '../stores/appStore'
import type { Product, Model, Script, VoicePreset } from '../stores/types'
import BankItemCard from './BankItemCard'
import { useIsDesktop } from '../hooks/useBreakpoint'

type BankItem = Product | Model | Script | VoicePreset

interface BankPickerProps {
  bankType: BankType
  isOpen: boolean
  onSelect: (item: BankItem) => void
  onClose: () => void
}

function getItemName(bankType: BankType, item: BankItem): string {
  switch (bankType) {
    case 'products': return (item as Product).productName
    case 'models': return (item as Model).name
    case 'scripts': return (item as Script).title
    case 'voices': return (item as VoicePreset).label
    default: return ''
  }
}

export default function BankPicker({ bankType, isOpen, onSelect, onClose }: BankPickerProps) {
  const [search, setSearch] = useState('')
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddName, setQuickAddName] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const isDesktop = useIsDesktop()

  const products = useBankStore((s) => s.products)
  const models = useBankStore((s) => s.models)
  const scripts = useBankStore((s) => s.scripts)
  const voices = useBankStore((s) => s.voices)
  const addProduct = useBankStore((s) => s.addProduct)
  const addModel = useBankStore((s) => s.addModel)
  const addScript = useBankStore((s) => s.addScript)
  const addVoice = useBankStore((s) => s.addVoice)
  const openApp = useAppStore((s) => s.openApp)
  const sendToApp = useAppStore((s) => s.sendToApp)

  const items: BankItem[] =
    bankType === 'products' ? products :
    bankType === 'models' ? models :
    bankType === 'scripts' ? scripts :
    voices

  const filtered = search.trim()
    ? items.filter((item) =>
        getItemName(bankType, item).toLowerCase().includes(search.toLowerCase())
      )
    : items

  const isEmpty = items.length === 0

  // Focus search on open, auto-expand quick-add if bank is empty
  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setQuickAddName('')
      setShowQuickAdd(isEmpty)
      if (!isEmpty) {
        setTimeout(() => searchRef.current?.focus(), 100)
      }
    }
  }, [isOpen, isEmpty])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const handleSelect = (item: BankItem) => {
    onSelect(item)
    onClose()
  }

  const handleQuickAdd = () => {
    if (!quickAddName.trim()) return

    const name = quickAddName.trim()
    let newItem: BankItem | null = null

    if (bankType === 'products') {
      addProduct({ productImage: '', productName: name, productDescription: '', targetMarket: '', painPoints: '', usps: '', benefits: '', offer: '', ingredients: '' })
      // Get the latest item (just added)
      newItem = useBankStore.getState().products[useBankStore.getState().products.length - 1]
    } else if (bankType === 'models') {
      addModel({ characterImage: '', name, notes: '', jsonProfile: null, source: 'manual-import' })
      newItem = useBankStore.getState().models[useBankStore.getState().models.length - 1]
    } else if (bankType === 'scripts') {
      addScript({ title: name, scriptText: '', linkedProductId: '', source: 'manual' })
      newItem = useBankStore.getState().scripts[useBankStore.getState().scripts.length - 1]
    } else {
      addVoice({ label: name, voiceName: '', gender: 'Female', styleInstructions: '', creativity: 1.3, ambience: 'Studio', linkedModelId: '' })
      newItem = useBankStore.getState().voices[useBankStore.getState().voices.length - 1]
    }

    if (newItem) {
      onSelect(newItem)
    }
    onClose()
  }

  const handleManageInFinder = () => {
    onClose()
    sendToApp({ targetApp: 'finder', targetField: 'activeBank', data: bankType })
    openApp('finder')
  }

  const label = BANK_CONFIG[bankType].label

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Panel — desktop: stretch nearly full height so long lists (10+
          items) fit without aggressive clipping that hides scrollable items
          below the dock area. */}
      <div
        ref={panelRef}
        className={`fixed z-50 flex flex-col border-black/8 bg-white/95 backdrop-blur-2xl transition-transform duration-300 ease-out ${
          isDesktop
            ? `right-0 top-9 bottom-4 w-[380px] border-l ${isOpen ? 'translate-x-0' : 'translate-x-full'}`
            : `inset-x-0 bottom-0 top-12 border-t rounded-t-2xl ${isOpen ? 'translate-y-0' : 'translate-y-full'}`
        }`}
      >
        {/* Drag handle — mobile only */}
        {!isDesktop && (
          <div className="flex justify-center pt-2 pb-1">
            <div className="h-1 w-10 rounded-full bg-black/12" />
          </div>
        )}
        {/* Header — shows total count so user knows the full inventory size */}
        <div className="flex items-center justify-between border-b border-black/8 px-5 py-3.5">
          <h3 className="text-sm font-semibold tracking-tight text-gray-800">
            Chọn {label}
            {items.length > 0 && (
              <span className="ml-1.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 align-middle">
                {items.length}
              </span>
            )}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 lg:p-1 text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search — full width on mobile */}
        <div className="border-b border-black/8 px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm..."
              className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
            />
          </div>
        </div>

        {/* Result count strip — shown above the list when there are many
            items. Tells the user "yes, all 11 are loaded, just scroll" so
            they don't think items are missing when in fact they're below
            the fold. */}
        {filtered.length > 6 && (
          <div className="border-b border-black/8 bg-violet-50/40 px-4 py-1.5 text-[11px] text-violet-700">
            <span className="font-bold">{filtered.length}</span>
            {search.trim() ? ` kết quả` : ` ${label.toLowerCase()}`}
            <span className="ml-1 text-gray-500">· cuộn để xem tất cả ↓</span>
          </div>
        )}

        {/* Item list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <span className="text-sm text-gray-400">
                {search ? 'Không tìm thấy kết quả' : 'Chưa có mục nào trong PROJECT này.'}
              </span>
              <span className="text-xs text-gray-300">
                {search ? 'Thử tìm kiếm khác' : 'Thêm mục mới bên dưới để bắt đầu.'}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((item) => (
                <BankItemCard
                  key={item.id}
                  bankType={bankType}
                  item={item}
                  onClick={() => handleSelect(item)}
                />
              ))}
              {/* Footer marker — explicit "end of list" so user knows they
                  reached the bottom and nothing else is hidden. */}
              {filtered.length > 6 && (
                <div className="py-2 text-center text-[10px] text-gray-300">
                  — hết {filtered.length} mục —
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — quick add + manage in finder. Compact layout (buttons
            on same row) so it doesn't eat into list space. */}
        <div className="border-t border-black/8 px-4 py-2.5">
          {showQuickAdd ? (
            <div className="flex flex-col gap-2">
              <input
                value={quickAddName}
                onChange={(e) => setQuickAddName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAdd() }}
                placeholder="Nhập tên..."
                autoFocus
                className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-black/15"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleQuickAdd}
                  disabled={!quickAddName.trim()}
                  className="flex-1 rounded-lg bg-black/8 px-3 py-1.5 text-xs font-medium text-gray-800 transition-colors hover:bg-black/10 disabled:opacity-40"
                >
                  Tạo & Chọn
                </button>
                <button
                  onClick={() => { setShowQuickAdd(false); setQuickAddName('') }}
                  className="rounded-lg px-3 py-1.5 text-xs text-gray-500 transition-colors hover:text-gray-700"
                >
                  Hủy
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowQuickAdd(true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-dashed border-black/10 py-1.5 text-xs text-gray-500 transition-colors hover:border-black/15 hover:text-gray-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm mới
              </button>
              <button
                onClick={handleManageInFinder}
                className="flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600"
                title="Quản lý trong Trình Duyệt"
              >
                <FolderOpen className="h-3 w-3" />
                Quản lý
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
