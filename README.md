# Docentra

> **AI-powered workspace for understanding, exploring, and interacting with documents.**

Docentra is a personal software project focused on building a modern document intelligence platform where users can upload documents and interact with their contents through AI.

The goal is to make working with documents feel less like searching through files and more like having a conversation with the information inside them.

🚧 **Status: Work in Progress**

Docentra is actively being developed. Some features and UI components are still under construction, and screenshots will be added as the product reaches a more complete stage.

---

## ✨ What is Docentra?

Working with documents often means switching between file managers, PDF readers, spreadsheets, and search tools just to find a small piece of information.

Docentra explores a different workflow:

**Upload → Understand → Ask → Explore**

The application is being designed around a unified workspace where users can manage their documents and use AI to interact with the information they contain.

Some of the core ideas behind the project include:

* 📄 **Document management** — organize and access uploaded files in one workspace
* 🤖 **AI interaction** — ask questions and communicate with document content
* 💬 **Conversation-based workflow** — keep document-related conversations organized and accessible
* 🔎 **Document understanding** — process different document formats and extract useful information
* 🧩 **Modern workspace UI** — provide a clean interface designed around productivity rather than a simple file viewer

---

## 🛠️ Tech Stack

### Frontend

* React
* JavaScript / TypeScript
* Vite
* Lucide Icons
* Custom component-based UI

### AI Service

* Python
* FastAPI
* Uvicorn
* Virtual environment-based development

### Document Processing

Docentra is being designed to support multiple document formats, including:

* PDF
* DOCX
* Markdown
* CSV
* XLSX

### Development

* Git
* GitHub
* Linux development environment

---

## 🏗️ Architecture

Docentra is being developed with a separated frontend and AI-service architecture.

```text
                 ┌─────────────────────┐
                 │      Frontend       │
                 │      React/Vite     │
                 └──────────┬──────────┘
                            │
                            │ API
                            ▼
                 ┌─────────────────────┐
                 │     AI Service      │
                 │   Python / FastAPI  │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │ Document Processing │
                 │    & AI Pipeline    │
                 └─────────────────────┘
```

This separation allows the frontend application and AI-related processing to evolve independently.

---

## 📁 Project Structure

```text
Docentra/
├── src/                  # Frontend application
│   ├── components/       # Reusable UI components
│   ├── assets/           # Images, icons, and other assets
│   └── ...
│
├── ai-service/           # AI / backend service
│   ├── app/
│   ├── .venv/
│   └── ...
│
├── public/
├── package.json
└── README.md
```

> The project structure is still evolving as new features are implemented.

---

## 🚀 Current Progress

Docentra is currently in active development.

### ✅ Implemented / In Progress

* [x] Initial project architecture
* [x] React-based frontend foundation
* [x] Initial Docentra UI and branding
* [x] Document/file-oriented interface
* [x] AI service foundation with FastAPI
* [x] Development environment for frontend and AI service
* [ ] Document upload pipeline
* [ ] Document parsing and processing
* [ ] AI-powered document conversations
* [ ] Conversation history
* [ ] Persistent document / conversation state
* [ ] Production-ready deployment

This checklist will be updated as development progresses.

---

## 🎯 Project Goals

The long-term goal of Docentra is to become a complete AI document workspace rather than simply a chatbot that accepts files.

The project is also an opportunity for me to explore and improve my skills in:

* Full-stack application development
* React frontend architecture
* Backend API development
* AI application development
* Document processing pipelines
* API communication between services
* Software architecture and project organization
* Building and iterating on a real product from scratch

---

## 📸 Screenshots

Screenshots will be added here as the application reaches a more complete UI stage.

> **Coming soon.**

---

## 🧪 Development

### Frontend

```bash
npm install
npm run dev
```

### AI Service

```bash
cd ai-service

source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The exact setup may change as the project develops.

---

## 🗺️ Roadmap

### Phase 1 — Foundation

* [x] Project setup
* [x] Initial UI
* [x] Frontend architecture
* [x] AI service foundation

### Phase 2 — Document Intelligence

* [ ] File upload
* [ ] Document extraction
* [ ] Processing pipeline
* [ ] Document indexing

### Phase 3 — AI Interaction

* [ ] Chat with documents
* [ ] Conversation persistence
* [ ] Context-aware responses
* [ ] Multi-document interaction

### Phase 4 — Product Refinement

* [ ] Improved UX
* [ ] Loading / error states
* [ ] Authentication
* [ ] Persistent storage
* [ ] Deployment
* [ ] Performance optimization

---

## 👨‍💻 About the Project

Docentra is an independent project built from scratch as I explore the intersection of **software engineering, AI, and product development**.

Rather than building only isolated demos, I wanted to create something closer to a real-world product — including its frontend, backend services, document processing, architecture, and user experience.

The project is still evolving, and this repository represents the development process as much as the final product.

---

## 📌 Project Status

**Active Development — Not Production Ready**

Features, architecture, and implementation details may change as the project evolves.
