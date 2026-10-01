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
            A Solana voting prototype with client-encrypted ballots and public poll activity
          </p>
          <p className="text-sm text-muted-foreground">
            Prototype only: transactions can link voter addresses to ballot accounts, and published tallies are not verified against ballots.
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

        {/* Protocol Notes Card */}
        <div className="max-w-md mx-auto mt-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Protocol Notes</CardTitle>
              <CardDescription>
                Read what the current program records and what its privacy and tally limits are
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => router.push('/audit')}
                variant="outline"
                className="w-full"
              >
                View Protocol Notes
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-4 pt-8">
          <div className="text-center space-y-2">
            <h3 className="font-semibold">Encrypted Votes</h3>
            <p className="text-sm text-muted-foreground">
              Ballot contents are encrypted before submission; transaction metadata remains public
            </p>
          </div>
          <div className="text-center space-y-2">
            <h3 className="font-semibold">On-Chain Storage</h3>
            <p className="text-sm text-muted-foreground">
              Polls, encrypted ballot data, events, and submitted results are written to Solana
            </p>
          </div>
          <div className="text-center space-y-2">
            <h3 className="font-semibold">Public Events</h3>
            <p className="text-sm text-muted-foreground">
              Program events expose poll, voter-registration, vote-cast, and result-publication activity
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
