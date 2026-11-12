import { Loader2, Upload } from "lucide-react"
import { useRef, useState } from "react"

import {
  ACCEPTED_FILE_TYPES,
  uploadDocument,
  waitForProcessing,
} from "../../lib/documents"

interface UploadButtonProps {
  /** Called once the uploaded document is processed and searchable. */
  onReady: (documentId: string) => void
  disabled?: boolean
}

type Phase =
  | { name: "idle" }
  | { name: "uploading" }
  | { name: "processing" }
  | { name: "error"; message: string }

/** Upload a document straight from the chat composer. */
export default function UploadButton({
  onReady,
  disabled = false,
}: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>({ name: "idle" })

  const busy = phase.name === "uploading" || phase.name === "processing"

  async function handleFile(file: File) {
    setPhase({ name: "uploading" })

    try {
      const created = await uploadDocument(file)
      setPhase({ name: "processing" })

      const processed = await waitForProcessing(created.id)

      if (processed?.processing_status.toLowerCase() === "ready") {
        onReady(processed.id)
        setPhase({ name: "idle" })
        return
      }

      setPhase({
        name: "error",
        message:
          processed?.processing_error ||
          "The document could not be processed.",
      })
    } catch (uploadError) {
      setPhase({
        name: "error",
        message:
          uploadError instanceof Error
            ? uploadError.message
            : "Unable to upload document.",
      })
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) void handleFile(file)
        }}
      />

      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => {
          setPhase({ name: "idle" })
          inputRef.current?.click()
        }}
        className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] text-white/55 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
      >
        {busy ? (
          <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
        ) : (
          <Upload size={14} strokeWidth={1.8} />
        )}
        {phase.name === "uploading"
          ? "Uploading..."
          : phase.name === "processing"
            ? "Processing..."
            : "Upload"}
      </button>

      {phase.name === "error" && (
        <div
          role="alert"
          className="absolute bottom-full left-0 z-30 mb-2 w-[280px] rounded-lg border border-red-400/15 bg-ink-850 px-3 py-2 text-[11px] leading-4 text-red-200/80 shadow-xl shadow-black/40"
        >
          {phase.message}
        </div>
      )}
    </div>
  )
}
