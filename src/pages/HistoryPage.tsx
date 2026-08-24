import {
  Clock3,
  FileText,
  MessageSquare,
  MoreHorizontal,
  Search,
} from "lucide-react"

const history = [
  {
    date: "Today",
    conversations: [
      {
        title: "Explain machine learning concepts",
        preview:
          "Can you explain the difference between supervised and unsupervised learning?",
        documents: 2,
        messages: 8,
        time: "10:42 AM",
      },
      {
        title: "Summarize research paper",
        preview:
          "What are the key findings and limitations discussed in this paper?",
        documents: 1,
        messages: 5,
        time: "09:18 AM",
      },
    ],
  },
  {
    date: "Yesterday",
    conversations: [
      {
        title: "KKN guideline discussion",
        preview:
          "What documents are required before the KKN registration process?",
        documents: 3,
        messages: 11,
        time: "4:36 PM",
      },
      {
        title: "Compare two documents",
        preview:
          "Compare the methodology used in these two research documents.",
        documents: 2,
        messages: 7,
        time: "2:12 PM",
      },
    ],
  },
  {
    date: "Previous 7 days",
    conversations: [
      {
        title: "Data mining notes",
        preview:
          "Give me a concise explanation of association rule mining.",
        documents: 1,
        messages: 6,
        time: "Aug 20",
      },
      {
        title: "Final project references",
        preview:
          "Find the most relevant sections for my final project topic.",
        documents: 4,
        messages: 14,
        time: "Aug 19",
      },
    ],
  },
]

export default function HistoryPage() {
  return (
    <main className="relative min-w-0 flex-1 overflow-y-auto bg-[#18181b]">
      {/* Ambient lighting */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-180px] h-[500px] w-[760px] -translate-x-1/2 rounded-full bg-[#8E3A59]/[0.08] blur-[150px]" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[380px] w-[380px] rounded-full bg-[#5C1F45]/[0.05] blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1120px] px-8 py-8">
        {/* Header */}
        <div>
          <h1 className="text-[30px] font-medium tracking-[-0.02em] text-[#F2F2F2]">
            History
          </h1>

          <p className="mt-2 text-sm text-white/40">
            Continue your previous conversations.
          </p>
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
            placeholder="Search conversations..."
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
          />
        </div>

        {/* History groups */}
        <div className="mt-8 space-y-9">
          {history.map((group) => (
            <section key={group.date}>
              <div className="mb-3 flex items-center gap-2">
                <Clock3
                  size={14}
                  strokeWidth={1.8}
                  className="text-white/25"
                />

                <h2 className="text-xs font-medium text-white/40">
                  {group.date}
                </h2>
              </div>

              <div className="space-y-3">
                {group.conversations.map((conversation) => (
                  <button
                    key={conversation.title}
                    className="group flex w-full items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 text-left transition duration-200 hover:border-white/[0.14] hover:bg-white/[0.035]"
                  >
                    {/* Icon */}
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#8E3A59]/10">
                      <MessageSquare
                        size={20}
                        strokeWidth={1.7}
                        className="text-[#D34778]"
                      />
                    </div>

                    {/* Main content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-medium text-white/90">
                          {conversation.title}
                        </h3>
                      </div>

                      <p className="mt-1 truncate text-xs text-white/35">
                        {conversation.preview}
                      </p>

                      <div className="mt-3 flex items-center gap-4 text-[11px] text-white/25">
                        <span className="flex items-center gap-1.5">
                          <FileText size={12} />
                          {conversation.documents} documents
                        </span>

                        <span>
                          {conversation.messages} messages
                        </span>

                        <span>{conversation.time}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="shrink-0">
                      <MoreHorizontal
                        size={18}
                        className="text-white/20 transition group-hover:text-white/45"
                      />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
