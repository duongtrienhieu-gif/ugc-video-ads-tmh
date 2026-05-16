// ── StoryboardEditor — review & edit 9 scene blueprints in Vietnamese ───────
// User sees each scene as a card with Vietnamese labels for all fields.
// Can swap presets, edit emotion / pose / visibility per scene.
// Shows diversity report at top — if it fails, the AI re-generates.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { ArrowLeft, ArrowRight, RefreshCw, ChevronDown, AlertTriangle, CheckCircle2, Sparkles, Loader2 } from 'lucide-react'
import type { SceneBlueprint, DiversityReport } from '../types'
import { SCENE_PRESETS } from '../services/scenePresets'
import { blueprintFromPreset } from '../services/sceneBlueprint'

interface Props {
  blueprints: SceneBlueprint[]
  diversity: DiversityReport | null
  isGenerating: boolean
  onRegenerate: () => void
  onUpdateScene: (idx: number, patch: Partial<SceneBlueprint>) => void
  onBack: () => void
  onContinue: () => void
  /** Module 7 cost-control: skip QC retry per scene for cheaper queue */
  lowCostMode: boolean
  onLowCostModeChange: (v: boolean) => void
}

// ── Vietnamese label mapping ────────────────────────────────────────────────
const VI_LABELS = {
  sceneGoal: 'Mục tiêu cảnh',
  environment: 'Môi trường',
  composition: 'Khung hình',
  cameraAngle: 'Góc máy',
  shotType: 'Loại cảnh',
  pose: 'Tư thế',
  emotion: 'Cảm xúc',
  handUsage: 'Cách cầm sản phẩm',
  productVisibility: 'Mức hiện sản phẩm',
  backgroundType: 'Hậu cảnh',
  lightingStyle: 'Ánh sáng',
  motionIntent: 'Chuyển động',
  overlayDensity: 'Mật độ overlay',
  ctaFocus: 'Là cảnh CTA',
  speech: 'Lời thoại',
} as const

const VISIBILITY_VI: Record<SceneBlueprint['productVisibility'], string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
}

// ── Visibility badge color ──────────────────────────────────────────────────
function visibilityColor(v: SceneBlueprint['productVisibility']): string {
  if (v === 'high') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (v === 'medium') return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-gray-100 text-gray-500 border-gray-200'
}

// ── Narrative beat label + colour — for the storyboard scan-and-arc view ──
const SCENE_TYPE_VI: Partial<Record<NonNullable<SceneBlueprint['sceneType']>, string>> = {
  hook:            'HOOK',
  pain:            'PAIN',
  frustration:     'BỰC',
  failed_solution: 'FAIL',
  discovery:       'DISCO',
  explanation:     'EXPL',
  recovery:        'RECOV',
  lifestyle:       'LIFE',
  social_proof:    'PROOF',
  cta:             'CTA',
}

const SCENE_TYPE_BG: Partial<Record<NonNullable<SceneBlueprint['sceneType']>, string>> = {
  hook:            'bg-fuchsia-500',
  pain:            'bg-slate-700',
  frustration:     'bg-red-600',
  failed_solution: 'bg-orange-600',
  discovery:       'bg-cyan-500',
  explanation:     'bg-blue-500',
  recovery:        'bg-emerald-500',
  lifestyle:       'bg-teal-500',
  social_proof:    'bg-amber-500',
  cta:             'bg-pink-600',
}

