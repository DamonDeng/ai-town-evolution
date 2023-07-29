import { Infer, v } from 'convex/values';
import { api, internal } from './_generated/api.js';
import { Doc, Id } from './_generated/dataModel';
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { Entry, Agents, Memories, Memory, GameTs } from './schema.js';
import { Position, Pose, getRandomPosition, manhattanDistance } from './lib/physics.js';
import { MemoryDB } from './lib/memory.js';
import { fetchEmbedding } from './lib/openai.js';

export const Message = v.object({
  from: v.id('agents'),
  to: v.array(v.id('agents')),
  content: v.string(),
});
export type Message = Infer<typeof Message>;
// {
//   from: Id<'agents'>;
//   to: Id<'agents'>[];
//   content: string;
// };

export const Status = v.union(
  v.object({
    type: v.literal('talking'),
    otherAgentIds: v.array(v.id('agents')),
    conversationId: v.id('conversations'),
    messages: v.array(Message),
  }),
  v.object({
    type: v.literal('walking'),
    sinceTs: v.number(),
    route: v.array(Position),
    targetEndTs: v.number(),
  }),
  v.object({
    type: v.literal('stopped'),
    sinceTs: v.number(),
    reason: v.union(v.literal('interrupted'), v.literal('finished')),
  }),
  v.object({
    type: v.literal('thinking'),
    sinceTs: v.number(),
  }),
);
export type Status = Infer<typeof Status>;
// | {
//     type: 'talking';
//     otherAgentIds: Id<'agents'>[];
//     messages: Message[];
//   }
// | {
//     type: 'walking';
//     sinceTs: GameTs;
//     route: Position[];
//     targetEndTs: GameTs;
//   }
// | {
//     type: 'stopped';
//     sinceTs: GameTs;
//     reason: 'interrupted' | 'finished';
//   }
// | {
//     sinceTs: GameTs;
//     type: 'thinking';
//   };

export const AgentFields = {
  id: v.id('agents'),
  name: v.string(),
  identity: v.string(),
  pose: Pose,
  status: Status,
  plan: v.string(),
};
export const Agent = v.object(AgentFields);
export type Agent = Infer<typeof Agent>;
// {
//   id: Id<'agents'>;
//   name: string;
//   identity: string; // Latest one, if multiple
//   pose: Pose;
//   status: Status;
//   // plan: string;
// };

export const Snapshot = v.object({
  agent: Agent,
  // recentMemories: v.array(memoryValidator),
  nearbyAgents: v.array(v.object({ agent: Agent, new: v.boolean() })),
  ts: v.number(),
  lastPlanTs: v.number(),
});
export type Snapshot = Infer<typeof Snapshot>;
// {
//   agent: Agent;
//   recentMemories: Memory[];
//   nearbyAgents: { agent: Agent; sinceTs: GameTs }[];
//   ts: number;
//   lastPlanTs: number;
// };

export const Action = v.union(
  v.object({
    type: v.literal('startConversation'),
    audience: v.array(v.id('agents')),
    content: v.string(),
  }),
  v.object({
    type: v.literal('saySomething'),
    audience: v.array(v.id('agents')),
    content: v.string(),
    conversationId: v.id('conversations'),
  }),
  v.object({
    type: v.literal('travel'),
    position: Position,
  }),
  v.object({
    type: v.literal('continue'),
  }),
);
export type Action = Infer<typeof Action>;
// | {
//     type: 'startConversation';
//     audience: Id<'agents'>[];
//     content: string;
//   }
// | {
//     type: 'saySomething';
//     to: Id<'agents'>;
//     content: string;
//   }
// | {
//     type: 'travel';
//     position: Position;
//   }
// | {
//     type: 'continue';
//   };

export async function agentLoop(
  { agent, nearbyAgents, ts, lastPlanTs }: Snapshot,
  memory: MemoryDB,
): Promise<Action> {
  const newFriends = nearbyAgents.filter((a) => a.new).map(({ agent }) => agent);
  // Future: Store observations about seeing agents?
  //  might include new observations -> add to memory with openai embeddings
  // Based on plan and observations, determine next action: if so, call AgentAPI
  switch (agent.status.type) {
    case 'talking':
      // Decide if we keep talking.
      if (agent.status.messages.length >= 10) {
        // TODO: make a better plan
        return { type: 'travel', position: getRandomPosition() };
      } else {
        // Assuming one other person who just said something.
        // TODO: real logic
        return {
          type: 'saySomething',
          audience: nearbyAgents.map(({ agent }) => agent.id),
          content: 'Interesting point',
          conversationId: agent.status.conversationId,
        };
      }
    case 'walking':
      if (newFriends.length) {
        // Hey, new friends
        // TODO: decide whether we want to talk, and to whom.
        const { embedding } = await fetchEmbedding(`What do you think about ${newFriends[0].name}`);
        const memories = await memory.accessMemories(agent.id, embedding, ts);
        // TODO: actually do things with LLM completions.
        return {
          type: 'startConversation',
          audience: newFriends.map((a) => a.id),
          content: 'Hello',
        };
      } else if (manhattanDistance(agent.pose.position, agent.status.route.at(-1)!)) {
        // We've arrived.
        // TODO: make a better plan
        return { type: 'travel', position: getRandomPosition() };
      }
      // Otherwise I guess just keep walking?
      return { type: 'continue' };
    case 'stopped':
    case 'thinking':
      // TODO: consider reflecting on recent memories
      if (newFriends.length) {
        // Hey, new friends
        // TODO: decide whether we want to talk, and to whom.
        // TODO: actually do things with LLM completions.
        return {
          type: 'startConversation',
          audience: newFriends.map((a) => a.id),
          content: 'Hello',
        };
      } else {
        // TODO: make a better plan
        return { type: 'travel', position: getRandomPosition() };
      }
  }
}
