'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletButton } from '@/components/solana/solana-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useVotingProgram } from '@/components/voting/voting-data-access'
import * as nacl from 'tweetnacl'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'

export default function PollPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const pollId = parseInt(resolvedParams.id)
  const router = useRouter()
  const { publicKey } = useWallet()
  
  const { usePoll, useVoterRegistry, useResults, vote } = useVotingProgram()
  
  const { data: poll, isLoading: pollLoading } = usePoll(pollId)
  const { data: voterRegistry, isLoading: registryLoading } = useVoterRegistry(pollId, publicKey?.toString() ?? '')
  const { data: results } = useResults(pollId)
  
  const [selectedCandidate, setSelectedCandidate] = useState('')
  const [isVoting, setIsVoting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const encryptVote = (candidate: string, publicKey: Uint8Array): Buffer => {
    const message = Buffer.from(candidate)
    const nonce = nacl.randomBytes(24)
    const ephemeralKeypair = nacl.box.keyPair()
    const encrypted = nacl.box(message, nonce, publicKey, ephemeralKeypair.secretKey)
    
    return Buffer.concat([
      Buffer.from(ephemeralKeypair.publicKey),
      Buffer.from(nonce),
      Buffer.from(encrypted)
    ])
  }

  const handleVote = async () => {
    if (!selectedCandidate || !poll) return
    
    setIsVoting(true)
    setError('')

    try {
      // Generate random nullifier for anonymous vote account
      const nullifier = new Uint8Array(32)
      crypto.getRandomValues(nullifier)
      
      // Encrypt the vote
      const tallierPubkey = new Uint8Array(poll.tallierPubkey as any)
      const encryptedVote = encryptVote(selectedCandidate, tallierPubkey)
      
      await vote.mutateAsync({
        pollId,
        nullifier: Array.from(nullifier),
        encryptedVote,
      })
      
      setSuccess(true)
    } catch (err: any) {
      console.error('Error voting:', err)
      setError(err.message || 'Failed to submit vote')
    } finally {
      setIsVoting(false)
    }
  }

  const now = Date.now() / 1000
  const votingStarted = poll && now >= Number(poll.pollVotingStart)
  const votingEnded = poll && now > Number(poll.pollVotingEnd)
  const hasVoted = voterRegistry?.hasVoted
  const isRegistered = voterRegistry?.registered

  if (pollLoading || registryLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p>Loading poll...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!poll) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card>
          <CardHeader>
            <CardTitle>Poll Not Found</CardTitle>
            <CardDescription>Poll ID {pollId} does not exist</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/')}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!publicKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card>
          <CardHeader>
            <CardTitle>Connect Wallet</CardTitle>
            <CardDescription>Connect your wallet to participate in this poll</CardDescription>
          </CardHeader>
          <CardContent>
            <WalletButton />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show results if voting ended and results are published
  if (votingEnded && results) {
    return (
      <div className="min-h-screen p-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <Button onClick={() => router.push('/')} variant="outline" size="sm">
              ← Back
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{poll.pollName}</CardTitle>
              <CardDescription>Voting has ended - Results below</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📊 Final Results</CardTitle>
              <CardDescription>
                Total votes: {results.totalVotes.toString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.results
                .sort((a: any, b: any) => Number(b.voteCount) - Number(a.voteCount))
                .map((result: any, index: number) => {
                  const percentage = results.totalVotes > 0 
                    ? ((Number(result.voteCount) / Number(results.totalVotes)) * 100).toFixed(1)
                    : '0'
                  
                  const medals = ['🥇', '🥈', '🥉']
                  const medal = index < 3 ? medals[index] : '  '
                  
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{medal}</span>
                          <span className="font-semibold">{result.candidateName}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{percentage}%</div>
                          <div className="text-sm text-muted-foreground">
                            {result.voteCount.toString()} votes
                          </div>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </CardContent>
          </Card>

          {hasVoted && (
            <Alert>
              <AlertDescription>
                ✅ You voted in this poll. Your vote was counted in the results above.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>✅ Vote Submitted!</CardTitle>
            <CardDescription>Your encrypted vote has been recorded on-chain</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                Your vote for <strong>{selectedCandidate}</strong> has been encrypted and stored on the Solana blockchain.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Button onClick={() => router.push('/')} className="w-full">
                Go Home
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
                View Poll Status
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Voting not started yet
  if (!votingStarted) {
    const startDate = new Date(Number(poll.pollVotingStart) * 1000)
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{poll.pollName}</CardTitle>
            <CardDescription>Voting has not started yet</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                Voting will begin on {startDate.toLocaleString()}
              </AlertDescription>
            </Alert>
            <Button onClick={() => router.push('/')} className="w-full">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Voting ended but results not published yet
  if (votingEnded && !results) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{poll.pollName}</CardTitle>
            <CardDescription>Voting has ended</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                The poll admin is tallying the encrypted votes. Results will be published soon.
              </AlertDescription>
            </Alert>
            {hasVoted && (
              <Alert>
                <AlertDescription>
                  ✅ You voted in this poll
                </AlertDescription>
              </Alert>
            )}
            <Button onClick={() => router.push('/')} className="w-full">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Not registered
  if (!isRegistered) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{poll.pollName}</CardTitle>
            <CardDescription>You are not registered to vote in this poll</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>
                Only registered voters can participate. Contact the poll administrator to get registered.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Your wallet: {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
              </div>
            </div>
            <Button onClick={() => router.push('/')} className="w-full">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Already voted
  if (hasVoted) {
    const endDate = new Date(Number(poll.pollVotingEnd) * 1000)
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{poll.pollName}</CardTitle>
            <CardDescription>You have already voted in this poll</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                ✅ Your encrypted vote has been recorded. Results will be available after voting ends on {endDate.toLocaleString()}.
              </AlertDescription>
            </Alert>
            <Button onClick={() => router.push('/')} className="w-full">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main voting interface
  const endDate = new Date(Number(poll.pollVotingEnd) * 1000)
  const timeRemaining = Math.max(0, Number(poll.pollVotingEnd) - now)
  const hoursRemaining = Math.floor(timeRemaining / 3600)
  const minutesRemaining = Math.floor((timeRemaining % 3600) / 60)

  return (
    <div className="min-h-screen p-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Button onClick={() => router.push('/')} variant="outline" size="sm">
            ← Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{poll.pollName}</CardTitle>
            <CardDescription>{poll.pollDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Time remaining</span>
              <span className="font-semibold">
                {hoursRemaining}h {minutesRemaining}m
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Ends</span>
              <span>{endDate.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Cast Your Vote</CardTitle>
            <CardDescription>
              Your vote will be encrypted before being stored on-chain
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={selectedCandidate} onValueChange={setSelectedCandidate}>
              {poll.candidates.map((candidate: string, index: number) => (
                <div key={index} className="flex items-center space-x-2 border rounded-lg p-4 hover:bg-muted cursor-pointer">
                  <RadioGroupItem value={candidate} id={`candidate-${index}`} />
                  <Label htmlFor={`candidate-${index}`} className="flex-1 cursor-pointer">
                    {candidate}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <Button
              onClick={handleVote}
              disabled={!selectedCandidate || isVoting}
              className="w-full"
              size="lg"
            >
              {isVoting ? 'Submitting...' : '🔒 Submit Encrypted Vote'}
            </Button>

            <div className="text-xs text-muted-foreground text-center">
              🔐 Your vote will be encrypted with TweetNaCl before submission
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
