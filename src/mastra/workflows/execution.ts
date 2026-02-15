import { createWorkflow, createStep } from '@mastra/core/workflows';
import { RuntimeContext } from '@mastra/core/di';
import { z } from 'zod';
import { getListingDetailsTool, fetchCommentsTool, submitWorkTool } from '../tools/index.js';
import { claudeCodeExecutorTool } from '../tools/claude-code-executor.js';
import { publishToGithubTool } from '../tools/publish-to-github.js';

const DEV_TYPES = ['dev', 'development', 'bounty', 'project'];

// Step 1: Deep analysis — fetch full listing details and comments
const deepAnalysis = createStep({
  id: 'deep-analysis',
  inputSchema: z.object({
    slug: z.string(),
  }),
  outputSchema: z.object({
    listingId: z.string(),
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    type: z.string(),
    requirements: z.string(),
    deliverableFormat: z.string(),
    rewardAmount: z.number().optional(),
    eligibilityQuestions: z.array(z.string()).optional(),
    comments: z.array(z.object({
      message: z.string(),
      authorId: z.string().optional(),
    })).optional(),
  }),
  execute: async ({ inputData }) => {
    const runtimeContext = new RuntimeContext();

    const detailsResult = await getListingDetailsTool.execute(
      { context: { slug: inputData.slug }, runtimeContext },
    );

    const listing = (detailsResult.listing || {}) as Record<string, any>;
    const listingId = listing.id || '';

    let comments: Array<{ message: string; authorId?: string }> = [];
    if (listingId) {
      const commentsResult = await fetchCommentsTool.execute(
        { context: { listingId, skip: 0, take: 50 }, runtimeContext },
      );
      comments = commentsResult.comments || [];
    }

    const description = [
      listing.description || '',
      listing.requirements || '',
      listing.eligibility || '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const type = listing.type || 'bounty';
    const deliverableFormat = listing.deliverables || listing.template || 'See description';

    return {
      listingId,
      slug: inputData.slug,
      title: listing.title || inputData.slug,
      description,
      type,
      requirements: listing.requirements || description,
      deliverableFormat,
      rewardAmount: listing.rewardAmount,
      eligibilityQuestions: listing.eligibilityQuestions,
      comments,
    };
  },
});

// Step 2: Execute with Claude Code
const executeWithClaudeCode = createStep({
  id: 'execute-with-claude-code',
  inputSchema: z.object({
    listingId: z.string(),
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    type: z.string(),
    requirements: z.string(),
    deliverableFormat: z.string(),
    rewardAmount: z.number().optional(),
    eligibilityQuestions: z.array(z.string()).optional(),
    comments: z.array(z.object({
      message: z.string(),
      authorId: z.string().optional(),
    })).optional(),
  }),
  outputSchema: z.object({
    listingId: z.string(),
    slug: z.string(),
    title: z.string(),
    type: z.string(),
    workspacePath: z.string(),
    summary: z.string(),
    artifacts: z.array(z.string()),
    success: z.boolean(),
    error: z.string().optional(),
    eligibilityQuestions: z.array(z.string()).optional(),
  }),
  execute: async ({ inputData }) => {
    const runtimeContext = new RuntimeContext();

    let enrichedRequirements = inputData.requirements;
    if (inputData.comments && inputData.comments.length > 0) {
      const commentContext = inputData.comments
        .map((c) => `- ${c.message}`)
        .join('\n');
      enrichedRequirements += `\n\nRelevant comments from the listing:\n${commentContext}`;
    }

    const result = await claudeCodeExecutorTool.execute({
      context: {
        bountySlug: inputData.slug,
        bountyTitle: inputData.title,
        bountyDescription: inputData.description,
        bountyType: inputData.type,
        requirements: enrichedRequirements,
        deliverableFormat: inputData.deliverableFormat,
      },
      runtimeContext,
    });

    return {
      listingId: inputData.listingId,
      slug: inputData.slug,
      title: inputData.title,
      type: inputData.type,
      workspacePath: result.workspacePath,
      summary: result.summary,
      artifacts: result.artifacts,
      success: result.success,
      error: result.error,
      eligibilityQuestions: inputData.eligibilityQuestions,
    };
  },
});

// Step 3: Publish to GitHub (dev bounties only, passthrough for others)
const publishToGithub = createStep({
  id: 'publish-to-github',
  inputSchema: z.object({
    listingId: z.string(),
    slug: z.string(),
    title: z.string(),
    type: z.string(),
    workspacePath: z.string(),
    summary: z.string(),
    artifacts: z.array(z.string()),
    success: z.boolean(),
    error: z.string().optional(),
    eligibilityQuestions: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({
    listingId: z.string(),
    slug: z.string(),
    title: z.string(),
    type: z.string(),
    workspacePath: z.string(),
    summary: z.string(),
    artifacts: z.array(z.string()),
    success: z.boolean(),
    error: z.string().optional(),
    repoUrl: z.string().optional(),
    eligibilityQuestions: z.array(z.string()).optional(),
  }),
  execute: async ({ inputData }) => {
    // Only publish to GitHub for dev-type bounties with successful execution
    const isDevBounty = DEV_TYPES.some((t) => inputData.type.toLowerCase().includes(t));
    if (!isDevBounty || !inputData.success) {
      return { ...inputData, repoUrl: undefined };
    }

    const runtimeContext = new RuntimeContext();
    const result = await publishToGithubTool.execute({
      context: {
        workspacePath: inputData.workspacePath,
        repoName: inputData.slug,
        description: `Superteam Earn bounty: ${inputData.title}`,
        isPrivate: false,
      },
      runtimeContext,
    });

    return {
      ...inputData,
      repoUrl: result.success ? result.repoUrl : undefined,
      // Append publish error but don't fail the whole workflow
      error: result.success
        ? inputData.error
        : `${inputData.error || ''}; GitHub publish failed: ${result.error}`.replace(/^; /, ''),
    };
  },
});

// Step 4: Human review (suspend)
const humanReview = createStep({
  id: 'human-review',
  inputSchema: z.object({
    listingId: z.string(),
    slug: z.string(),
    title: z.string(),
    type: z.string(),
    workspacePath: z.string(),
    summary: z.string(),
    artifacts: z.array(z.string()),
    success: z.boolean(),
    error: z.string().optional(),
    repoUrl: z.string().optional(),
    eligibilityQuestions: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({
    approved: z.boolean(),
    listingId: z.string(),
    link: z.string().optional(),
    otherInfo: z.string().optional(),
    eligibilityAnswers: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
    telegram: z.string().optional(),
  }),
  resumeSchema: z.object({
    approved: z.boolean(),
    link: z.string().optional(),
    otherInfo: z.string().optional(),
    eligibilityAnswers: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
    telegram: z.string().optional(),
  }),
  suspendSchema: z.object({
    title: z.string(),
    workspacePath: z.string(),
    summary: z.string(),
    artifacts: z.array(z.string()),
    repoUrl: z.string().optional(),
    success: z.boolean(),
    error: z.string().optional(),
    message: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (resumeData) {
      return {
        approved: resumeData.approved,
        listingId: inputData.listingId,
        // Default the link to the GitHub repo URL if not overridden
        link: resumeData.link || inputData.repoUrl,
        otherInfo: resumeData.otherInfo,
        eligibilityAnswers: resumeData.eligibilityAnswers,
        telegram: resumeData.telegram,
      };
    }

    await suspend({
      title: inputData.title,
      workspacePath: inputData.workspacePath,
      summary: inputData.summary,
      artifacts: inputData.artifacts,
      repoUrl: inputData.repoUrl,
      success: inputData.success,
      error: inputData.error,
      message: inputData.repoUrl
        ? `Review the output. GitHub repo: ${inputData.repoUrl}. Resume with { approved: true/false, link?, otherInfo?, eligibilityAnswers?, telegram? }`
        : 'Review the output. Resume with { approved: true/false, link?, otherInfo?, eligibilityAnswers?, telegram? }',
    });

    return {
      approved: false,
      listingId: inputData.listingId,
    };
  },
});

// Step 5: Submit work
const submit = createStep({
  id: 'submit-work',
  inputSchema: z.object({
    approved: z.boolean(),
    listingId: z.string(),
    link: z.string().optional(),
    otherInfo: z.string().optional(),
    eligibilityAnswers: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
    telegram: z.string().optional(),
  }),
  outputSchema: z.object({
    submitted: z.boolean(),
    submissionId: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.approved) {
      return { submitted: false, error: 'Submission not approved by human reviewer' };
    }

    const runtimeContext = new RuntimeContext();

    const telegramHandle = inputData.telegram || process.env.TELEGRAM_HANDLE || '';
    const telegram = telegramHandle
      ? `http://t.me/${telegramHandle.replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '')}`
      : undefined;

    const result = await submitWorkTool.execute({
      context: {
        listingId: inputData.listingId,
        link: inputData.link,
        otherInfo: inputData.otherInfo,
        eligibilityAnswers: inputData.eligibilityAnswers,
        telegram,
      },
      runtimeContext,
    });

    if (!result.success) {
      return { submitted: false, error: result.error };
    }

    return { submitted: true, submissionId: result.submissionId };
  },
});

export const executionWorkflow = createWorkflow({
  id: 'execution-workflow',
  inputSchema: z.object({
    slug: z.string(),
  }),
  outputSchema: z.object({
    submitted: z.boolean(),
    submissionId: z.string().optional(),
    error: z.string().optional(),
  }),
})
  .then(deepAnalysis)
  .then(executeWithClaudeCode)
  .then(publishToGithub)
  .then(humanReview)
  .then(submit)
  .commit();
