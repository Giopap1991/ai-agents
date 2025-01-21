import { useState } from 'react'
import { useSession } from 'next-auth/react'

export default function PresentationGenerator() {
  const { data: session } = useSession()
  const [topic, setTopic] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/presentation/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate presentation')
      }

      setResult(data)
      setTopic('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (!session) {
    return <div>Please sign in to generate presentations.</div>
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label 
            htmlFor="topic" 
            className="block text-sm font-medium text-gray-700"
          >
            Presentation Topic
          </label>
          <textarea
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            rows={3}
            placeholder="Enter your presentation topic..."
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isLoading ? 'Generating...' : 'Generate Presentation'}
        </button>
      </form>

      {error && (
        <div className="mt-4 text-red-600">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-green-50 text-green-800 rounded-md">
          <h3 className="font-medium">Presentation Generated Successfully!</h3>
          <p>Presentation ID: {result.presentationId}</p>
          <a 
            href={result.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-indigo-600 hover:text-indigo-500"
          >
            Download PDF
          </a>
          <div className="mt-4">
            <h4 className="font-medium">Preview:</h4>
            <div className="mt-2 space-y-4">
              {result.content.slides.map((slide: any, index: number) => (
                <div key={index} className="border rounded p-4">
                  <h5 className="font-medium">{slide.title}</h5>
                  <ul className="mt-2 list-disc list-inside">
                    {slide.points.map((point: string, i: number) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 