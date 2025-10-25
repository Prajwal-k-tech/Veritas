'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AuditLogPage() {
  return (
    <div className="min-h-screen p-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <Button onClick={() => window.history.back()} variant="outline" size="sm">
            Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Blockchain Audit Trail</CardTitle>
            <CardDescription>
              Understanding how Veritas records voting events on the Solana blockchain
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What Are Blockchain Events?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              Every action in Veritas is recorded as an immutable event on the Solana blockchain. 
              These events provide a transparent, tamper-proof audit trail that anyone can verify.
            </p>
            <p>
              The smart contract emits four types of events using Anchor's <code className="bg-muted px-1 py-0.5 rounded">emit!</code> macro:
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Event Types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* PollCreatedEvent */}
            <div className="space-y-3">
              <h3 className="font-semibold text-base">1. PollCreatedEvent</h3>
              <p className="text-sm text-muted-foreground">Emitted when a new poll is initialized.</p>
              <div className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto">
                <pre>{`#[event]
pub struct PollCreatedEvent {
    pub poll_id: u64,
    pub poll_name: String,
    pub admin: Pubkey,
    pub candidates: Vec<String>,
    pub voting_start: i64,
    pub voting_end: i64,
}

// Emitted in initialize_poll instruction:
emit!(PollCreatedEvent {
    poll_id: counter.next_poll_id,
    poll_name: poll_name.clone(),
    admin: admin.key(),
    candidates: candidates.clone(),
    voting_start,
    voting_end,
});`}</pre>
              </div>
            </div>

            {/* VoterRegisteredEvent */}
            <div className="space-y-3">
              <h3 className="font-semibold text-base">2. VoterRegisteredEvent</h3>
              <p className="text-sm text-muted-foreground">Emitted when a voter is registered for a poll.</p>
              <div className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto">
                <pre>{`#[event]
pub struct VoterRegisteredEvent {
    pub poll_id: u64,
    pub voter: Pubkey,
}

// Emitted in register_voter instruction:
emit!(VoterRegisteredEvent {
    poll_id,
    voter: voter.key(),
});`}</pre>
              </div>
            </div>

            {/* VoteCastEvent */}
            <div className="space-y-3">
              <h3 className="font-semibold text-base">3. VoteCastEvent</h3>
              <p className="text-sm text-muted-foreground">Emitted when an encrypted vote is submitted.</p>
              <div className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto">
                <pre>{`#[event]
pub struct VoteCastEvent {
    pub poll_id: u64,
    pub voter: Pubkey,
}

// Emitted in vote instruction:
emit!(VoteCastEvent {
    poll_id,
    voter: voter_account.key(),
});`}</pre>
              </div>
            </div>

            {/* ResultsPublishedEvent */}
            <div className="space-y-3">
              <h3 className="font-semibold text-base">4. ResultsPublishedEvent</h3>
              <p className="text-sm text-muted-foreground">Emitted when final tallied results are published.</p>
              <div className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto">
                <pre>{`#[event]
pub struct ResultsPublishedEvent {
    pub poll_id: u64,
    pub results: Vec<CandidateResult>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CandidateResult {
    pub candidate_name: String,
    pub vote_count: u64,
}

// Emitted in publish_results instruction:
emit!(ResultsPublishedEvent {
    poll_id,
    results: results.clone(),
});`}</pre>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How to View Events Using Solscan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              You can view all events from real transactions using Solscan, Solana's blockchain explorer.
            </p>
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold mb-2">Step 1: Get a Transaction Signature</h4>
                <p className="text-muted-foreground">
                  When you perform any action (create poll, register voter, cast vote), the app shows a transaction signature.
                  Copy this signature.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Step 2: Open Solscan</h4>
                <p className="text-muted-foreground">
                  Go to{' '}
                  <a
                    href="https://solscan.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    solscan.io
                  </a>{' '}
                  and switch to your cluster (localhost, devnet, or mainnet).
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Step 3: Search Transaction</h4>
                <p className="text-muted-foreground">
                  Paste the transaction signature into the search bar and press Enter.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Step 4: View Event Logs</h4>
                <p className="text-muted-foreground">
                  Scroll down to the "Program Instruction Logs" section. Look for lines starting with{' '}
                  <code className="bg-muted px-1 py-0.5 rounded">Program data:</code>. These contain the base64-encoded event data.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Step 5: Decode Events</h4>
                <p className="text-muted-foreground">
                  Event data is encoded using Borsh serialization. You can decode it using the Anchor IDL or 
                  the{' '}
                  <code className="bg-muted px-1 py-0.5 rounded">@coral-xyz/anchor</code>{' '}
                  library in JavaScript/TypeScript.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Programmatic Event Parsing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              To programmatically fetch and parse events, you can use the Solana RPC:
            </p>
            <div className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto">
              <pre>{`import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';

const PROGRAM_ID = new PublicKey('H2S4xQeQgwSSZ1nyRjqP6KmSL4gLqcFSYuo69XNqHcy7');

async function fetchPollEvents(pollId: number) {
  const connection = new Connection('http://localhost:8899');
  
  // Get all transactions for the program
  const signatures = await connection.getSignaturesForAddress(PROGRAM_ID, { 
    limit: 1000 
  });
  
  // Fetch transaction details
  const transactions = await connection.getParsedTransactions(
    signatures.map(s => s.signature)
  );
  
  // Parse logs to extract events
  const events = [];
  for (const tx of transactions) {
    if (!tx?.meta?.logMessages) continue;
    
    for (const log of tx.meta.logMessages) {
      if (log.includes('Program data:')) {
        // Extract and decode base64 event data
        const eventData = log.split('Program data: ')[1];
        // Decode using Anchor's event parser
        // events.push(decoded event);
      }
    }
  }
  
  return events.filter(e => e.pollId === pollId);
}`}</pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security Model & Trust Assumptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">How Veritas Ensures Vote Privacy</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Votes are encrypted using TweetNaCl (Curve25519-XSalsa20-Poly1305)</li>
                <li>Vote storage uses anonymous PDAs with random nullifiers (no voter identity)</li>
                <li>Only the poll admin has the decryption key (required for tallying)</li>
                <li>Other voters and public observers cannot see individual vote choices</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Trust Model</h4>
              <p className="text-muted-foreground mb-2">
                Veritas operates on a <strong>trusted admin model</strong>, similar to traditional student elections:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>What admins CAN do:</strong> Decrypt votes after voting ends to tally results</li>
                <li><strong>What admins CANNOT do:</strong> Modify submitted votes or change results after publication</li>
                <li><strong>Theoretical vulnerability:</strong> Admin could correlate votes if actively monitoring blockchain during voting (requires malicious intent)</li>
                <li><strong>Real-world comparison:</strong> Similar to traditional elections where officials can observe voters entering polling booths</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">What Blockchain Guarantees</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>Immutability:</strong> Once cast, votes cannot be altered or deleted</li>
                <li><strong>Public Verification:</strong> Anyone can verify the final tally matches on-chain data</li>
                <li><strong>Transparent Logic:</strong> Smart contract code is open-source and auditable</li>
                <li><strong>Tamper-Proof Storage:</strong> Cryptographically impossible to modify results after publication</li>
              </ul>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Future Enhancements</h4>
              <p className="text-muted-foreground">
                Advanced cryptographic techniques could eliminate trust assumptions entirely:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-2">
                <li><strong>Zero-Knowledge Proofs (ZK-SNARKs):</strong> Prove eligibility without revealing identity</li>
                <li><strong>Homomorphic Encryption:</strong> Tally encrypted votes without decryption</li>
                <li><strong>Commit-Reveal Schemes:</strong> Hide vote content during voting period</li>
                <li><strong>Multi-Party Computation:</strong> Distributed tallying across multiple parties</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                These would enable <strong>trustless</strong> voting where no single party can correlate voters to votes.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Why This Matters for Veritas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <strong>Transparency:</strong> Anyone can verify that votes were cast, results were 
              tallied correctly, and no unauthorized modifications occurred.
            </p>
            <p>
              <strong>Auditability:</strong> Every action is timestamped and linked to a wallet address, 
              creating an immutable chain of custody.
            </p>
            <p>
              <strong>Trust Minimization:</strong> While Veritas currently trusts the poll admin to 
              tally results honestly, the blockchain ensures no one can tamper with submitted votes 
              or change results after publication.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Program Address</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-3 rounded text-xs font-mono break-all">
              H2S4xQeQgwSSZ1nyRjqP6KmSL4gLqcFSYuo69XNqHcy7
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              View all program transactions on{' '}
              <a
                href="https://solscan.io/account/H2S4xQeQgwSSZ1nyRjqP6KmSL4gLqcFSYuo69XNqHcy7"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Solscan
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
