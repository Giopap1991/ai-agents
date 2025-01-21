import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import sgMail from '@sendgrid/mail'

// Initialize SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

interface CampaignRequest {
  subject: string
  body: string
  recipients: string[] // Array of email addresses
}

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

    const { subject, body, recipients }: CampaignRequest = req.body

    // Validate request
    if (!subject || !body || !recipients?.length) {
      return res.status(400).json({ 
        message: 'Subject, body, and recipients are required' 
      })
    }

    // Create campaign record
    const campaign = await prisma.campaign.create({
      data: {
        userId: session.user.id,
        subject,
        body,
        status: 'SENDING',
        recipients: {
          create: recipients.map(email => ({
            email,
            status: 'PENDING'
          }))
        }
      },
      include: {
        recipients: true
      }
    })

    // Send emails in batches of 100
    const batchSize = 100
    const batches = Math.ceil(recipients.length / batchSize)
    let failedCount = 0

    for (let i = 0; i < batches; i++) {
      const start = i * batchSize
      const end = start + batchSize
      const batchRecipients = campaign.recipients.slice(start, end)

      await Promise.all(
        batchRecipients.map(async (recipient) => {
          try {
            await sgMail.send({
              to: recipient.email,
              from: process.env.SENDGRID_FROM_EMAIL!,
              subject: subject,
              html: body,
              trackingSettings: {
                clickTracking: { enable: true },
                openTracking: { enable: true }
              }
            })

            // Update recipient status
            await prisma.campaignRecipient.update({
              where: { id: recipient.id },
              data: {
                status: 'SENT',
                sentAt: new Date()
              }
            })
          } catch (error) {
            failedCount++
            await prisma.campaignRecipient.update({
              where: { id: recipient.id },
              data: {
                status: 'FAILED',
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            })
          }
        })
      )
    }

    // Update campaign status
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: failedCount === recipients.length ? 'FAILED' : 'COMPLETED',
        sentAt: new Date()
      }
    })

    return res.status(200).json({
      success: true,
      campaignId: campaign.id,
      totalRecipients: recipients.length,
      failedCount
    })

  } catch (error) {
    console.error('Campaign Error:', error)
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 