# SentinelPrime

**Autonomous AI agent that discovers, executes, and submits work on [Superteam Earn](https://earn.superteam.fun) bounties.**

SentinelPrime is the lead coordinating agent — it reads bounty requirements, delegates execution to Claude Code CLI sessions that write real code, analysis, and content, then manages the full submission lifecycle. A human operator reviews and approves every submission before it goes out.

Built with [Mastra](https://mastra.ai) (TypeScript agent framework) and the Superteam Earn Agent API.

---

## How It Works

```
                         ┌──────────────────────┐
                         │    SENTINELPRIME      │
                         │   Lead Orchestrator   │
                         │                       │
                         │  Analyzes bounties    │
                         │  Plans deliverables   │
                         │  Reviews output       │
                         │  Manages submissions  │
                         └───────┬──────┬────────┘
                                 │      │
                    ┌────────────┘      └────────────┐
                    ▼                                 ▼
          ┌──────────────────┐              ┌──────────────────┐
          │      SCOUT       │              │   CLAUDE CODE    │
          │   Discovery      │              │   Executor       │
          │                  │              │                  │
          │  Scans listings  │              │  Writes code     │
          │  Ranks by value  │              │  Creates repos   │
          │  Filters noise   │              │  Runs tests      │
          └──────────────────┘              │  Writes content  │
                                            │  Produces reports│
                                            └──────────────────┘
                                                     │
                                                     ▼
                                            ┌──────────────────┐
                                            │  HUMAN OPERATOR  │
                                            │                  │
                                            │  Reviews output  │
                                            │  Approves/edits  │
                                            │  Claims rewards  │
                                            └──────────────────┘
```

### The Three-Tier Agent Design

**SentinelPrime** (Orchestrator) — The lead agent. Coordinates the entire bounty lifecycle: deep-reads requirements, determines what type of work is needed, crafts structured briefs for execution, reviews output quality, and handles submission to the Earn platform. Uses Claude API for reasoning.

**Scout** (Discovery) — A fast, cheap scanning agent that pulls live listings from Superteam Earn, analyzes reward-to-effort ratios, checks deadlines, and ranks bounties by feasibility. Runs on Nosana GPU credits (Llama 3.1 70B) to keep costs near zero during high-volume discovery.

**Claude Code CLI** (Execution Engine) — The actual worker. SentinelPrime spawns isolated Claude Code sessions per bounty, each in its own workspace directory. Claude Code can scaffold entire projects, write and test code, research topics, audit codebases, write documentation — the full software development lifecycle. This is what makes SentinelPrime capable of handling dev bounties, not just content.

### Workflow

1. **Discovery** — Scout fetches live agent-eligible listings, ranks them, and presents a shortlist. The workflow suspends for human selection.
2. **Execution** — SentinelPrime fetches full bounty details and comments, then spawns a Claude Code session with a structured brief. Claude Code produces deliverables in an isolated `workspaces/{bounty-slug}/` directory.
3. **Review** — The workflow suspends again. The human operator reviews the output, edits if needed, and provides submission details (links, answers to eligibility questions).
4. **Submission** — SentinelPrime submits the work to Superteam Earn via the Agent API.

Human approval gates at steps 1 and 3 ensure nothing ships without review.

---

## Project Structure

```
sentinelPrime/
├── CLAUDE.md                          # Project memory and API reference
├── .env                               # API keys (not committed)
├── package.json
├── tsconfig.json
├── workspaces/                        # Isolated bounty workspaces (gitignored)
│   └── {bounty-slug}/
│       ├── BRIEF.md                   # Bounty requirements and context
│       ├── SUBMISSION.md              # Output summary (created by Claude Code)
│       └── ...                        # Deliverable files
└── src/mastra/
    ├── index.ts                       # Mastra instance — registers agents + workflows
    ├── agents/
    │   ├── scout.ts                   # Discovery agent (Nosana / Llama 3.1)
    │   └── sentinel-prime.ts          # Lead orchestrator (Claude API)
    ├── tools/
    │   ├── api-client.ts              # Shared HTTP client for Superteam API
    │   ├── register-agent.ts          # Register on Earn, get API key
    │   ├── discover-listings.ts       # Fetch live bounty listings
    │   ├── get-listing-details.ts     # Full listing details by slug
    │   ├── submit-work.ts             # Submit deliverables
    │   ├── update-submission.ts       # Update existing submission
    │   ├── fetch-comments.ts          # Read listing comments
    │   ├── post-comment.ts            # Post clarifying questions
    │   ├── claude-code-executor.ts    # Spawn Claude Code CLI sessions
    │   └── index.ts
    └── workflows/
        ├── discovery.ts               # Discover → rank → human selects
        ├── execution.ts               # Execute → review → submit
        └── index.ts
```

---

## Setup

### Prerequisites

- Node.js 20+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- API keys for Anthropic (Claude) and optionally Nosana GPU

### Install

```bash
git clone https://github.com/Blessedbiello/sentinelPrime.git
cd sentinelPrime
npm install
```

### Configure

Copy `.env` and fill in your keys:

```bash
cp .env .env.local
```

```env
SUPERTEAM_BASE_URL=https://earn.superteam.fun
SUPERTEAM_API_KEY=              # From agent registration (step below)
NOSANA_BASE_URL=                # Nosana OpenAI-compatible endpoint
NOSANA_API_KEY=                 # Nosana auth token
NOSANA_MODEL_ID=meta-llama/Meta-Llama-3.1-70B-Instruct
ANTHROPIC_API_KEY=              # For SentinelPrime orchestrator
TELEGRAM_HANDLE=                # Your t.me/username for project submissions
```

### Register on Superteam Earn

Use the Mastra playground or call the registration tool directly to create your agent identity:

```bash
npx mastra dev
# Open http://localhost:4111
# Use the register-agent tool with your chosen agent name
# Save the returned API key to .env as SUPERTEAM_API_KEY
# Save the claim code — a human needs it to claim rewards later
```

### Run

```bash
npx mastra dev
```

Open the playground at `http://localhost:4111` to:
- Run the **discovery workflow** to find and rank bounties
- Run the **execution workflow** on a selected bounty
- Interact with agents directly for ad-hoc tasks

---

## How SentinelPrime Handles Different Bounty Types

| Bounty Type | What Claude Code Produces |
|-------------|--------------------------|
| **Dev** | Scaffolded repos, smart contracts, scripts, APIs, full projects with tests |
| **Content** | Researched articles, Twitter threads, documentation, tutorials |
| **Analysis** | Code audits, product reviews, competitive analysis, research reports |
| **Design** | Architecture diagrams, system designs, detailed UI specifications |

Each bounty gets its own `workspaces/{slug}/` directory with a `BRIEF.md` containing the full requirements. Claude Code reads the brief, produces deliverables, and writes a `SUBMISSION.md` summary.

---

## Superteam Earn Agent API

SentinelPrime integrates with these endpoints:

| Endpoint | Purpose |
|----------|---------|
| `POST /api/agents` | Register agent, receive API key + claim code |
| `GET /api/agents/listings/live` | Discover agent-eligible bounties |
| `GET /api/agents/listings/details/{slug}` | Fetch full listing details |
| `POST /api/agents/submissions/create` | Submit completed work |
| `POST /api/agents/submissions/update` | Revise a submission |
| `GET /api/agents/comments/{id}` | Read listing comments |
| `POST /api/agents/comments/create` | Post comments or questions |

Only listings marked `AGENT_ALLOWED` or `AGENT_ONLY` accept agent submissions. A human operator must claim the agent (using the claim code from registration) to receive payouts.

---

## Key Design Decisions

- **Claude Code as execution engine** — Instead of generating text via the Claude API, SentinelPrime spawns full Claude Code CLI sessions. This gives it file system access, bash, git, web search, and the ability to create entire projects — not just write responses.
- **Workspace isolation** — Each bounty runs in its own directory. No cross-contamination between bounties. Clean separation of concerns.
- **Human-in-the-loop** — Mastra workflow suspension at two critical points: bounty selection and submission review. Nothing ships without a human approving it.
- **Cost-efficient discovery** — Scout runs on Nosana GPU credits (Llama 3.1 70B) for high-volume listing scans. Claude is only invoked for approved bounties where quality matters.
- **Thin tools** — API wrappers contain no business logic, just HTTP calls with Zod validation. All intelligence lives in the agents and workflows.

---

## License

MIT
