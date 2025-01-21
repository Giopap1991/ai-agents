import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const session = await getServerSession(req, res, authOptions)
    if (!session?.user) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    // Fetch all tasks for the user
    const tasks = await prisma.$transaction([
      // Fetch agent requests
      prisma.agentRequest.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
      }),
      // Fetch campaigns
      prisma.campaign.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
      }),
      // Fetch presentations
      prisma.presentation.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    // Combine and format all tasks
    const formattedTasks = [
      ...tasks[0].map(req => ({
        id: req.id,
        type: 'GENERAL',
        prompt: req.prompt,
        response: req.response,
        createdAt: req.createdAt,
        status: 'COMPLETED'
      })),
      ...tasks[1].map(campaign => ({
        id: campaign.id,
        type: 'EMAIL',
        prompt: `Email Campaign: ${campaign.subject}`,
        response: JSON.stringify({
          campaignId: campaign.id,
          status: campaign.status
        }),
        createdAt: campaign.createdAt,
        status: campaign.status
      })),
      ...tasks[2].map(presentation => ({
        id: presentation.id,
        type: 'PRESENTATION',
        prompt: `Presentation: ${presentation.topic}`,
        response: JSON.stringify({
          presentationId: presentation.id,
          status: presentation.status,
          pdfUrl: presentation.pdfUrl
        }),
        createdAt: presentation.createdAt,
        status: presentation.status
      }))
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    return res.status(200).json({
      tasks: formattedTasks
    })

  } catch (error) {
    console.error('Task List Error:', error)
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 