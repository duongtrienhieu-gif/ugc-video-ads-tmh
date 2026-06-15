import { Package } from 'lucide-react'
import { useBankStore } from '../../../stores/bankStore'

// Chọn sản phẩm từ product bank. Bot dùng fact sản phẩm (tên/lợi ích/ảnh) từ đây;
// giá chat thì nhập riêng trong ConfigPanel (KHÔNG dùng field offer/Ladipage).
export default function ProductPicker({
  value, onChange,
}: {
  value: string | null
  onChange: (productId: string) => void
}) {
  const products = useBankStore((s) => s.products)

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-gray-700">Sản phẩm</label>
      <div className="relative">
        <Package className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg border border-black/10 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none transition-colors focus:border-emerald-400"
        >
          <option value="" disabled>— Chọn sản phẩm —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.productName || '(chưa đặt tên)'}</option>
          ))}
        </select>
      </div>
      {products.length === 0 && (
        <p className="mt-2 text-xs text-gray-400">
          Chưa có sản phẩm nào trong bank. Vào <span className="font-semibold">Sản phẩm</span> tạo trước nhé.
        </p>
      )}
    </div>
  )
}
