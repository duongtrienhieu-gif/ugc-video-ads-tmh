import { useState } from 'react'
import { FlaskConical, Eye, EyeOff, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage({ type: 'success', text: 'Đăng ký thành công! Kiểm tra email để xác nhận tài khoản.' })
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        if (error) throw error
        setMessage({ type: 'success', text: 'Đã gửi link đặt lại mật khẩu. Kiểm tra email của bạn.' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Đã xảy ra lỗi'
      if (msg.includes('Invalid login credentials')) setMessage({ type: 'error', text: 'Email hoặc mật khẩu không đúng.' })
      else if (msg.includes('Email not confirmed')) setMessage({ type: 'error', text: 'Vui lòng xác nhận email trước khi đăng nhập.' })
      else if (msg.includes('User already registered')) setMessage({ type: 'error', text: 'Email này đã được đăng ký.' })
      else if (msg.includes('Password should be')) setMessage({ type: 'error', text: 'Mật khẩu phải có ít nhất 6 ký tự.' })
      else setMessage({ type: 'error', text: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#EEEEF2]">
      <div className="w-full max-w-sm rounded-2xl border border-black/8 bg-white p-8 shadow-xl">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.06]">
            <FlaskConical className="h-6 w-6 text-gray-700" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-semibold tracking-tight text-gray-900">UGC AI Video Ads</h1>
            <p className="text-sm text-gray-500">TMH GROUP</p>
          </div>
        </div>

        {/* Title */}
        <h2 className="mb-6 text-center text-base font-semibold text-gray-800">
          {mode === 'login' ? 'Đăng nhập' : mode === 'register' ? 'Tạo tài khoản' : 'Quên mật khẩu'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ten@congty.com"
              required
              className="rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-black/20 focus:bg-white"
            />
          </div>

          {/* Password */}
          {mode !== 'forgot' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Mật khẩu</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  required
                  className="w-full rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2.5 pr-10 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-black/20 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Message */}
          {message && (
            <div className={`rounded-lg px-3 py-2.5 text-xs font-medium ${
              message.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-600 border border-red-500/20'
            }`}>
              {message.text}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'login' ? 'Đăng nhập' : mode === 'register' ? 'Tạo tài khoản' : 'Gửi link đặt lại'}
          </button>
        </form>

        {/* Mode switcher */}
        <div className="mt-5 flex flex-col gap-2 text-center text-xs text-gray-500">
          {mode === 'login' && (
            <>
              <button onClick={() => { setMode('register'); setMessage(null) }} className="hover:text-gray-800 transition-colors">
                Chưa có tài khoản? <span className="font-medium text-gray-700">Đăng ký</span>
              </button>
              <button onClick={() => { setMode('forgot'); setMessage(null) }} className="hover:text-gray-800 transition-colors">
                Quên mật khẩu?
              </button>
            </>
          )}
          {mode !== 'login' && (
            <button onClick={() => { setMode('login'); setMessage(null) }} className="hover:text-gray-800 transition-colors">
              ← Quay lại đăng nhập
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
