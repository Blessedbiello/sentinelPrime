import { createTool } from '@mastra/core/tools';
import { execFile } from 'child_process';
import { mkdir, writeFile, readdir } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';

const WORKSPACES_DIR = join(process.cwd(), 'workspaces');
const EXECUTION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export const claudeCodeExecutorTool = createTool({
  id: 'claude-code-executor',
  description:
    'Spawns a Claude Code CLI session to produce bounty deliverables. ' +
    'Creates an isolated workspace, writes bounty context, and runs Claude Code ' +
    'to generate code, analysis, content, or other artifacts.',
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
    success: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const workDir = join(WORKSPACES_DIR, context.bountySlug);

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
      const prompt = [
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
      ].join('\n');

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

      // 6. Extract summary from output (first ~500 chars or SUBMISSION.md content)
      const summary =
        output.length > 1000
          ? output.slice(0, 1000) + '\n... (truncated)'
          : output;

      return {
        workspacePath: workDir,
        summary,
        artifacts,
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