// ── Single scene card ───────────────────────────────────────────────────────
function SceneCard({
  scene, idx, onUpdate,
}: {
  scene: SceneBlueprint
  idx: number
  onUpdate: (patch: Partial<SceneBlueprint>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [presetPickerOpen, setPresetPickerOpen] = useState(false)

  const currentPreset = scene.presetLabel ? SCENE_PRESETS.find((p) => p.labelEn === scene.presetLabel) : null

  const handleApplyPreset = (presetId: string) => {
    const fresh = blueprintFromPreset(presetId, scene.sceneId, scene.speech)
    // Keep speech + sceneId + ctaFocus from current scene
    onUpdate({
      ...fresh,
      sceneId: scene.sceneId,
      sceneNumber: scene.sceneId,
      ctaFocus: scene.ctaFocus,
      speech: scene.speech,
    })
    setPresetPickerOpen(false)
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-black/8 px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white">
          {scene.sceneId}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {scene.sceneType && SCENE_TYPE_VI[scene.sceneType] && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white ${SCENE_TYPE_BG[scene.sceneType] ?? 'bg-gray-500'}`}
                title={`Narrative beat: ${scene.sceneType}${scene.narrativePurpose ? ` — ${scene.narrativePurpose}` : ''}`}
              >
                {SCENE_TYPE_VI[scene.sceneType]}
              </span>
            )}
            <p className="truncate text-sm font-bold text-gray-900">{scene.sceneGoal}</p>
          </div>
          {scene.narrativePurpose && (
            <p className="mt-0.5 truncate text-[10px] italic text-violet-600">
              → {scene.narrativePurpose}
            </p>
          )}
          <p className="mt-0.5 text-[11px] text-gray-500 line-clamp-2">{scene.speech || '(chưa có lời thoại)'}</p>
        </div>
        {scene.ctaFocus && (
          <span className="rounded-md bg-pink-100 px-2 py-0.5 text-[10px] font-bold text-pink-700">CTA</span>
        )}
        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${visibilityColor(scene.productVisibility)}`}>
          SP: {VISIBILITY_VI[scene.productVisibility]}
        </span>
      </div>

      {/* Quick chips row */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-black/8 px-4 py-2 text-[10px]">
        <span className="rounded bg-black/[0.04] px-2 py-0.5 text-gray-600"><strong>{VI_LABELS.cameraAngle}:</strong> {scene.cameraAngle}</span>
        <span className="rounded bg-black/[0.04] px-2 py-0.5 text-gray-600"><strong>{VI_LABELS.composition}:</strong> {scene.composition}</span>
        <span className="rounded bg-black/[0.04] px-2 py-0.5 text-gray-600"><strong>{VI_LABELS.environment}:</strong> {scene.environment}</span>
        <span className="rounded bg-black/[0.04] px-2 py-0.5 text-gray-600"><strong>{VI_LABELS.emotion}:</strong> {scene.emotion}</span>
        {currentPreset && (
          <span
            className="ml-auto flex items-center gap-1 rounded bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700"
            title={`Preset auto-chọn: ${currentPreset.hintVi}${typeof scene.presetConfidence === 'number' ? ` · confidence ${scene.presetConfidence}%` : ''}`}
          >
            🎬 {currentPreset.labelVi}
            {typeof scene.presetConfidence === 'number' && (
              <span className={`ml-1 rounded px-1 py-px text-[9px] font-bold ${
                scene.presetConfidence >= 70 ? 'bg-emerald-500 text-white' :
                scene.presetConfidence >= 50 ? 'bg-amber-400 text-amber-900' :
                'bg-gray-300 text-gray-700'
              }`}>
                {scene.presetConfidence}%
              </span>
            )}
          </span>
        )}
      </div>

      {/* Toggle details */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2 text-left text-[11px] font-semibold text-violet-600 hover:bg-violet-50"
      >
        {expanded ? 'Thu gọn' : 'Chi tiết & chỉnh sửa'}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded editor */}
      {expanded && (
        <div className="space-y-2 border-t border-black/8 bg-black/[0.015] px-4 py-3 text-[11px]">
          {/* Preset switcher */}
          <div className="mb-2">
            <p className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Preset cảnh
              {currentPreset && typeof scene.presetConfidence === 'number' && (
                <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-violet-600">
                  AI auto-chọn · {scene.presetConfidence}% match
                </span>
              )}
            </p>
            <div className="relative">
              <button
                onClick={() => setPresetPickerOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-md border border-violet-200 bg-white px-2.5 py-1.5 text-left text-[11px] font-semibold text-violet-700"
              >
                <span className="flex items-center gap-1.5">
                  {currentPreset?.labelVi ?? 'Chọn preset...'}
                  {currentPreset && <span className="text-[9px] font-normal text-gray-400">— có thể đổi nếu muốn</span>}
                </span>
                <ChevronDown className={`h-3 w-3 transition-transform ${presetPickerOpen ? 'rotate-180' : ''}`} />
              </button>
              {presetPickerOpen && (
                <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-black/10 bg-white shadow-lg">
                  {SCENE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleApplyPreset(p.id)}
                      className={`flex w-full flex-col items-start gap-0.5 border-b border-black/5 px-2.5 py-2 text-left text-[11px] hover:bg-violet-50 ${currentPreset?.id === p.id ? 'bg-violet-50/60' : ''}`}
                    >
                      <span className="font-semibold text-gray-800">{p.labelVi}</span>
                      <span className="text-[10px] text-gray-500">{p.hintVi}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Editable fields */}
          <ReadonlyRow label={VI_LABELS.sceneGoal} value={scene.sceneGoal} />
          <ReadonlyRow label={VI_LABELS.pose} value={scene.pose} />
          <ReadonlyRow label={VI_LABELS.handUsage} value={scene.handUsage} />
          <ReadonlyRow label={VI_LABELS.shotType} value={scene.shotType} />
          <ReadonlyRow label={VI_LABELS.backgroundType} value={scene.backgroundType} />
          <ReadonlyRow label={VI_LABELS.lightingStyle} value={scene.lightingStyle} />
          <ReadonlyRow label={VI_LABELS.motionIntent} value={scene.motionIntent} />

          {/* Dropdowns: visibility + overlay */}
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{VI_LABELS.productVisibility}</span>
              <select
                value={scene.productVisibility}
                onChange={(e) => onUpdate({ productVisibility: e.target.value as SceneBlueprint['productVisibility'] })}
                className="rounded-md border border-black/10 bg-white px-2 py-1 text-[11px]"
              >
                <option value="low">Thấp</option>
                <option value="medium">Trung bình</option>
                <option value="high">Cao</option>
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{VI_LABELS.overlayDensity}</span>
              <select
                value={scene.overlayDensity}
                onChange={(e) => onUpdate({ overlayDensity: e.target.value as SceneBlueprint['overlayDensity'] })}
                className="rounded-md border border-black/10 bg-white px-2 py-1 text-[11px]"
              >
                <option value="none">Không</option>
                <option value="low">Ít</option>
                <option value="medium">Vừa</option>
                <option value="high">Nhiều</option>
              </select>
            </label>
          </div>

          {/* CTA toggle */}
          <label className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              checked={scene.ctaFocus}
              onChange={(e) => onUpdate({ ctaFocus: e.target.checked })}
              className="h-3.5 w-3.5"
            />
            <span className="text-[11px] text-gray-700">{VI_LABELS.ctaFocus} — đây là cảnh chốt CTA</span>
          </label>

          {/* Speech editor */}
          <label className="flex flex-col gap-0.5 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{VI_LABELS.speech}</span>
            <textarea
              value={scene.speech}
              onChange={(e) => onUpdate({ speech: e.target.value })}
              rows={2}
              className="resize-none rounded-md border border-black/10 bg-white px-2 py-1 text-[11px]"
              placeholder="1-2 dòng lời thoại từ kịch bản..."
            />
          </label>
        </div>
      )}
      {idx === 0 && null}
    </div>
  )
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 border-b border-black/5 py-1 last:border-b-0">
      <span className="w-28 shrink-0 text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
      <span className="flex-1 text-[11px] leading-relaxed text-gray-700">{value}</span>
    </div>
  )
}

// ── Diversity report panel ──────────────────────────────────────────────────
function DiversityPanel({ report }: { report: DiversityReport }) {
  const passed = report.passed
  return (
    <div className={`rounded-xl border p-3 ${passed ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
      <div className="mb-2 flex items-center gap-2">
        {passed ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        )}
        <h3 className="text-sm font-bold text-gray-900">
          {passed ? '✓ Storyboard đa dạng tốt' : '⚠ Cảnh báo độ đa dạng'}
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
        <div className="rounded bg-white px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-widest text-gray-500">Composition unique</p>
          <p className="text-sm font-bold text-gray-900">{report.uniqueCompositions}/{report.totalScenes}</p>
        </div>
        <div className="rounded bg-white px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-widest text-gray-500">Góc máy unique</p>
          <p className="text-sm font-bold text-gray-900">{report.uniqueCameraAngles}/{report.totalScenes}</p>
        </div>
        <div className="rounded bg-white px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-widest text-gray-500">Pose unique</p>
          <p className="text-sm font-bold text-gray-900">{report.uniquePoses}/{report.totalScenes}</p>
        </div>
        <div className="rounded bg-white px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-widest text-gray-500">SP hiện cao (≥70%)</p>
          <p className={`text-sm font-bold ${report.highVisibilityCount / report.totalScenes >= 0.7 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {report.highVisibilityCount}/{report.totalScenes}
          </p>
        </div>
      </div>
      {report.notes.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[11px] text-amber-700">
          {report.notes.map((n, i) => <li key={i}>• {n}</li>)}
        </ul>
      )}
    </div>
  )
}

// ── Main editor ─────────────────────────────────────────────────────────────
export default function StoryboardEditor({
  blueprints, diversity, isGenerating, onRegenerate, onUpdateScene, onBack, onContinue,
  lowCostMode, onLowCostModeChange,
}: Props) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-violet-50 to-pink-50 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white shadow-md">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Bước 2: Storyboard JSON</h2>
              <p className="text-xs text-gray-500">9 cảnh dạng structured blueprint — không còn giant prompts. Mỗi cảnh có thể edit hoặc đổi preset.</p>
            </div>
          </div>
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Gen lại storyboard
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {isGenerating && blueprints.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
            <p className="text-sm font-semibold text-gray-700">Đang lên storyboard JSON...</p>
            <p className="max-w-md text-xs text-gray-500">
              Gemini đang phân tích kịch bản + chọn preset cảnh phù hợp cho 9 shot — đa dạng góc máy, đảm bảo ≥70% có sản phẩm hiện rõ.
            </p>
          </div>
        ) : blueprints.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-gray-500">Chưa có storyboard. Nhấn "Gen lại storyboard" để bắt đầu.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {diversity && <DiversityPanel report={diversity} />}
            {blueprints.map((sc, i) => (
              <SceneCard
                key={sc.sceneId}
                scene={sc}
                idx={i}
                onUpdate={(patch) => onUpdateScene(i, patch)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-black/8 bg-white px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-black/[0.04]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Quay lại Master Frame
          </button>
          <div className="flex items-center gap-2">
            {/* Cost-control toggle */}
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50/60 px-2 py-1.5 text-[10px] font-semibold text-amber-700">
              <input
                type="checkbox"
                checked={lowCostMode}
                onChange={(e) => onLowCostModeChange(e.target.checked)}
                className="h-3 w-3 accent-amber-600"
              />
              Low-cost mode (bỏ QC retry)
            </label>
            <button
              onClick={onContinue}
              disabled={blueprints.length === 0 || isGenerating}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-500 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:from-violet-700 hover:to-purple-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Tiếp theo: Gen B-Roll <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
