# SentinelPrime — Superteam Earn Bounty Agent

## Overview
Autonomous AI agent that discovers, analyzes, and submits work to Superteam Earn bounties.
Uses Mastra (TypeScript) with dual LLM strategy: Nosana GPU for discovery, Claude Code CLI for execution.

## Architecture
- **Scout** (Nosana/Llama) — cheap listing discovery and filtering
- **SentinelPrime** (Mastra orchestrator) — coordinates workflow, manages state
- **Claude Code CLI** (subprocess) — executes bounty work: code, analysis, content

## Superteam Earn API Reference

Base URL: `https://earn.superteam.fun`
Auth: `Authorization: Bearer sk_...`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/agents | No | Register agent, get API key + claim code |
| GET | /api/agents/listings/live?take=&deadline= | Yes | Discover agent-eligible listings |
| GET | /api/agents/listings/details/{slug} | Yes | Full listing details |
| POST | /api/agents/submissions/create | Yes | Submit work (link, otherInfo, eligibilityAnswers) |
| POST | /api/agents/submissions/update | Yes | Update existing submission |
| GET | /api/agents/comments/{listing-id}?skip=&take= | Yes | Fetch listing comments |
| POST | /api/agents/comments/create | Yes | Post comment (refType, refId, message, pocId) |
| POST | /api/agents/claim | Human auth | Human claims agent for payout |

### Rate Limits
- Registration: 60/IP/hour
- Submissions: 60/agent/hour (create + update combined)
- Comments: 120/agent/hour

### Submission Fields
- `listingId` (required)
- `link` (required if no otherInfo)
- `otherInfo` (required if no link)
- `tweet` (optional)
- `eligibilityAnswers` (array, optional)
- `ask` (null or quote amount)
- `telegram` (required for projects, format: `http://t.me/username`)

### Agent Access Rules
- Only `AGENT_ALLOWED` or `AGENT_ONLY` listings accept agent submissions
- `AGENT_ONLY` listings are hidden from normal feeds

## Project Structure
```
src/mastra/
├── index.ts              # Mastra instance
├── agents/
│   ├── scout.ts          # Discovery agent (Nosana)
│   └── sentinel-prime.ts # Orchestrator agent (Claude API)
├── tools/
│   ├── api-client.ts     # Shared HTTP helper
│   ├── register-agent.ts
│   ├── discover-listings.ts
│   ├── get-listing-details.ts
│   ├── submit-work.ts
│   ├── update-submission.ts
│   ├── fetch-comments.ts
│   ├── post-comment.ts
│   ├── claude-code-executor.ts
│   └── index.ts
└── workflows/
    ├── discovery.ts      # Discover → rank → human selects
    ├── execution.ts      # Execute → review → submit
    └── index.ts
```

## Conventions
- Tools are thin API wrappers — no business logic
- Zod schemas for all inputs/outputs
- Each bounty gets isolated workspace: `workspaces/{bounty-slug}/`
- Human-in-the-loop via Mastra workflow suspend/resume
- Environment variables in `.env` (never committed)

## Registration Details
<!-- Updated after first registration -->
- Agent ID: (pending)
- API Key: stored in .env
- Claim Code: (pending)

## Status
- [x] Project setup
- [x] API tools
- [x] Claude Code executor
- [x] Agents
- [x] Workflows
- [x] Mastra wiring
- [ ] Testing (register agent, run `npx mastra dev`, end-to-end)
