import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface AgentTask {
  type: 'EMAIL' | 'PRESENTATION' | 'GENERAL'
  prompt: string
  parameters?: Record<string, any>
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const session = await getServerSession(req, res, authOptions)
    if (!session?.user) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const { prompt } = req.body

    // First, analyze the task using OpenAI to determine the agent type
    const analysis = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `Analyze the user request and categorize it as one of these types:
          EMAIL: Tasks related to email marketing or campaigns
          PRESENTATION: Tasks requiring presentation creation
          GENERAL: Other planning or organization tasks
          
          Respond with a JSON object containing:
          {
            "type": "EMAIL|PRESENTATION|GENERAL",
            "parameters": {
              // Extracted relevant parameters based on type
            }
          }`
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    const taskAnalysis = JSON.parse(
      analysis.choices[0].message.content || '{}'
    ) as AgentTask

    // Log the initial request
    const agentRequest = await prisma.agentRequest.create({
      data: {
        userId: session.user.id,
        prompt: prompt,
        response: 'Processing...',
      },
    })

    // Route to appropriate specialized agent
    let response
    switch (taskAnalysis.type) {
      case 'EMAIL':
        response = await handleEmailTask(taskAnalysis, session.user.id)
        break
      case 'PRESENTATION':
        response = await handlePresentationTask(taskAnalysis, session.user.id)
        break
      default:
        response = await handleGeneralTask(taskAnalysis)
    }

    // Update the agent request with the response
    await prisma.agentRequest.update({
      where: { id: agentRequest.id },
      data: {
        response: JSON.stringify(response)
      }
    })

    return res.status(200).json({
      success: true,
      type: taskAnalysis.type,
      result: response
    })

  } catch (error) {
    console.error('Orchestrator Error:', error)
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleEmailTask(task: AgentTask, userId: string) {
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/email/campaign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: task.parameters?.subject || 'Generated Campaign',
      body: task.parameters?.body || '',
      recipients: task.parameters?.recipients || []
    })
  })

  return response.json()
}

async function handlePresentationTask(task: AgentTask, userId: string) {
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/presentation/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: task.parameters?.topic || task.prompt
    })
  })

  return response.json()
}

async function handleGeneralTask(task: AgentTask) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: `Create a detailed action plan for the following task.
        Break it down into numbered steps with explanations.`
      },
      {
        role: 'user',
        content: task.prompt
      }
    ]
  })

  return {
    plan: completion.choices[0].message.content
  }
} 