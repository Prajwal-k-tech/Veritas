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
            <CardTitle>Protocol Notes and Limits</CardTitle>
            <CardDescription>
              A source-based guide to the current program. This is not a live event viewer or an independent tally verifier.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What Are Blockchain Events?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              The program emits public events for poll creation, voter registration, ballot casting, and result publication. These records help inspect transactions, but they do not prove that a submitted tally matches the encrypted ballots or provide voter anonymity.
            </p>
            <p>
              The smart contract emits four types of events using Anchor’s <code className="bg-muted px-1 py-0.5 rounded">emit!</code> macro:
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
    pub admin: Pubkey,
    pub name: String,
    pub description: String,
    pub candidates: Vec<String>,
    pub start_time: u64,
    pub end_time: u64,
}

// The program emits the poll’s public metadata.`}</pre>
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
              <p className="text-sm text-muted-foreground">Emitted when a ballot transaction is submitted; the event exposes the voter address and timestamp.</p>
              <div className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto">
                <pre>{`#[event]
pub struct VoteCastEvent {
    pub poll_id: u64,
    pub voter: Pubkey,
    pub timestamp: i64,
}

// The voter address and timestamp are public event fields.
// The transaction also includes the VoteAccount PDA.`}</pre>
              </div>
            </div>

            {/* ResultsPublishedEvent */}
            <div className="space-y-3">
              <h3 className="font-semibold text-base">4. ResultsPublishedEvent</h3>
              <p className="text-sm text-muted-foreground">Emitted when a result record is submitted.</p>
              <div className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto">
                <pre>{`#[event]
pub struct ResultsPublishedEvent {
    pub poll_id: u64,
    pub results: Vec<CandidateResult>,
    pub total_votes: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CandidateResult {
    pub candidate_name: String,
    pub vote_count: u64,
}

// Submitted result data is recorded; the program does not
// compare these counts with encrypted ballots.`}</pre>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Event inspection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This page documents event fields from the program source. The app does not implement a live event viewer or event decoder. The repository is configured for localnet, so local transactions are not available in public explorers such as Solscan.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security Model & Trust Assumptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Ballot encryption and public metadata</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>The frontend encrypts the selected candidate with TweetNaCl before submitting ballot bytes.</li>
                <li>The vote transaction publicly includes the voter signer and the VoteAccount PDA; a random nullifier does not hide that transaction relationship.</li>
                <li>The program emits the voter address and timestamp for each vote.</li>
                <li>Ballot contents can be decrypted by whoever holds the poll’s tally private key. The on-chain program does not enforce who holds or uses it.</li>
                <li>This prototype does not provide voter anonymity or an independently audited privacy guarantee.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Trust Model</h4>
              <p className="text-muted-foreground mb-2">
                The app’s tally interface expects a private key and calculates counts off-chain. The program’s result instruction requires the poll admin after voting ends:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Only the poll admin may call <code>publish_results</code> after the poll ends. The instruction validates candidate names and array length and rejects count overflow; it does not cryptographically verify counts against encrypted ballots.</li>
                <li>The results PDA is initialized once. An incorrect first admin submission can occupy it and prevent a later replacement through this program.</li>
                <li>The creator’s tally key can decrypt ballots; published counts still depend on the admin’s submitted values.</li>
                <li>Do not use this prototype for real elections or sensitive votes.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">What the on-chain record shows</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Solana transactions and program events expose poll actions and public account addresses.</li>
                <li>The program stores encrypted ballot bytes and a submitted result record.</li>
                <li>Public source code can be inspected; this project has no independent security audit.</li>
                <li>On-chain storage does not prove ballot secrecy, voter anonymity, or tally correctness.</li>
              </ul>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Future Enhancements</h4>
              <p className="text-muted-foreground">
                These are possible future research directions, not properties of the current prototype:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-2">
                <li><strong>Zero-Knowledge Proofs (ZK-SNARKs):</strong> Prove eligibility without revealing identity</li>
                <li><strong>Homomorphic Encryption:</strong> Tally encrypted votes without decryption</li>
                <li><strong>Commit-Reveal Schemes:</strong> Hide vote content during voting period</li>
                <li><strong>Multi-Party Computation:</strong> Distributed tallying across multiple parties</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Each would require a separate design, implementation, and security review before making stronger privacy or verification claims.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What this prototype demonstrates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <strong>Public records:</strong> Poll actions and submitted result data can be inspected on Solana. Inspection does not establish that a result matches the encrypted ballots.
            </p>
            <p>
              <strong>Evaluation opportunity:</strong> This implementation makes a useful study of the gap between encrypted ballot storage and end-to-end verifiable voting.
            </p>
            <p>
              <strong>Current limit:</strong> Public metadata can link voting activity to wallet addresses, and the poll admin can submit an unverified first tally after the poll ends.
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
              This is the program ID declared in <code>anchor/Anchor.toml</code>. The repository targets localnet; local transactions do not appear in Solscan.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
