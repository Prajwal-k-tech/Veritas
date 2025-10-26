'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletButton } from '@/components/solana/solana-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useVotingProgram } from '@/components/voting/voting-data-access'
import * as nacl from 'tweetnacl'
import { BN } from '@coral-xyz/anchor'

export default function CreatePollPage() {
  const router = useRouter()
  const { publicKey } = useWallet()
  const { connection } = useConnection()
  const { initializeCounter, initializePoll, program, getCounterPDA } = useVotingProgram()

  const [pollName, setPollName] = useState('')
  const [description, setDescription] = useState('')
  const [candidates, setCandidates] = useState(['', ''])
  
  // Default end time to 1 day from now IN LOCAL TIME
  // CRITICAL: datetime-local input expects local time format WITHOUT timezone conversion
  const getDefaultEndTime = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1) // 1 day from now
    tomorrow.setSeconds(0, 0)
    
    // Format as YYYY-MM-DDTHH:mm using LOCAL time (not UTC!)
    const year = tomorrow.getFullYear()
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const day = String(tomorrow.getDate()).padStart(2, '0')
    const hours = String(tomorrow.getHours()).padStart(2, '0')
    const minutes = String(tomorrow.getMinutes()).padStart(2, '0')
    
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }
  
  const [endTime, setEndTime] = useState(getDefaultEndTime())
  const [encryptionKeypair, setEncryptionKeypair] = useState<nacl.BoxKeyPair | null>(null)
  const [createdPollId, setCreatedPollId] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const generateEncryptionKey = () => {
    const keypair = nacl.box.keyPair()
    setEncryptionKeypair(keypair)
  }

  const downloadPrivateKey = () => {
    if (!encryptionKeypair) return
    
    const keyData = {
      publicKey: Array.from(encryptionKeypair.publicKey),
      secretKey: Array.from(encryptionKeypair.secretKey),
    }
    
    const blob = new Blob([JSON.stringify(keyData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `poll-encryption-key-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const addCandidate = () => {
    if (candidates.length < 10) {
      setCandidates([...candidates, ''])
    }
  }

  const removeCandidate = (index: number) => {
    if (candidates.length > 2) {
      setCandidates(candidates.filter((_, i) => i !== index))
    }
  }

  const updateCandidate = (index: number, value: string) => {
    const newCandidates = [...candidates]
    newCandidates[index] = value
    setCandidates(newCandidates)
  }

  const createPoll = async () => {
    if (!publicKey || !encryptionKeypair) return
    
    setIsCreating(true)
    setError('')

    try {
      // Validate inputs - filter empty and TRIM whitespace
      const filledCandidates = candidates
        .filter(c => c.trim())
        .map(c => c.trim())
      
      if (filledCandidates.length < 2) {
        throw new Error('Need at least 2 candidates')
      }
      if (filledCandidates.length > 10) {
        throw new Error('Maximum 10 candidates allowed')
      }

      // End time from user input (datetime-local)
      // Start time is automatically set to NOW by the smart contract
      const end = new Date(endTime).getTime() / 1000
      const now = Math.floor(Date.now() / 1000)

      if (end <= now) {
        throw new Error('End time must be in the future')
      }

      // Try to initialize counter first (might fail if already initialized)
      try {
        const txSig = await initializeCounter.mutateAsync()
        // Wait for confirmation
        await connection.confirmTransaction(txSig, 'confirmed')
        console.log('Counter initialized successfully')
      } catch (e: any) {
        // Counter might already exist, which is fine
        if (e.message?.includes('already in use')) {
          console.log('Counter already initialized (this is ok)')
        } else {
          console.log('Counter initialization error (might be ok):', e.message)
        }
      }

      // Create poll (start time is automatically set to NOW by blockchain)
      const result = await initializePoll.mutateAsync({
        endTime: new BN(end),
        name: pollName,
        description: description,
        candidates: filledCandidates,
        tallierPubkey: Array.from(encryptionKeypair.publicKey),
      })

      // CRITICAL: Wait for transaction confirmation
      await connection.confirmTransaction(result.txSig, 'confirmed')

      // Use the poll ID returned from the mutation
      setCreatedPollId(result.pollId)

    } catch (err: any) {
      console.error('Error creating poll:', err)
      setError(err.message || 'Failed to create poll')
    } finally {
      setIsCreating(false)
    }
  }

  if (!publicKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card>
          <CardHeader>
            <CardTitle>Connect Wallet</CardTitle>
            <CardDescription>Connect your wallet to create a poll</CardDescription>
          </CardHeader>
          <CardContent>
            <WalletButton />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (createdPollId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>✅ Poll Created!</CardTitle>
            <CardDescription>Your voting poll is now live on Solana</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Poll ID</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {createdPollId}
              </p>
            </div>

            <Alert>
              <AlertDescription>
                <strong>Important:</strong> Download your encryption key to decrypt votes later!
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Button onClick={downloadPrivateKey} className="w-full" variant="outline">
                📥 Download Encryption Key
              </Button>
              <Button onClick={() => router.push(`/poll/${createdPollId}`)} className="w-full">
                View Poll
              </Button>
              <Button onClick={() => router.push(`/manage/${createdPollId}`)} className="w-full" variant="secondary">
                Manage Poll (Register Voters)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Create New Poll</h1>
          <p className="text-muted-foreground">Set up your encrypted voting poll</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Poll Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pollName">Poll Name</Label>
              <Input
                id="pollName"
                placeholder="e.g., Class President Election"
                value={pollName}
                onChange={(e) => setPollName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What is this poll about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">Voting End Time</Label>
              <Input
                id="endTime"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Poll will start immediately when created. Set when voting should end.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Candidates (max 10)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {candidates.map((candidate, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder={`Candidate ${index + 1}`}
                  value={candidate}
                  onChange={(e) => updateCandidate(index, e.target.value)}
                  maxLength={32}
                />
                {candidates.length > 2 && (
                  <Button
                    onClick={() => removeCandidate(index)}
                    variant="destructive"
                    size="icon"
                  >
                    ✕
                  </Button>
                )}
              </div>
            ))}
            {candidates.length < 10 && (
              <Button onClick={addCandidate} variant="outline" className="w-full">
                + Add Candidate
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Encryption Key</CardTitle>
            <CardDescription>
              Generate a keypair to encrypt votes. Keep the private key safe!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!encryptionKeypair ? (
              <Button onClick={generateEncryptionKey} className="w-full">
                🔑 Generate Encryption Key
              </Button>
            ) : (
              <div className="space-y-2">
                <Alert>
                  <AlertDescription>
                    ✅ Encryption key generated! Download it after creating the poll.
                  </AlertDescription>
                </Alert>
                <div className="bg-muted p-3 rounded text-xs font-mono break-all">
                  Public Key: {Buffer.from(encryptionKeypair.publicKey).toString('hex').slice(0, 32)}...
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button onClick={() => router.push('/')} variant="outline" className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={createPoll}
            disabled={!encryptionKeypair || !pollName || !endTime || isCreating}
            className="flex-1"
          >
            {isCreating ? 'Creating...' : 'Create Poll'}
          </Button>
        </div>
      </div>
    </div>
  )
}
