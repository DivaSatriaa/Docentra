import { CheckCircle2, AlertCircle } from "lucide-react"
import { createContext, useCallback, useContext, useState, type ReactNode } from "react"

type Toast = { id: number; message: string; tone: "success" | "error" }

const ToastContext = createContext<(message: string, tone?: Toast["tone"]) => void>(
  () => {},
)

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current.slice(-2), { id, message, tone }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 2600)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex animate-pop-in items-center gap-2 rounded-xl border border-white/[0.09] bg-ink-800/95 px-3.5 py-2.5 text-[12.5px] text-white/85 shadow-xl shadow-black/40 backdrop-blur"
          >
            {toast.tone === "success" ? (
              <CheckCircle2 size={15} className="text-emerald-300/90" />
            ) : (
              <AlertCircle size={15} className="text-red-300" />
            )}
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
