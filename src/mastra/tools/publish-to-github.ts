import { createTool } from '@mastra/core/tools';
import { execFile } from 'child_process';
import { z } from 'zod';
import { trackAction } from './heartbeat.js';

function run(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, timeout: 60_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${cmd} ${args.join(' ')} failed: ${stderr || error.message}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

export const publishToGithubTool = createTool({
  id: 'publish-to-github',
  description:
    'Publishes a bounty workspace to a new GitHub repository using the gh CLI. ' +
    'Initializes git, commits all files, creates a remote repo, and pushes. ' +
    'Returns the repo URL for submission.',
  inputSchema: z.object({
    workspacePath: z.string().describe('Absolute path to the bounty workspace directory'),
    repoName: z.string().describe('GitHub repository name (e.g. bounty-solana-audit)'),
    description: z.string().optional().describe('Short repo description'),
    isPrivate: z.boolean().default(false).describe('Create as private repo'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    repoUrl: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { workspacePath, repoName, description, isPrivate } = context;

    try {
      // 1. Init git repo in workspace
      await run('git', ['init'], workspacePath);
      await run('git', ['add', '.'], workspacePath);
      await run('git', ['commit', '-m', 'Initial submission'], workspacePath);
      await run('git', ['branch', '-M', 'main'], workspacePath);

      // 2. Create GitHub repo via gh CLI
      const visibility = isPrivate ? '--private' : '--public';
      const ghArgs = ['repo', 'create', repoName, visibility, '--source', '.', '--push'];
      if (description) {
        ghArgs.push('--description', description);
      }

      const ghOutput = await run('gh', ghArgs, workspacePath);

      // 3. Extract repo URL from gh output
      const urlMatch = ghOutput.match(/https:\/\/github\.com\/[^\s]+/);
      const repoUrl = urlMatch
        ? urlMatch[0]
        : `https://github.com/${await run('gh', ['api', 'user', '-q', '.login'], workspacePath)}/${repoName}`;

      trackAction(`published ${repoName} to GitHub`, 'ready for submission');

      return { success: true, repoUrl };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  },
});
