# AI-Powered Research Paper Management System

This project is a full-stack AI-driven platform for uploading, storing, analyzing, and interacting with academic research papers. Built for hackathons and scalable applications, it uses Google Gemini for summarization and quality assessment, and Pinecone (or Chroma) for semantic search.

## Features

### Paper Management

- Upload PDFs (stored in MongoDB GridFS)
- Extract metadata (title, authors, keywords)
- Search and filter by title, author, keyword, and date

### Intelligent Summarization

- Generate structured summaries
- Extract contributions, methodology, findings, and conclusion
- Summaries are stored and retrievable

### Interactive Chat Assistant

- Chat with uploaded PDFs using Gemini API
- Supports follow-up questions and paper-aware prompts
- Automatically detects and selects relevant papers using vector embeddings

### Quality Assessment

- Assess writing quality, methodology, and academic standards
- Generates structured reviewer-style feedback
- Provides a score out of 100 with detailed suggestions

## Tech Stack

| Layer          | Technology                          |
| -------------- | ----------------------------------- |
| Backend        | Node.js, Express                    |
| AI             | Google Gemini API                   |
| Embeddings     | Gemini Embeddings + Pinecone/Chroma |
| Storage        | MongoDB + GridFS                    |
| PDF Parsing    | pdf-parse                           |
| Authentication | JWT + Cookies                       |

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/research-paper-ai.git
cd research-paper-ai
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file:

```env
MONGO_URI=mongodb://localhost:27017/ai-papers
GEMINI_API_KEY=your_gemini_api_key_here
PORT=5000
```

If using Pinecone:

```env
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=your_index
```

### 4. Start the Server

```bash
npm start
```

Visit: http://localhost:5000

## API Endpoints

### Upload and Storage

- POST /api/paper/upload – Upload PDF files
- GET /api/paper/download/:filename – Download/view a paper
- DELETE /api/paper/delete/:id – Delete a specific paper
- DELETE /api/paper/delete-all – Delete all uploaded papers

### Summarization

- POST /api/paper/summarize/:paperId – Generate summary using Gemini
- GET /api/paper/summary/:paperId – Retrieve stored summary

### Quality Assessment

- POST /api/paper/assess/:paperId – Assess paper quality
- GET /api/paper/assessment/:paperId – Retrieve stored assessment

### Search

- GET /api/paper/search?title=...&keyword=... – Search papers

### Chat Assistant

- POST /api/chat – Chat with papers (with or without file)
- GET /api/chat/history – Retrieve previous sessions
- POST /api/chat/save-history – Save chat history

## Example Gemini Prompt for Summarization

```
You are an academic summarizer. Extract and respond in JSON:
{
  "summary": "...",
  "contributions": ["...", "..."],
  "methodology": "...",
  "findings": "...",
  "conclusion": "..."
}
```

## References

- https://ai.google.dev/
- https://www.npmjs.com/package/multer-gridfs-storage
- https://www.npmjs.com/package/pdf-parse
- https://docs.pinecone.io
