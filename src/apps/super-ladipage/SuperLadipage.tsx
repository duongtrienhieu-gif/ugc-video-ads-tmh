import { Rocket, Construction } from 'lucide-react'

// Super Ladipage — Phase 1 placeholder.
// Phase 2 sẽ port UI từ Landing Page AI sang đây.
// Phase 3 sẽ rebuild services (prompts + image gen) từ đầu.

export default function SuperLadipage() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#FAFAFA]">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 shadow-lg">
          <Rocket className="h-8 w-8 text-white" strokeWidth={2} />
        </div>

        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          Super Ladipage
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          Phiên bản nâng cấp của Landing Page AI — system prompt và pipeline tạo ảnh được build lại từ đầu để hết xung đột.
        </p>

        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-700">
          <Construction className="h-3.5 w-3.5" />
          Đang build · Phase 1/4 — Skeleton
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 text-left">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-emerald-600">Phase 1 · Hôm nay</div>
            <div className="text-sm font-semibold text-gray-900">Skeleton + Routing</div>
            <div className="mt-1 text-xs text-gray-500">Module đã được đăng ký vào app, sidebar có lối vào.</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 opacity-60">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Phase 2 · Sắp tới</div>
            <div className="text-sm font-semibold text-gray-900">Port UI</div>
            <div className="mt-1 text-xs text-gray-500">Wizard input + editor output giống Landing Page AI.</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 opacity-60">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Phase 3</div>
            <div className="text-sm font-semibold text-gray-900">Rebuild services</div>
            <div className="mt-1 text-xs text-gray-500">Prompts 3-layer sạch + KIE/FAL fallback.</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 opacity-60">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Phase 4</div>
            <div className="text-sm font-semibold text-gray-900">Wire + polish</div>
            <div className="mt-1 text-xs text-gray-500">Auto-save, multi-pack, error UI.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
