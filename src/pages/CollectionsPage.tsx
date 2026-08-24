import {
  ArrowRight,
  FileText,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react"

const collections = [
  {
    name: "Machine Learning",
    description: "Research papers, notes, and learning materials.",
    documents: 8,
    updated: "2 hours ago",
  },
  {
    name: "KKN",
    description: "Guidelines, administration, and field documents.",
    documents: 5,
    updated: "Yesterday",
  },
  {
    name: "Final Project",
    description: "References and materials for the final project.",
    documents: 12,
    updated: "3 days ago",
  },
  {
    name: "Data Science",
    description: "Datasets, papers, and technical references.",
    documents: 6,
    updated: "5 days ago",
  },
]

export default function CollectionsPage() {
  return (
    <main className="relative min-w-0 flex-1 overflow-y-auto bg-[#18181b]">
      {/* Ambient lighting */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-180px] h-[500px] w-[760px] -translate-x-1/2 rounded-full bg-[#8E3A59]/[0.08] blur-[150px]" />
        <div className="absolute right-[-160px] top-[20%] h-[360px] w-[360px] rounded-full bg-[#5C1F45]/[0.05] blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1120px] px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[30px] font-medium tracking-[-0.02em] text-[#F2F2F2]">
              Collections
            </h1>

            <p className="mt-2 text-sm text-white/40">
              Organize documents into focused knowledge bases.
            </p>
          </div>

          <button className="flex items-center gap-2 rounded-xl bg-[#8E3A59] px-4 py-2.5 text-sm font-medium text-white shadow-[0_8px_24px_rgba(142,58,89,0.18)] transition hover:bg-[#9d4564]">
            <Plus size={17} />
            New Collection
          </button>
        </div>

        {/* Search */}
        <div className="mt-8 flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3">
          <Search
            size={17}
            strokeWidth={1.8}
            className="shrink-0 text-white/30"
          />

          <input
            type="text"
            placeholder="Search collections..."
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
          />
        </div>

        {/* Count */}
        <div className="mt-7">
          <span className="text-xs font-medium text-white/35">
            {collections.length} collections
          </span>
        </div>

        {/* Collection cards */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {collections.map((collection) => (
            <button
              key={collection.name}
              className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#8E3A59]/30 hover:bg-white/[0.035]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#8E3A59]/10">
                  <FolderOpen
                    size={20}
                    strokeWidth={1.7}
                    className="text-[#D34778]"
                  />
                </div>

                <MoreHorizontal
                  size={18}
                  className="text-white/25 transition group-hover:text-white/50"
                />
              </div>

              <div className="mt-5">
                <h2 className="text-[15px] font-medium text-white/90">
                  {collection.name}
                </h2>

                <p className="mt-2 min-h-[40px] text-xs leading-5 text-white/40">
                  {collection.description}
                </p>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4">
                <div className="flex items-center gap-2 text-xs text-white/35">
                  <FileText size={14} />
                  {collection.documents} documents
                </div>

                <div className="flex items-center gap-1 text-xs text-white/30">
                  Open
                  <ArrowRight size={13} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
