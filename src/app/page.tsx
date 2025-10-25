'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  const router = useRouter()
  const [pollId, setPollId] = useState('')

  const handleEnterPoll = () => {
    if (pollId.trim()) {
      router.push(`/poll/${pollId}`)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Veritas</h1>
          <p className="text-muted-foreground">
            Secure, encrypted, on-chain voting powered by Solana
          </p>
        </div>

        {/* Main Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Create Poll Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Create Poll</CardTitle>
              <CardDescription>
                Set up a new voting poll with encrypted ballots
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => router.push('/create')}
                className="w-full"
                size="lg"
              >
                Create New Poll
              </Button>
            </CardContent>
          </Card>

          {/* Enter Poll Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Enter Poll</CardTitle>
              <CardDescription>
                Vote in an existing poll using your poll ID
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="number"
                placeholder="Enter Poll ID (e.g., 1)"
                value={pollId}
                onChange={(e) => setPollId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEnterPoll()}
              />
              <Button 
                onClick={handleEnterPoll}
                className="w-full"
                size="lg"
                disabled={!pollId.trim()}
              >
                Go to Poll
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Audit Log Card */}
        <div className="max-w-md mx-auto mt-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>
                View all blockchain events and verify poll integrity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => router.push('/audit')}
                variant="outline"
                className="w-full"
              >
                View Audit Log
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-4 pt-8">
          <div className="text-center space-y-2">
            <h3 className="font-semibold">Encrypted Votes</h3>
            <p className="text-sm text-muted-foreground">
              Votes encrypted with TweetNaCl before submission
            </p>
          </div>
          <div className="text-center space-y-2">
            <h3 className="font-semibold">On-Chain Storage</h3>
            <p className="text-sm text-muted-foreground">
              All data stored permanently on Solana blockchain
            </p>
          </div>
          <div className="text-center space-y-2">
            <h3 className="font-semibold">Audit Trail</h3>
            <p className="text-sm text-muted-foreground">
              Complete timeline of all voting events
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
