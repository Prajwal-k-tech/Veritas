'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletButton } from '@/components/solana/solana-provider'
import { PublicKey } from '@solana/web3.js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useVotingProgram } from '@/components/voting/voting-data-access'
import Papa from 'papaparse'
import nacl from 'tweetnacl'

export default function ManagePollPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const pollId = parseInt(resolvedParams.id)
  const router = useRouter()
  const { publicKey } = useWallet()
  
  const { usePoll, registerVoter } = useVotingProgram()
  const { data: poll, isLoading: pollLoading } = usePoll(pollId)
  
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [voters, setVoters] = useState<string[]>([])
  const [isRegistering, setIsRegistering] = useState(false)
  const [registrationProgress, setRegistrationProgress] = useState(0)
  const [registrationResults, setRegistrationResults] = useState<{ success: number; failed: number; errors: string[] }>({
    success: 0,
    failed: 0,
    errors: []
  })
  const [error, setError] = useState('')
  const [manualVoter, setManualVoter] = useState('')
  
  // Tally & Publish state
  const [encryptionKey, setEncryptionKey] = useState<Uint8Array | null>(null)
  const [isTallying, setIsTallying] = useState(false)
  const [tallyResults, setTallyResults] = useState<{ candidate: string; votes: number }[] | null>(null)
  const [tallyError, setTallyError] = useState('')

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setCsvFile(file)
    setError('')
    
    Papa.parse(file, {
      complete: (results) => {
        try {
          const voterAddresses: string[] = []
          
          // Parse CSV - expect one public key per row
          results.data.forEach((row: any, index) => {
            if (Array.isArray(row) && row.length > 0) {
              const address = row[0].trim()
              if (address) {
                // Validate it's a valid public key
                try {
                  new PublicKey(address)
                  voterAddresses.push(address)
                } catch (err) {
                  console.warn(`Row ${index + 1}: Invalid public key: ${address}`)
                }
              }
            }
          })
          
          setVoters(voterAddresses)
          setError('')
        } catch (err: any) {
          setError('Failed to parse CSV file. Make sure each row contains a valid Solana public key.')
        }
      },
      error: (error) => {
        setError(`CSV parsing error: ${error.message}`)
      }
    })
  }

  const handleBatchRegister = async () => {
    if (voters.length === 0) return
    
    setIsRegistering(true)
    setRegistrationProgress(0)
    setRegistrationResults({ success: 0, failed: 0, errors: [] })
    
    let successCount = 0
    let failedCount = 0
    const errors: string[] = []
    
    for (let i = 0; i < voters.length; i++) {
      try {
        const voterPubkey = new PublicKey(voters[i])
        await registerVoter.mutateAsync({
          pollId,
          voter: voterPubkey
        })
        successCount++
      } catch (err: any) {
        failedCount++
        const errorMsg = `${voters[i].slice(0, 8)}...: ${err.message || 'Unknown error'}`
        errors.push(errorMsg)
        console.error(`Failed to register ${voters[i]}:`, err)
      }
      
      setRegistrationProgress(((i + 1) / voters.length) * 100)
      setRegistrationResults({ success: successCount, failed: failedCount, errors })
    }
    
    setIsRegistering(false)
  }

  // Check admin access
  if (pollLoading) {
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

  // Admin access control
  if (!publicKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card>
          <CardHeader>
            <CardTitle>Connect Wallet</CardTitle>
            <CardDescription>Connect your wallet to manage this poll</CardDescription>
          </CardHeader>
          <CardContent>
            <WalletButton />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (poll.admin.toString() !== publicKey.toString()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only the poll admin can manage this poll</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                <strong>Poll Admin:</strong><br />
                <code className="text-xs break-all">{poll.admin.toString()}</code>
              </AlertDescription>
            </Alert>
            <Alert>
              <AlertDescription>
                <strong>Your Wallet:</strong><br />
                <code className="text-xs break-all">{publicKey.toString()}</code>
              </AlertDescription>
            </Alert>
            <Button onClick={() => router.push(`/poll/${pollId}`)} className="w-full">
              View Poll Instead
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleManualRegister = async () => {
    if (!manualVoter.trim()) return
    
    setError('')
    try {
      const voterPubkey = new PublicKey(manualVoter.trim())
      await registerVoter.mutateAsync({
        pollId,
        voter: voterPubkey
      })
      
      setManualVoter('')
      setRegistrationResults(prev => ({
        success: prev.success + 1,
        failed: prev.failed,
        errors: prev.errors
      }))
    } catch (err: any) {
      setError(err.message || 'Failed to register voter')
    }
  }

  const handleKeyUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const keyArray = JSON.parse(text)
        if (Array.isArray(keyArray) && keyArray.length === 32) {
          setEncryptionKey(new Uint8Array(keyArray))
          setTallyError('')
        } else {
          setTallyError('Invalid encryption key format. Expected 32-byte array.')
        }
      } catch (err) {
        setTallyError('Failed to parse encryption key file.')
      }
    }
    reader.readAsText(file)
  }

  const handleTallyAndPublish = async () => {
    if (!encryptionKey || !poll) return

    setIsTallying(true)
    setTallyError('')
    setTallyResults(null)

    try {
      const { program, publishResults } = useVotingProgram()
      if (!program) {
        throw new Error('Program not initialized')
      }
      
      const connection = program.provider.connection

      // Fetch all VoteAccount PDAs for this poll (ANONYMOUS - no voter identity!)
      const accounts = await connection.getProgramAccounts(program.programId, {
        filters: [
          {
            memcmp: {
              offset: 8, // After discriminator
              bytes: pollId.toString(),
            },
          },
        ],
      })

      const voteCounts: Record<string, number> = {}
      poll.candidates.forEach((candidate: string) => {
        voteCounts[candidate] = 0
      })

      // Decrypt each vote - Admin CANNOT determine which voter cast which vote!
      for (const account of accounts) {
        try {
          const voteData = program.coder.accounts.decode('VoteAccount', account.account.data)
          if (!voteData.encryptedVote) continue

          const encryptedVote = Buffer.from(voteData.encryptedVote)
          
          // Format: ephemeralPublicKey (32) + nonce (24) + encrypted message
          const ephemeralPublicKey = encryptedVote.slice(0, 32)
          const nonce = encryptedVote.slice(32, 56)
          const ciphertext = encryptedVote.slice(56)

          const sharedSecret = nacl.box.before(ephemeralPublicKey, encryptionKey)
          const decrypted = nacl.box.open.after(ciphertext, nonce, sharedSecret)

          if (decrypted) {
            const candidateName = new TextDecoder().decode(decrypted)
            if (voteCounts[candidateName] !== undefined) {
              voteCounts[candidateName]++
            }
          }
        } catch (err) {
          console.warn('Failed to decrypt a vote:', err)
        }
      }

      const results = Object.entries(voteCounts).map(([candidate, votes]) => ({
        candidate,
        votes,
      }))

      setTallyResults(results)

      // Auto-publish results - Import BN for vote counts
      const BN = (await import('bn.js')).default
      await publishResults.mutateAsync({
        pollId,
        results: results.map((r) => ({ 
          candidateName: r.candidate, 
          voteCount: new BN(r.votes) 
        })),
      })

    } catch (err: any) {
      setTallyError(err.message || 'Failed to tally and publish results')
    } finally {
      setIsTallying(false)
    }
  }

  if (pollLoading) {
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
            <CardDescription>Connect your wallet to manage this poll</CardDescription>
          </CardHeader>
          <CardContent>
            <WalletButton />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check if connected wallet is the admin
  const isAdmin = poll.admin.toString() === publicKey.toString()
  
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only the poll administrator can access this page</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>
                You are not the administrator of this poll.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                <div>Your wallet: {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}</div>
                <div>Poll admin: {poll.admin.toString().slice(0, 8)}...{poll.admin.toString().slice(-8)}</div>
              </div>
            </div>
            <Button onClick={() => router.push(`/poll/${pollId}`)} className="w-full">
              View Poll
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const startDate = new Date(Number(poll.pollVotingStart) * 1000)
  const endDate = new Date(Number(poll.pollVotingEnd) * 1000)

  return (
    <div className="min-h-screen p-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <Button onClick={() => router.push(`/poll/${pollId}`)} variant="outline" size="sm">
            ← Back to Poll
          </Button>
          <Button onClick={() => router.push('/')} variant="ghost" size="sm">
            Home
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Manage Poll: {poll.pollName}</CardTitle>
            <CardDescription>Register voters for this poll</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Poll ID:</span>
                <span className="ml-2 font-semibold">{pollId}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Candidates:</span>
                <span className="ml-2 font-semibold">{poll.candidates.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Voting Start:</span>
                <span className="ml-2">{startDate.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Voting End:</span>
                <span className="ml-2">{endDate.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Manual Registration */}
        <Card>
          <CardHeader>
            <CardTitle>Register Single Voter</CardTitle>
            <CardDescription>Enter a voter's public key to register them</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Voter public key (e.g., 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU)"
                value={manualVoter}
                onChange={(e) => setManualVoter(e.target.value)}
                disabled={isRegistering}
              />
              <Button
                onClick={handleManualRegister}
                disabled={!manualVoter.trim() || isRegistering}
              >
                Register
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Batch Registration */}
        <Card>
          <CardHeader>
            <CardTitle>Batch Register Voters</CardTitle>
            <CardDescription>
              Upload a CSV file with one public key per row
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-upload">CSV File</Label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isRegistering}
              />
              {csvFile && voters.length > 0 && (
                <Alert>
                  <AlertDescription>
                    ✅ Parsed {voters.length} valid voter address{voters.length !== 1 ? 'es' : ''} from CSV
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {voters.length > 0 && (
              <div className="space-y-4">
                <Button
                  onClick={handleBatchRegister}
                  disabled={isRegistering}
                  className="w-full"
                  size="lg"
                >
                  {isRegistering ? `Registering... (${Math.round(registrationProgress)}%)` : `Register ${voters.length} Voters`}
                </Button>

                {isRegistering && (
                  <div className="space-y-2">
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${registrationProgress}%` }}
                      />
                    </div>
                    <div className="text-center text-sm text-muted-foreground">
                      {registrationResults.success + registrationResults.failed} / {voters.length} processed
                    </div>
                  </div>
                )}

                {registrationResults.success > 0 && (
                  <Alert>
                    <AlertDescription>
                      ✅ Successfully registered {registrationResults.success} voter{registrationResults.success !== 1 ? 's' : ''}
                      {registrationResults.failed > 0 && ` • ❌ ${registrationResults.failed} failed`}
                    </AlertDescription>
                  </Alert>
                )}

                {registrationResults.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      <div className="font-semibold mb-2">Registration Errors:</div>
                      <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
                        {registrationResults.errors.map((err, i) => (
                          <div key={i}>• {err}</div>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Voter List */}
                <div className="border rounded-lg p-4">
                  <div className="font-semibold mb-2">Voters to Register:</div>
                  <div className="max-h-48 overflow-y-auto space-y-1 text-sm font-mono">
                    {voters.map((voter, i) => (
                      <div key={i} className="text-muted-foreground">
                        {i + 1}. {voter}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>ℹ️ CSV Format</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Your CSV file should have one Solana public key per row:
            </p>
            <div className="bg-muted p-3 rounded text-xs font-mono">
              7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU<br />
              9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin<br />
              5ZWj7a1f8tWkjBESHKgrLmXshuXxqeY9SYcfbshpAqPG
            </div>
            <p className="text-xs text-muted-foreground">
              Invalid addresses will be skipped automatically.
            </p>
          </CardContent>
        </Card>

        {/* Tally & Publish Results */}
        {Date.now() > endDate.getTime() && (
          <Card>
            <CardHeader>
              <CardTitle>Tally & Publish Results</CardTitle>
              <CardDescription>
                Voting has ended. Upload the encryption key to decrypt votes and publish final results.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key-upload">Encryption Key (JSON file)</Label>
                <Input
                  id="key-upload"
                  type="file"
                  accept=".json"
                  onChange={handleKeyUpload}
                  disabled={isTallying}
                />
                {encryptionKey && (
                  <Alert>
                    <AlertDescription>
                      ✅ Encryption key loaded ({encryptionKey.length} bytes)
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {tallyError && (
                <Alert variant="destructive">
                  <AlertDescription>{tallyError}</AlertDescription>
                </Alert>
              )}

              {tallyResults && (
                <div className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      <strong>✅ Results Published to Blockchain</strong>
                    </AlertDescription>
                  </Alert>
                  <div className="border rounded-lg p-4">
                    <div className="font-semibold mb-3">Final Results:</div>
                    <div className="space-y-2">
                      {tallyResults.map((result, i) => (
                        <div key={i} className="flex justify-between items-center p-2 bg-muted rounded">
                          <span className="font-medium">{result.candidate}</span>
                          <span className="text-lg font-bold">{result.votes} votes</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleTallyAndPublish}
                disabled={!encryptionKey || isTallying || !!tallyResults}
                className="w-full"
                size="lg"
              >
                {isTallying ? 'Decrypting & Publishing...' : tallyResults ? 'Results Published ✓' : 'Tally & Publish Results'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
