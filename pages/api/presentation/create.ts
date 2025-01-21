import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import puppeteer from 'puppeteer'
import path from 'path'
import fs from 'fs/promises'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface PresentationRequest {
  topic: string
}

interface Slide {
  title: string
  points: string[]
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

    const { topic }: PresentationRequest = req.body

    if (!topic) {
      return res.status(400).json({ message: 'Topic is required' })
    }

    // Create initial presentation record
    const presentation = await prisma.presentation.create({
      data: {
        userId: session.user.id,
        topic,
        status: 'GENERATING',
        content: {},
      },
    })

    // Generate presentation content using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `Create a presentation outline for the topic. 
          Format as JSON with an array of slides. 
          Each slide should have a title and bullet points.
          Include 5-7 slides including an introduction and conclusion.
          Keep points concise and impactful.`
        },
        {
          role: 'user',
          content: topic
        }
      ]
    })

    const presentationContent = JSON.parse(
      completion.choices[0].message.content || '{}'
    ) as { slides: Slide[] }

    // Generate HTML for the presentation
    const html = generatePresentationHtml(topic, presentationContent.slides)

    // Launch Puppeteer and generate PDF
    const browser = await puppeteer.launch({ headless: 'new' })
    const page = await browser.newPage()
    await page.setContent(html)

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    await fs.mkdir(uploadsDir, { recursive: true })

    // Generate PDF
    const pdfPath = path.join(uploadsDir, `presentation-${presentation.id}.pdf`)
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
    })

    await browser.close()

    // Update presentation record with content and PDF URL
    const pdfUrl = `/uploads/presentation-${presentation.id}.pdf`
    await prisma.presentation.update({
      where: { id: presentation.id },
      data: {
        content: presentationContent,
        pdfUrl,
        status: 'COMPLETED'
      }
    })

    return res.status(200).json({
      success: true,
      presentationId: presentation.id,
      pdfUrl,
      content: presentationContent
    })

  } catch (error) {
    console.error('Presentation Error:', error)
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

function generatePresentationHtml(topic: string, slides: Slide[]): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
          }
          .slide {
            page-break-after: always;
            padding: 40px;
            height: 90vh;
            position: relative;
          }
          .slide-title {
            font-size: 32px;
            color: #333;
            margin-bottom: 40px;
          }
          .slide-content {
            font-size: 24px;
          }
          ul {
            margin: 0;
            padding-left: 25px;
          }
          li {
            margin-bottom: 15px;
          }
        </style>
      </head>
      <body>
        <div class="slide">
          <h1 class="slide-title" style="font-size: 40px; text-align: center;">
            ${topic}
          </h1>
        </div>
        ${slides.map(slide => `
          <div class="slide">
            <h2 class="slide-title">${slide.title}</h2>
            <div class="slide-content">
              <ul>
                ${slide.points.map(point => `
                  <li>${point}</li>
                `).join('')}
              </ul>
            </div>
          </div>
        `).join('')}
      </body>
    </html>
  `
} 