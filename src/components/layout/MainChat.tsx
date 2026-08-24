import {
  ArrowUp,
  ChevronDown,
  FileText,
  Globe2,
  Search,
  Sparkles,
  Upload,
} from "lucide-react"

const prompts = [
  {
    icon: "✦",
    title: "Summarize",
    subtitle: "this document",
  },
  {
    icon: "◇",
    title: "Explain key",
    subtitle: "concepts",
  },
  {
    icon: "◌",
    title: "Compare",
    subtitle: "these files",
  },
  {
    icon: "✧",
    title: "Find important",
    subtitle: "data",
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
    <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[#18181b]">
    {/* Ambient lighting */}
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Main top-center light */}
        <div className="absolute left-1/2 top-[-180px] h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-[#8E3A59]/[0.13] blur-[150px]" />

        {/* Subtle inner light */}
        <div className="absolute left-1/2 top-[-40px] h-[260px] w-[520px] -translate-x-1/2 rounded-full bg-[#F2F2F2]/[0.025] blur-[110px]" />

        {/* Faint lower purple atmosphere */}
        <div className="absolute bottom-[-260px] left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-[#5C1F45]/[0.06] blur-[170px]" />

        {/* Very subtle side atmosphere */}
        <div className="absolute right-[-220px] top-[25%] h-[420px] w-[420px] rounded-full bg-[#8E3A59]/[0.035] blur-[150px]" />
        </div>
      {/* Top bar */}
      <header className="relative z-10 flex h-[68px] shrink-0 items-center justify-between border-b border-white/[0.07] px-8">
        <button className="flex items-center gap-1.5 text-[14px] font-medium text-white/85 transition hover:text-white">
          New Chat
          <ChevronDown
            size={14}
            strokeWidth={1.8}
            className="text-white/45"
          />
        </button>

        <div className="flex items-center gap-5">
          <button
            aria-label="Search"
            className="text-white/40 transition hover:text-white/80"
          >
            <Search size={19} strokeWidth={1.8} />
          </button>

          <button
            aria-label="Profile"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#8E3A59]/50 bg-[#8E3A59]/10 shadow-[0_0_18px_rgba(142,58,89,0.12)]"
          >
            <span className="h-3.5 w-3.5 rounded-full bg-[#D34778] shadow-[0_0_12px_rgba(211,71,120,0.75)]" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="relative z-10 flex flex-1 justify-center overflow-y-auto px-8">
        <div className="w-full max-w-[1080px] pb-12 pt-8">
          {/* Greeting */}
          <section className="text-center">
            <div className="mb-2 flex items-center justify-center gap-2.5">
              <Sparkles
                size={29}
                strokeWidth={1.7}
                fill="currentColor"
                className="text-[#D34778]"
              />

              <h1 className="text-[42px] font-medium tracking-[-0.03em] text-[#F2F2F2]">
                Hello, Divas.
              </h1>
            </div>

            <p className="text-[15px] text-white/50">
              Ask anything about your documents.
            </p>
          </section>

          {/* Composer */}
          <section className="mx-auto mt-7 w-full max-w-[920px] rounded-[20px] border border-white/[0.12] bg-[#2a282b]/90 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-sm">
            <textarea
              placeholder="Ask about your documents..."
              className="h-[88px] w-full resize-none bg-transparent px-4 pt-2 text-[14px] text-white outline-none placeholder:text-white/35"
            />

            <div className="flex items-center justify-between px-1 pb-1">
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 rounded-lg border border-white/[0.09] px-3.5 py-2 text-[12px] text-white/55 transition hover:bg-white/[0.04] hover:text-white">
                  <Upload size={14} strokeWidth={1.8} />
                  Upload
                </button>

                <button className="flex items-center gap-2 rounded-lg border border-white/[0.09] px-3.5 py-2 text-[12px] text-white/55 transition hover:bg-white/[0.04] hover:text-white">
                  <Globe2 size={14} strokeWidth={1.8} />
                  Web Search
                </button>
              </div>

              <button
                aria-label="Send"
                className="flex h-10 w-11 items-center justify-center rounded-lg bg-[#8E3A59] text-white shadow-[0_7px_20px_rgba(142,58,89,0.28)] transition hover:bg-[#9f4668]"
              >
                <ArrowUp size={18} strokeWidth={2} />
              </button>
            </div>
          </section>

          {/* Suggested prompts */}
          <section className="mx-auto mt-7 w-full max-w-[920px]">
            <h2 className="mb-3 text-[14px] font-medium text-white/70">
              Suggested Prompts
            </h2>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {prompts.map((prompt) => (
                <button
                  key={prompt.title}
                  className="group flex min-h-[78px] items-center gap-3 rounded-xl border border-white/[0.09] bg-white/[0.018] px-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#8E3A59]/50 hover:bg-[#8E3A59]/[0.06]"
                >
                  <span className="w-5 shrink-0 text-center text-[18px] text-[#D34778] transition group-hover:scale-110">
                    {prompt.icon}
                  </span>

                  <span>
                    <span className="block text-[12px] font-medium text-white/85">
                      {prompt.title}
                    </span>

                    <span className="block text-[12px] text-white/55">
                      {prompt.subtitle}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Recent documents */}
          <section className="mx-auto mt-7 w-full max-w-[920px]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-medium text-white/70">
                Recent Documents
              </h2>

              <button className="text-[12px] text-white/30 transition hover:text-white/60">
                View all
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {documents.map((document) => (
                <button
                  key={document.name}
                  className="group flex items-center gap-3 rounded-xl border border-white/[0.09] bg-white/[0.018] p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-white/[0.04]"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
                    <FileText
                      size={19}
                      strokeWidth={1.7}
                      className={document.color}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-white/85">
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