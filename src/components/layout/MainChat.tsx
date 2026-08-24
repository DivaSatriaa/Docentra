import {
  ArrowUp,
  ChevronDown,
  FileUp,
  Globe2,
  Search,
  Sparkles,
} from "lucide-react"

const prompts = [
  {
    icon: "✦",
    label: "Summarize",
    sublabel: "this document",
  },
  {
    icon: "◈",
    label: "Explain key",
    sublabel: "concepts",
  },
  {
    icon: "◌",
    label: "Compare",
    sublabel: "these files",
  },
  {
    icon: "✧",
    label: "Find important",
    sublabel: "data",
  },
]

const documents = [
  {
    name: "Machine Learning.pdf",
    size: "32 MB",
    type: "PDF",
    color: "text-[#ff5964]",
  },
  {
    name: "Sistem Pakar.docx",
    size: "1.2 MB",
    type: "DOCX",
    color: "text-[#5da7ff]",
  },
  {
    name: "Data Mining.pdf",
    size: "18 MB",
    type: "PDF",
    color: "text-[#ff5964]",
  },
]

export default function MainChat() {
  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[#222224]">
      {/* subtle ambient glow */}
      <div className="pointer-events-none absolute -right-24 top-20 h-72 w-72 rounded-full bg-[#8E3A59]/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-180px] right-[-100px] h-96 w-96 rounded-full bg-[#5C1F45]/10 blur-[150px]" />

      {/* Top bar */}
      <header className="relative z-10 flex h-[67px] shrink-0 items-center justify-between border-b border-white/[0.07] px-7">
        <button className="flex items-center gap-1.5 text-sm font-medium text-white/85">
          New Chat
          <ChevronDown size={14} className="text-white/45" />
        </button>

        <div className="flex items-center gap-5">
          <button className="text-white/45 transition hover:text-white">
            <Search size={18} />
          </button>

          <button className="flex h-8 w-8 items-center justify-center rounded-full border border-[#8E3A59]/50 bg-[#8E3A59]/10">
            <div className="h-3 w-3 rounded-full bg-[#D34778] shadow-[0_0_12px_rgba(211,71,120,0.7)]" />
          </button>
        </div>
      </header>

      {/* Main */}
      <div className="relative z-10 flex flex-1 justify-center overflow-y-auto px-8">
        <div className="w-full max-w-[1040px] pb-10 pt-12">
          {/* Greeting */}
          <section className="text-center">
            <div className="mb-3 flex items-center justify-center gap-2">
              <Sparkles
                size={28}
                fill="currentColor"
                className="text-[#D34778]"
              />
              <h1 className="text-[38px] font-medium tracking-tight text-[#F2F2F2]">
                Hello, Divas.
              </h1>
            </div>

            <p className="text-[16px] text-white/55">
              Ask anything about your documents.
            </p>
          </section>

          {/* Composer */}
          <section className="mx-auto mt-7 max-w-[820px] rounded-2xl border border-white/[0.12] bg-[#2a282b]/85 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
            <textarea
              placeholder="Ask about your documents..."
              className="h-[74px] w-full resize-none bg-transparent px-3 pt-2 text-sm text-white outline-none placeholder:text-white/35"
            />

            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-white/55 transition hover:bg-white/[0.04] hover:text-white">
                  <FileUp size={14} />
                  Upload
                </button>

                <button className="flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-white/55 transition hover:bg-white/[0.04] hover:text-white">
                  <Globe2 size={14} />
                  Web Search
                </button>
              </div>

              <button className="flex h-9 w-11 items-center justify-center rounded-lg bg-[#8E3A59] text-white shadow-[0_6px_18px_rgba(142,58,89,0.25)] transition hover:bg-[#9f4668]">
                <ArrowUp size={18} />
              </button>
            </div>
          </section>

          {/* Suggested prompts */}
          <section className="mx-auto mt-7 max-w-[820px]">
            <h2 className="mb-3 text-[14px] font-medium text-white/70">
              Suggested Prompts
            </h2>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {prompts.map((prompt) => (
                <button
                  key={prompt.label}
                  className="flex min-h-[72px] items-center gap-3 rounded-xl border border-white/[0.09] bg-white/[0.02] px-4 text-left transition hover:border-[#8E3A59]/50 hover:bg-[#8E3A59]/[0.06]"
                >
                  <span className="text-lg text-[#D34778]">{prompt.icon}</span>

                  <span>
                    <span className="block text-[12px] font-medium text-white/80">
                      {prompt.label}
                    </span>
                    <span className="block text-[12px] text-white/55">
                      {prompt.sublabel}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Recent documents */}
          <section className="mx-auto mt-7 max-w-[820px]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-medium text-white/70">
                Recent Documents
              </h2>

              <button className="text-xs text-white/35 hover:text-white/65">
                View all
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {documents.map((document) => (
                <button
                  key={document.name}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.09] bg-white/[0.02] p-4 text-left transition hover:border-white/[0.16] hover:bg-white/[0.04]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
                    <FileUp size={18} className={document.color} />
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-medium text-white/85">
                      {document.name}
                    </div>
                    <div className="mt-1 text-[11px] text-white/35">
                      {document.size} · {document.type}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}