// app/api/agent/run/route.ts
// Runs the FinAgent LangGraph pipeline with Server-Sent Events streaming
// The frontend receives real-time node updates as the agent works

import { NextRequest } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { runFinAgent } from '@/lib/agent/finagent';
import { getUserByAuth0Id, getConnectedSourcesForUser, createDossier } from '@/lib/db/supabase';
import type { SourceKey } from '@/lib/auth0';

export const runtime = 'nodejs'; // puppeteer needs Node.js runtime
export const maxDuration = 120;  // 2 min timeout for full analysis

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Set up Server-Sent Events stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: object) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      }

      try {
        // Get user from database
        const user = await getUserByAuth0Id(session.user.sub);
        if (!user) {
          send({ type: 'error', message: 'User not found. Please complete onboarding.' });
          controller.close();
          return;
        }

        // Get connected sources
        const sourcesFromDB = await getConnectedSourcesForUser(user.id);
        const connectedSources = sourcesFromDB
          .filter(s => s.is_active)
          .map(s => s.source_key as SourceKey);

        if (connectedSources.length < 2) {
          send({ type: 'error', message: 'Please connect at least 2 data sources before analysing.' });
          controller.close();
          return;
        }

        // Create dossier record
        const dossier = await createDossier(user.id);

        send({ type: 'agent_started', dossierId: dossier.id, connectedSources });

        // Run the agent with streaming callbacks
        await runFinAgent({
          userId: user.id,
          auth0UserId: session.user.sub,
          dossierId: dossier.id,
          connectedSources,
          sessionId: crypto.randomUUID(),
          onEvent: (event) => {
            send(event);
          },
        });

      } catch (err: any) {
        send({ type: 'error', message: err.message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
