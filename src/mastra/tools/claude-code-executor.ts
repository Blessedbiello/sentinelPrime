import { createTool } from '@mastra/core/tools';
import { execFile } from 'child_process';
import { mkdir, writeFile, readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';

const WORKSPACES_DIR = join(process.cwd(), 'workspaces');
const EXECUTION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const DEV_TYPES = ['dev', 'development', 'bounty', 'project'];

export const claudeCodeExecutorTool = createTool({
  id: 'claude-code-executor',
  description:
    'Spawns a Claude Code CLI session to produce bounty deliverables. ' +
    'Creates an isolated workspace, writes bounty context, and runs Claude Code ' +
    'to generate code, analysis, content, or other artifacts. ' +
    'For dev bounties, Claude Code also creates a GitHub repo and pushes the code.',
  inputSchema: z.object({
    bountySlug: z.string().describe('Unique slug for workspace directory name'),
    bountyTitle: z.string().describe('Bounty title'),
    bountyDescription: z.string().describe('Full bounty description and requirements'),
    bountyType: z.string().describe('Bounty type: content, dev, design, analysis'),
    requirements: z.string().describe('Specific deliverable requirements'),
    deliverableFormat: z.string().describe('What to produce: code repo, report, article, etc.'),
  }),
  outputSchema: z.object({
    workspacePath: z.string(),
    summary: z.string(),
    artifacts: z.array(z.string()),
    repoUrl: z.string().optional(),
    success: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const workDir = join(WORKSPACES_DIR, context.bountySlug);
    const isDevBounty = DEV_TYPES.some((t) => context.bountyType.toLowerCase().includes(t));

    try {
      // 1. Create workspace directory
      await mkdir(workDir, { recursive: true });

      // 2. Write bounty brief for the workspace
      const briefMd = [
        `# Bounty: ${context.bountyTitle}`,
        '',
        `## Type: ${context.bountyType}`,
        '',
        '## Description',
        context.bountyDescription,
        '',
        '## Requirements',
        context.requirements,
        '',
        '## Expected Deliverable',
        context.deliverableFormat,
        '',
        '## Instructions',
        '- Produce the deliverable described above.',
        '- Write all output files in the current directory.',
        '- Create a SUBMISSION.md summarizing what was produced and how to use it.',
        '- Be thorough and production-quality.',
      ].join('\n');

      await writeFile(join(workDir, 'BRIEF.md'), briefMd);

      // 3. Build the prompt for Claude Code
      const baseInstructions = [
        `You are working on a Superteam Earn bounty: "${context.bountyTitle}".`,
        '',
        `Type: ${context.bountyType}`,
        '',
        'Description:',
        context.bountyDescription,
        '',
        'Requirements:',
        context.requirements,
        '',
        `Deliverable format: ${context.deliverableFormat}`,
        '',
        'Instructions:',
        '1. Read the BRIEF.md in this directory for full context.',
        '2. Produce the required deliverable — write files, code, reports as needed.',
        '3. Create a SUBMISSION.md file summarizing what you produced.',
        '4. Ensure everything is complete and production-quality.',
      ];

      if (isDevBounty) {
        baseInstructions.push(
          '',
          'GitHub publishing (REQUIRED for this dev bounty):',
          `5. Initialize a git repo in this directory: git init && git add -A && git commit -m "Initial submission for ${context.bountyTitle}"`,
          `6. Create a public GitHub repo and push: gh repo create ${context.bountySlug} --public --source . --push`,
          '7. After pushing, write the GitHub repo URL as the ONLY content of a file called REPO_URL in this directory.',
          '   Example: echo "https://github.com/username/repo" > REPO_URL',
          '8. If gh is not available, skip steps 5-7 and note it in SUBMISSION.md.',
        );
      }

      const prompt = baseInstructions.join('\n');

      // 4. Spawn Claude Code CLI
      const output = await new Promise<string>((resolve, reject) => {
        const child = execFile(
          'claude',
          ['--print', '--dangerously-skip-permissions', '-p', prompt],
          {
            cwd: workDir,
            timeout: EXECUTION_TIMEOUT_MS,
            maxBuffer: 10 * 1024 * 1024, // 10MB
            env: { ...process.env },
          },
          (error, stdout, stderr) => {
            if (error) {
              reject(new Error(`Claude Code exited with error: ${error.message}\n${stderr}`));
              return;
            }
            resolve(stdout);
          },
        );

        child.stdin?.end();
      });

      // 5. List created artifacts
      const files = await readdir(workDir);
      const artifacts = files.filter((f) => f !== 'BRIEF.md');

      // 6. Read repo URL if Claude Code created one
      let repoUrl: string | undefined;
      if (files.includes('REPO_URL')) {
        const raw = await readFile(join(workDir, 'REPO_URL'), 'utf-8');
        const url = raw.trim();
        if (url.startsWith('https://github.com/')) {
          repoUrl = url;
        }
      }

      // 7. Extract summary
      const summary =
        output.length > 1000
          ? output.slice(0, 1000) + '\n... (truncated)'
          : output;

      return {
        workspacePath: workDir,
        summary,
        artifacts,
        repoUrl,
        success: true,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        workspacePath: workDir,
        summary: '',
        artifacts: [],
        success: false,
        error: message,
      };
    }
  },
});
