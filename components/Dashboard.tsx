import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface Task {
  id: string
  type: string
  prompt: string
  response: string
  createdAt: string
  status: string
}

export default function Dashboard() {
  const { data: session } = useSession()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (session?.user) {
      fetchTasks()
    }
  }, [session])

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks/list')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message)
      }

      setTasks(data.tasks)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks')
    } finally {
      setLoading(false)
    }
  }

  if (!session) {
    return <div>Please sign in to view your dashboard.</div>
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div className="text-red-600">{error}</div>
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Task Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tasks.map((task) => (
          <div 
            key={task.id} 
            className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="inline-block px-2 py-1 text-sm rounded-full bg-gray-100">
                {task.type}
              </span>
              <span className="text-sm text-gray-500">
                {new Date(task.createdAt).toLocaleDateString()}
              </span>
            </div>
            
            <p className="font-medium mb-2 line-clamp-2">{task.prompt}</p>
            
            <div className="mt-4">
              {task.type === 'EMAIL' && (
                <EmailTaskDetails task={task} />
              )}
              {task.type === 'PRESENTATION' && (
                <PresentationTaskDetails task={task} />
              )}
              {task.type === 'GENERAL' && (
                <GeneralTaskDetails task={task} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmailTaskDetails({ task }: { task: Task }) {
  const response = JSON.parse(task.response)
  return (
    <div>
      <p>Recipients: {response.totalRecipients}</p>
      <p>Failed: {response.failedCount}</p>
      {response.campaignId && (
        <a 
          href={`/campaigns/${response.campaignId}`}
          className="text-indigo-600 hover:text-indigo-500"
        >
          View Campaign
        </a>
      )}
    </div>
  )
}

function PresentationTaskDetails({ task }: { task: Task }) {
  const response = JSON.parse(task.response)
  return (
    <div>
      {response.pdfUrl && (
        <a
          href={response.pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-500"
        >
          Download Presentation
        </a>
      )}
    </div>
  )
}

function GeneralTaskDetails({ task }: { task: Task }) {
  return (
    <div className="prose prose-sm">
      <div className="whitespace-pre-wrap">
        {task.response}
      </div>
    </div>
  )
} 