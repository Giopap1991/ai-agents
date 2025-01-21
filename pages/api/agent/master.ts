import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Check authentication
    const session = await getServerSession(req, res, authOptions)
    if (!session?.user) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const { prompt } = req.body

    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required' })
    }

    // Prepare system message for better task planning
    const systemMessage = `You are a professional project planner. 
    Create a clear, actionable plan for the given task. 
    Break it down into numbered steps with brief explanations.
    Focus on practical, achievable steps.`

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt }
      ],
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      max_tokens: 500,
    })

    const response = completion.choices[0].message.content

    // Log the request and response to database
    const agentRequest = await prisma.agentRequest.create({
      data: {
        userId: session.user.id,
        prompt: prompt,
        response: response || 'No response generated',
      },
    })

    return res.status(200).json({
      success: true,
      plan: response,
      requestId: agentRequest.id,
    })

  } catch (error) {
    console.error('API Error:', error)
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 