import { useState } from 'react'
import { useSession } from 'next-auth/react'

export default function EmailCampaign() {
  const { data: session } = useSession()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [recipients, setRecipients] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setResult(null)

    try {
      const recipientList = recipients
        .split(',')
        .map(email => email.trim())
        .filter(email => email.includes('@'))

      const response = await fetch('/api/email/campaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject,
          body,
          recipients: recipientList,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send campaign')
      }

      setResult(data)
      // Clear form on success
      setSubject('')
      setBody('')
      setRecipients('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (!session) {
    return <div>Please sign in to send email campaigns.</div>
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label 
            htmlFor="subject" 
            className="block text-sm font-medium text-gray-700"
          >
            Subject
          </label>
          <input
            type="text"
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label 
            htmlFor="body" 
            className="block text-sm font-medium text-gray-700"
          >
            Email Body (HTML)
          </label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            rows={6}
            required
          />
        </div>

        <div>
          <label 
            htmlFor="recipients" 
            className="block text-sm font-medium text-gray-700"
          >
            Recipients (comma-separated)
          </label>
          <textarea
            id="recipients"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            rows={3}
            placeholder="email1@example.com, email2@example.com"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isLoading ? 'Sending...' : 'Send Campaign'}
        </button>
      </form>

      {error && (
        <div className="mt-4 text-red-600">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-green-50 text-green-800 rounded-md">
          <h3 className="font-medium">Campaign Sent Successfully!</h3>
          <p>Campaign ID: {result.campaignId}</p>
          <p>Total Recipients: {result.totalRecipients}</p>
          <p>Failed: {result.failedCount}</p>
        </div>
      )}
    </div>
  )
} 