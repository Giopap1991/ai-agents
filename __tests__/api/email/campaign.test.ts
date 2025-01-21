import { createMocks } from 'node-mocks-http'
import type { NextApiRequest, NextApiResponse } from 'next'
import handler from '@/pages/api/email/campaign'
import { prismaMock } from '../../../test/setup'
import sgMail from '@sendgrid/mail'

// Mock NextAuth
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn()
}))

// Mock the authOptions import
jest.mock('@/pages/api/auth/[...nextauth]', () => ({
  authOptions: {
    adapter: null,
    providers: [],
  }
}))

const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
}

describe('/api/email/campaign', () => {
  let getServerSession: jest.Mock

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks()
    
    // Get a reference to the mocked function
    getServerSession = require('next-auth/next').getServerSession
    
    // Set default session mock
    getServerSession.mockResolvedValue(mockSession)
  })

  it('should return 405 for non-POST requests', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(405)
    expect(JSON.parse(res._getData())).toEqual({
      message: 'Method not allowed',
    })
  })

  it('should return 401 for unauthorized requests', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
    })

    ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)

    await handler(req, res)

    expect(res._getStatusCode()).toBe(401)
    expect(JSON.parse(res._getData())).toEqual({
      message: 'Unauthorized',
    })
  })

  it('should validate required fields', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: {},
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    expect(JSON.parse(res._getData())).toEqual({
      message: 'Subject, body, and recipients are required',
    })
  })

  it('should create a campaign and send emails successfully', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: {
        subject: 'Test Campaign',
        body: '<p>Test email content</p>',
        recipients: ['recipient1@test.com', 'recipient2@test.com'],
      },
    })

    // Mock Prisma campaign creation
    const mockCampaign = {
      id: 'test-campaign-id',
      userId: mockSession.user.id,
      subject: 'Test Campaign',
      body: '<p>Test email content</p>',
      status: 'SENDING',
      sentAt: null,
      createdAt: new Date(),
      recipients: [
        {
          id: 'recipient1-id',
          email: 'recipient1@test.com',
          status: 'PENDING',
          campaignId: 'test-campaign-id',
          sentAt: null,
          error: null
        },
        {
          id: 'recipient2-id',
          email: 'recipient2@test.com',
          status: 'PENDING',
          campaignId: 'test-campaign-id',
          sentAt: null,
          error: null
        },
      ],
    }

    prismaMock.campaign.create.mockResolvedValue(mockCampaign)
    prismaMock.campaignRecipient.update.mockResolvedValue({
      id: 'recipient1-id',
      campaignId: 'test-campaign-id',
      email: 'recipient1@test.com',
      status: 'SENT',
      sentAt: new Date(),
      error: null,
    })

    // Mock SendGrid send function
    ;(sgMail.send as jest.Mock).mockResolvedValue([
      {
        statusCode: 202,
        body: {},
        headers: {},
      },
    ])

    await handler(req, res)

    // Verify response
    expect(res._getStatusCode()).toBe(200)
    expect(JSON.parse(res._getData())).toEqual({
      success: true,
      campaignId: 'test-campaign-id',
      totalRecipients: 2,
      failedCount: 0,
    })
  })

  it('should handle failed email sends', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: {
        subject: 'Test Campaign',
        body: '<p>Test email content</p>',
        recipients: ['invalid@test.com'],
      },
    })

    // Mock Prisma campaign creation
    const mockCampaign = {
      id: 'test-campaign-id',
      userId: mockSession.user.id,
      subject: 'Test Campaign',
      body: '<p>Test email content</p>',
      status: 'SENDING',
      sentAt: null,
      createdAt: new Date(),
      recipients: [
        {
          id: 'recipient1-id',
          email: 'invalid@test.com',
          status: 'PENDING',
          campaignId: 'test-campaign-id',
          sentAt: null,
          error: null
        },
      ],
    }

    prismaMock.campaign.create.mockResolvedValue(mockCampaign)
    prismaMock.campaignRecipient.update.mockResolvedValue({
      id: 'recipient1-id',
      campaignId: 'test-campaign-id',
      email: 'invalid@test.com',
      status: 'FAILED',
      sentAt: null,
      error: 'Failed to send email',
    })

    // Mock SendGrid send function to fail
    ;(sgMail.send as jest.Mock).mockRejectedValue(new Error('Failed to send email'))

    await handler(req, res)

    // Verify response
    expect(res._getStatusCode()).toBe(200)
    expect(JSON.parse(res._getData())).toEqual({
      success: true,
      campaignId: 'test-campaign-id',
      totalRecipients: 1,
      failedCount: 1,
    })
  })
}) 