import {
  FileText,
  Grid2X2,
  List,
  MoreHorizontal,
  Search,
  Upload,
} from "lucide-react"

const documents = [
  {
    name: "Machine Learning.pdf",
    type: "PDF",
    size: "32 MB",
    pages: 124,
    updated: "2 hours ago",
  },
  {
    name: "Sistem Pakar.docx",
    type: "DOCX",
    size: "1.2 MB",
    pages: 42,
    updated: "Yesterday",
  },
  {
    name: "Data Mining.pdf",
    type: "PDF",
    size: "18 MB",
    pages: 87,
    updated: "2 days ago",
  },
  {
    name: "Metodologi Penelitian.pdf",
    type: "PDF",
    size: "8.4 MB",
    pages: 63,
    updated: "3 days ago",
  },
  {
    name: "KKN Pedoman.docx",
    type: "DOCX",
    size: "940 KB",
    pages: 28,
    updated: "5 days ago",
  },
  {
    name: "Artificial Intelligence.pdf",
    type: "PDF",
    size: "21 MB",
    pages: 156,
    updated: "1 week ago",
  },
]

export default function DocumentsPage() {
  return (
    <main className="relative min-w-0 flex-1 overflow-y-auto bg-[#18181b]">
      {/* Ambient lighting */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-180px] h-[500px] w-[760px] -translate-x-1/2 rounded-full bg-[#8E3A59]/[0.08] blur-[150px]" />
        <div className="absolute left-[25%] top-[20%] h-[300px] w-[420px] rounded-full bg-[#5C1F45]/[0.04] blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1120px] px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[30px] font-medium tracking-[-0.02em] text-[#F2F2F2]">
              Documents
            </h1>

            <p className="mt-2 text-sm text-white/40">
              Manage and explore your knowledge base.
            </p>
          </div>

          <button className="flex items-center gap-2 rounded-xl bg-[#8E3A59] px-4 py-2.5 text-sm font-medium text-white shadow-[0_8px_24px_rgba(142,58,89,0.18)] transition hover:bg-[#9d4564]">
            <Upload size={17} />
            Upload Document
          </button>
        </div>

        {/* Toolbar */}
        <div className="mt-8 flex items-center gap-3">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3">
            <Search
              size={17}
              strokeWidth={1.8}
              className="shrink-0 text-white/30"
            />

            <input
              type="text"
              placeholder="Search documents..."
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
            />
          </div>

          <button className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-sm text-white/55">
            All
          </button>

          <div className="flex items-center rounded-xl border border-white/[0.08] bg-white/[0.025] p-1">
            <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.07] text-white">
              <Grid2X2 size={15} />
            </button>

            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-white/35 transition hover:text-white/70">
              <List size={15} />
            </button>
          </div>
        </div>

        {/* Count */}
        <div className="mt-7">
          <span className="text-xs font-medium text-white/35">
            {documents.length} documents
          </span>
        </div>

        {/* Grid */}
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {documents.map((document) => (
            <button
              key={document.name}
              className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-white/[0.035]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.05]">
                  <FileText
                    size={20}
                    strokeWidth={1.7}
                    className={
                      document.type === "PDF"
                        ? "text-[#ff5964]"
                        : "text-[#5da7ff]"
                    }
                  />
                </div>

                <MoreHorizontal
                  size={18}
                  className="text-white/25 transition group-hover:text-white/50"
                />
              </div>

              <div className="mt-5">
                <div className="truncate text-sm font-medium text-white/85">
                  {document.name}
                </div>

                <div className="mt-2 text-xs text-white/35">
                  {document.type} · {document.size} · {document.pages} pages
                </div>

                <div className="mt-4 text-[11px] text-white/25">
                  Updated {document.updated}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}