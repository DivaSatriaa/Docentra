import {
  ArrowUp,
  FileText,
  Globe2,
  Sparkles,
  Upload,
} from "lucide-react"
import { useState } from "react"

import FileTypeIcon from "../common/FileTypeIcon"

const prompts = [
  {
    label: "Summarize",
    subtitle: "this document",
  },
  {
    label: "Explain key",
    subtitle: "concepts",
  },
  {
    label: "Compare",
    subtitle: "these files",
  },
  {
    label: "Find important",
    subtitle: "data",
  },
]

const documents = [
  {
    name: "Machine Learning.pdf",
    size: "32 MB",
    type: "pdf",
  },
  {
    name: "Sistem Pakar.docx",
    size: "1.2 MB",
    type: "docx",
  },
  {
    name: "Data Mining.pdf",
    size: "18 MB",
    type: "pdf",
  },
]

type Message = {
  id: number
  role: "user" | "assistant"
  content: string
}

export default function MainChat() {
  const [question, setQuestion] = useState("")
  const [messages, setMessages] = useState<Message[]>([])

  const hasConversation = messages.length > 0

  function sendMessage() {
    const trimmedQuestion = question.trim()

    if (!trimmedQuestion) {
      return
    }

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: trimmedQuestion,
    }

    const assistantMessage: Message = {
      id: Date.now() + 1,
      role: "assistant",
      content:
        "I'm ready to answer this once the Docentra AI service is connected.",
    }

    setMessages((current) => [
      ...current,
      userMessage,
      assistantMessage,
    ])

    setQuestion("")
  }

  function handlePromptClick(prompt: (typeof prompts)[number]) {
    setQuestion(`${prompt.label} ${prompt.subtitle}`)
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[#18181b]">
      {/* Ambient lighting */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-180px] h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-[#8E3A59]/[0.10] blur-[150px]" />

        <div className="absolute left-1/2 top-[-40px] h-[260px] w-[520px] -translate-x-1/2 rounded-full bg-[#F2F2F2]/[0.02] blur-[110px]" />

        <div className="absolute bottom-[-260px] left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-[#5C1F45]/[0.055] blur-[170px]" />

        <div className="absolute right-[-220px] top-[25%] h-[420px] w-[420px] rounded-full bg-[#8E3A59]/[0.03] blur-[150px]" />
      </div>

      {hasConversation ? (
        <ConversationView
          messages={messages}
          question={question}
          setQuestion={setQuestion}
          sendMessage={sendMessage}
          handleKeyDown={handleKeyDown}
        />
      ) : (
        <WelcomeView
          question={question}
          setQuestion={setQuestion}
          sendMessage={sendMessage}
          handleKeyDown={handleKeyDown}
          handlePromptClick={handlePromptClick}
        />
      )}
    </main>
  )
}

function WelcomeView({
  question,
  setQuestion,
  sendMessage,
  handleKeyDown,
  handlePromptClick,
}: {
  question: string
  setQuestion: (value: string) => void
  sendMessage: () => void
  handleKeyDown: (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => void
  handlePromptClick: (
    prompt: (typeof prompts)[number],
  ) => void
}) {
  return (
    <div className="relative z-10 flex flex-1 overflow-y-auto px-8">
      <div className="mx-auto w-full max-w-[1060px] pb-12 pt-20">
        {/* Greeting */}
        <section className="text-center">
          <div className="mb-2 flex items-center justify-center gap-2.5">
            <Sparkles
              size={27}
              strokeWidth={1.7}
              className="text-[#D34778]"
            />

            <h1 className="text-[42px] font-medium tracking-[-0.03em] text-[#F2F2F2]">
              Hello, Divas.
            </h1>
          </div>

          <p className="text-[15px] text-white/48">
            Ask anything about your documents.
          </p>
        </section>

        {/* Composer */}
        <Composer
          question={question}
          setQuestion={setQuestion}
          sendMessage={sendMessage}
          handleKeyDown={handleKeyDown}
        />

        {/* Suggested prompts */}
        <section className="mx-auto mt-7 w-full max-w-[940px]">
          <h2 className="mb-3 text-[13px] font-semibold text-white/65">
            Suggested Prompts
          </h2>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {prompts.map((prompt) => (
              <button
                key={prompt.label}
                onClick={() => handlePromptClick(prompt)}
                className="group flex h-[62px] items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.016] px-3.5 text-left transition duration-200 hover:border-[#8E3A59]/35 hover:bg-white/[0.025]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#8E3A59]/[0.07] text-[#C46A8A]">
                  <Sparkles
                    size={15}
                    strokeWidth={1.7}
                  />
                </span>

                <span className="min-w-0">
                  <span className="block text-[12px] font-semibold leading-[15px] text-white/80">
                    {prompt.label}
                  </span>

                  <span className="block text-[11px] leading-[15px] text-white/38">
                    {prompt.subtitle}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Recent documents */}
        <section className="mx-auto mt-7 w-full max-w-[940px]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-white/65">
              Recent Documents
            </h2>

            <button className="text-[11px] text-white/28 transition hover:text-white/55">
              View all
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {documents.map((document) => (
              <button
                key={document.name}
                className="group flex h-[70px] items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.016] px-3.5 text-left transition duration-200 hover:border-white/[0.13] hover:bg-white/[0.025]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.035]">
                  <FileTypeIcon
                    type={document.type}
                    size={24}
                  />
                </div>

                <div className="min-w-0">
                  <div className="truncate text-[12px] font-semibold leading-4 text-white/82">
                    {document.name}
                  </div>

                  <div className="mt-0.5 text-[10px] leading-4 text-white/32">
                    {document.size} · {document.type.toUpperCase()}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function ConversationView({
  messages,
  question,
  setQuestion,
  sendMessage,
  handleKeyDown,
}: {
  messages: Message[]
  question: string
  setQuestion: (value: string) => void
  sendMessage: () => void
  handleKeyDown: (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => void
}) {
  return (
    <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-8">
        <div className="mx-auto w-full max-w-[900px] space-y-6 py-8">
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "flex justify-end"
                  : "flex justify-start"
              }
            >
              <div
                className={
                  message.role === "user"
                    ? "max-w-[75%] rounded-2xl rounded-br-md bg-[#8E3A59] px-4 py-3 text-sm leading-6 text-white"
                    : "max-w-[75%] rounded-2xl rounded-bl-md border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-sm leading-6 text-white/75"
                }
              >
                {message.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-8 pb-6">
        <Composer
          question={question}
          setQuestion={setQuestion}
          sendMessage={sendMessage}
          handleKeyDown={handleKeyDown}
          compact
        />
      </div>
    </div>
  )
}

function Composer({
  question,
  setQuestion,
  sendMessage,
  handleKeyDown,
  compact = false,
}: {
  question: string
  setQuestion: (value: string) => void
  sendMessage: () => void
  handleKeyDown: (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => void
  compact?: boolean
}) {
  return (
    <section
      className={[
        "mx-auto w-full max-w-[940px] rounded-[20px] border border-white/[0.11] bg-[#242428]/95 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.30)] backdrop-blur-sm",
        compact ? "mt-0" : "mt-7",
      ].join(" ")}
    >
      <textarea
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your documents..."
        className={[
          "w-full resize-none bg-transparent px-4 pt-2 text-[14px] text-white outline-none placeholder:text-white/30",
          compact ? "h-[72px]" : "h-[88px]",
        ].join(" ")}
      />

      <div className="flex items-center justify-between px-1 pb-1">
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 rounded-lg border border-white/[0.08] px-3.5 py-2 text-[12px] text-white/50 transition hover:bg-white/[0.04] hover:text-white">
            <Upload
              size={14}
              strokeWidth={1.8}
            />
            Upload
          </button>

          <button className="flex items-center gap-2 rounded-lg border border-white/[0.08] px-3.5 py-2 text-[12px] text-white/50 transition hover:bg-white/[0.04] hover:text-white">
            <Globe2
              size={14}
              strokeWidth={1.8}
            />
            Web Search
          </button>
        </div>

        <button
          onClick={sendMessage}
          disabled={!question.trim()}
          aria-label="Send"
          className="flex h-10 w-11 items-center justify-center rounded-lg bg-[#8E3A59] text-white shadow-[0_7px_20px_rgba(142,58,89,0.22)] transition hover:bg-[#9f4668] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ArrowUp
            size={18}
            strokeWidth={2}
          />
        </button>
      </div>
    </section>
  )
}