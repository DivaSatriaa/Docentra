import { MessageSquare, Plus, SearchX, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

import Button from "../components/ui/Button"
import {
  EmptyState,
  PageContainer,
  PageHeader,
  SearchField,
} from "../components/ui/Page"
import {
  conversationTitle,
  formatRelativeTime,
  groupByDate,
  type Conversation,
} from "../lib/api"

export default function HistoryPage({
  conversations,
  isLoading,
  error,
  onOpen,
  onDelete,
  onNewChat,
}: {
  conversations: Conversation[]
  isLoading: boolean
  error: string
  onOpen: (id: string) => void
  onDelete: (conversation: Conversation) => void
  onNewChat: () => void
}) {
  const [query, setQuery] = useState("")

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    return groupByDate(
      q
        ? conversations.filter((c) => conversationTitle(c).toLowerCase().includes(q))
        : conversations,
    )
  }, [conversations, query])

  return (
    <PageContainer width="max-w-[880px]">
      <PageHeader
        title="History"
        description="Pick up any previous conversation where you left off."
        actions={
          <Button variant="primary" onClick={onNewChat}>
            <Plus size={16} strokeWidth={2.2} />
            New Chat
          </Button>
        }
      />

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search conversations..."
        className="mt-7"
      />

      <div className="mt-7">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[60px] animate-pulse rounded-xl bg-white/[0.03]" />
            ))}
          </div>
        ) : error ? (
          <p className="rounded-xl border border-red-400/15 bg-red-500/[0.05] px-4 py-3 text-[13px] text-red-200/80">
            {error}
          </p>
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={<MessageSquare size={20} />}
            title="No conversations yet"
            description="Your chats will appear here so you can come back to them any time."
            action={
              <Button variant="primary" onClick={onNewChat}>
                <Plus size={16} />
                Start a chat
              </Button>
            }
          />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<SearchX size={20} />}
            title="No matching conversations"
            description={`Nothing matches “${query}”. Try a different word.`}
          />
        ) : (
          <div className="space-y-7">
            <p className="text-[12px] text-white/35">
              {conversations.length} conversation{conversations.length === 1 ? "" : "s"}
            </p>
            {groups.map((group) => (
              <section key={group.label}>
                <h2 className="mb-2 text-[12px] font-medium text-white/40">{group.label}</h2>
                <ul className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.015]">
                  {group.items.map((conversation) => (
                    <li
                      key={conversation.id}
                      className="group flex items-center border-b border-white/[0.05] transition last:border-0 hover:bg-white/[0.035]"
                    >
                      <button
                        type="button"
                        onClick={() => onOpen(conversation.id)}
                        className="flex min-w-0 flex-1 items-center gap-3.5 px-4 py-3.5 text-left"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/[0.12] text-brand-300">
                          <MessageSquare size={16} strokeWidth={1.8} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium text-white/90">
                            {conversationTitle(conversation)}
                          </span>
                          <span className="mt-0.5 block text-[11.5px] text-white/35">
                            Updated {formatRelativeTime(conversation.updated_at)}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(conversation)}
                        aria-label={`Delete ${conversationTitle(conversation)}`}
                        title="Delete chat"
                        className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/30 opacity-100 transition hover:bg-red-400/10 hover:text-red-300 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                      >
                        <Trash2 size={15} strokeWidth={1.8} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  )
}
