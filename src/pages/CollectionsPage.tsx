import { FileText, FolderOpen, Plus, Sparkles } from "lucide-react"
import { useState } from "react"

import Button from "../components/ui/Button"
import { PageContainer, PageHeader, SearchField } from "../components/ui/Page"

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
  const [query, setQuery] = useState("")
  const visible = collections.filter((c) =>
    `${c.name} ${c.description}`.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <PageContainer>
      <PageHeader
        title="Collections"
        description="Group documents into focused knowledge bases."
        actions={
          <Button variant="primary" disabled title="Coming soon">
            <Plus size={16} strokeWidth={2.2} />
            New Collection
          </Button>
        }
      />

      <div className="mt-6 flex items-start gap-3 rounded-xl border border-brand-500/25 bg-brand-500/[0.06] px-4 py-3 text-[13px] leading-6 text-white/65">
        <Sparkles size={16} className="mt-1 shrink-0 text-brand-300" />
        <p>
          <span className="font-medium text-white/90">Collections are in preview.</span>{" "}
          The cards below are examples of how they will look. Until then, pick documents
          per question with the document picker in the chat box.
        </p>
      </div>

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search collections..."
        className="mt-6"
      />

      <p className="mt-6 text-[12px] text-white/35">
        {visible.length} collection{visible.length === 1 ? "" : "s"}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {visible.map((collection) => (
          <div
            key={collection.name}
            className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 transition duration-200 hover:border-brand-500/35 hover:bg-white/[0.035]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/[0.12] text-brand-300">
                <FolderOpen size={19} strokeWidth={1.7} />
              </div>
              <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-white/35">
                Example
              </span>
            </div>

            <h2 className="mt-4 font-display text-[15px] font-medium text-white/90">
              {collection.name}
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-5 text-white/45">
              {collection.description}
            </p>

            <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-3.5 text-[12px] text-white/35">
              <span className="flex items-center gap-1.5">
                <FileText size={13} />
                {collection.documents} documents
              </span>
              <span>Updated {collection.updated.toLowerCase()}</span>
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  )
}
