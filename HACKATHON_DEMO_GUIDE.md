# 🎯 Hackathon Demo Guide - Veritas Voting System

**Date:** October 27, 2025  
**System:** Anonymous Blockchain Voting on Solana  
**Demo Time:** ~10 minutes

---




##  Demo Script (10 Minutes)

### **Step 1: Introduction (1 minute)**

> "Hi! I'm presenting **Veritas** - a truly anonymous voting system on Solana blockchain. Unlike traditional voting systems, Veritas guarantees voter privacy through cryptographic encryption while maintaining complete transparency and verifiability."

**Key Points:**
- Anonymous voting with end-to-end encryption
- Two-account architecture prevents vote-to-voter correlation
- All votes stored immutably on Solana blockchain
- Admin can tally but cannot identify who voted what

---

### **Step 2: Create Poll (2 minutes)**

**Actions:**
1. Click "Create New Poll"
2. Connect wallet
3. Fill in:
   - **Name:** "Best Blockchain Platform 2025"
   - **Description:** "Vote for your favorite blockchain"
   - **Candidates:** "Solana", "Ethereum"
   - **End Time:** Current time + 2 minutes
4. Click "Generate Encryption Key"
5. Click "Create Poll"
6. **CRITICAL:** Download encryption key (save it!)
7. Note the Poll ID (e.g., "Poll #7 created")

**What to Explain:**
> "I'm generating a cryptographic keypair. The PUBLIC key encrypts votes, the PRIVATE key decrypts them during tallying. Only I have this private key - even the blockchain doesn't have it!"

---

### **Step 3: Register Voters (1 minute)**

**Actions:**
1. Go to "Manage Poll"
2. Paste your wallet address in "Register Single Voter"
3. Click "Register"
4. See success message

**What to Explain:**
> "In production, you'd upload a CSV of thousands of voter addresses. The smart contract creates a VoterRegistry account linked to each voter's identity - this prevents double voting."

---

### **Step 4: Vote (2 minutes)**

**Actions:**
1. Go to "View Poll"
2. Select candidate (e.g., "Solana")
3. Click "Submit Encrypted Vote"
4. Approve transaction
5.  See success screen

**What to Explain:**
> "Here's the magic - when I vote, TWO accounts are created:
> 1. **VoterRegistry** - marks that I voted (prevents double voting)
> 2. **VoteAccount** - stores my ENCRYPTED vote with a RANDOM nullifier
> 
> The smart contract CANNOT link these two accounts together! Even though both are created in the same transaction, the VoteAccount uses a random 32-byte nullifier instead of my wallet address in its PDA seeds."

**Show in Console (if technical audience):**
```javascript
// VoterRegistry PDA: hash("voter" + poll_id + YOUR_WALLET_ADDRESS)
// VoteAccount PDA:   hash("vote" + poll_id + RANDOM_NULLIFIER)
// ^^^ No connection between them!
```

---

### **Step 5: Wait & Explain Architecture (2 minutes)**

While waiting for poll to end, explain:

**The Two-Account System:**
```
Vote Transaction (Atomic):
├── VoterRegistry (identity-linked)
│   ├── Seeds: ["voter", poll_id, voter_pubkey]
│   └── Data: {registered: true, has_voted: true}
│
└── VoteAccount (anonymous)
    ├── Seeds: ["vote", poll_id, RANDOM_NULLIFIER]
    └── Data: {poll_id, encrypted_vote, nullifier}
```

**Privacy Guarantee:**
- Admin knows Alice voted (VoterRegistry)
- Admin knows Vote X exists (VoteAccount)
- Admin CANNOT prove Alice cast Vote X
- Only way to correlate: Real-time blockchain monitoring (active attack)
- If admin waits until voting ends, correlation is impossible

**Encryption:**
- Uses TweetNaCl (Curve25519-XSalsa20-Poly1305)
- Voter encrypts with admin's PUBLIC key
- Only admin's PRIVATE key can decrypt
- Format: `ephemeralPublicKey (32) + nonce (24) + ciphertext`

---

### **Step 6: Tally Results (2 minutes)**

**Actions:**
1. Go to "Manage Poll"
2. Scroll to "Tally & Publish Results"
3. Upload encryption key file
4. Click "Tally & Publish Results"
5.  See decrypted results: "Solana: 1 vote (100%)"

**What to Explain:**
> "Now I decrypt and tally. The smart contract fetches ALL VoteAccount instances for this poll using `getProgramAccounts()` with filters. I decrypt each vote locally using my private key, count them, then publish final results to the blockchain."

**Show in Code (if technical):**
```typescript
// Fetch all VoteAccounts for this poll
const accounts = await connection.getProgramAccounts(programId, {
  filters: [
    { memcmp: { offset: 0, bytes: discriminator } },  // VoteAccount type
    { memcmp: { offset: 8, bytes: pollId } }          // This poll only
  ]
})

// Decrypt each vote
for (const account of accounts) {
  const encryptedVote = extractFromAccount(account)
  const decrypted = nacl.box.open(ciphertext, nonce, ephemeralPubkey, adminSecretKey)
  const candidateName = decode(decrypted)
  voteCounts[candidateName]++
}
```

---

##  Key Technical Highlights

### Why Solana?
- **Fast:** 400ms block time = instant voting confirmation
- **Cheap:** ~$0.00025 per vote (vs $10-50 on Ethereum)
- **Scalable:** 65,000 TPS = millions of voters
- **getProgramAccounts:** Allows efficient vote querying

### Why Two Accounts?
- Single account would link voter identity to vote content
- Separating them with different PDA seeds breaks the link
- VoterRegistry prevents double voting
- VoteAccount stores anonymous encrypted vote

### Why TweetNaCl?
- Industry-standard (used by Signal, WhatsApp)
- Authenticated encryption (prevents tampering)
- Ephemeral key exchange (forward secrecy)
- Battle-tested cryptography (NaCl by DJB)

---

##  Handling Judge Questions

**Q: How do you prevent the admin from correlating votes?**
> A: The admin would need to monitor blockchain transactions in real-time and correlate the timing of VoterRegistry and VoteAccount creation in the same transaction. If the admin waits until after voting ends to tally, passive correlation is impossible. For maximum privacy, we could add random delays or use mixnets.

**Q: What if the admin loses the private key?**
> A: Results cannot be decrypted! This is by design - only the key holder can tally. In production, you'd use multi-sig or secret sharing schemes (Shamir's Secret Sharing) to distribute the key among multiple trustees.

**Q: Can voters verify their vote was counted?**
> A: Currently no (secret ballot). We could add receipt-freeness using cryptographic commitments, allowing voters to verify inclusion without revealing their choice.

**Q: How do you prevent vote buying?**
> A: Voters cannot prove who they voted for (receipt-freeness). Even with the VoteAccount PDA, they can't prove it's their vote since the nullifier is random and not tied to their identity.

**Q: Why not use ZK-SNARKs for privacy?**
> A: ZK-SNARKs are powerful but complex. Our two-account + encryption approach is simpler, auditable, and sufficient for most voting scenarios. ZK-SNARKs would add anonymity set guarantees but at the cost of complexity and trusted setup.

---

## Common Demo Issues

### Validator Not Running
```bash
# Check if running
ps aux | grep solana-test-validator
# Restart if needed
pkill -f solana-test-validator && solana-test-validator
```

### Program Not Deployed
```bash
cd anchor && anchor deploy
# Check program ID matches lib.rs:
solana program show H2S4xQeQgwSSZ1nyRjqP6KmSL4gLqcFSYuo69XNqHcy7
```

### Wallet Not Funded
```bash
solana balance 2WPCGJ2KyELh9nRvF4WSsoeYFjJwFJn7Ade1sCdkvuh3
# Fund if needed:
solana airdrop 100 2WPCGJ2KyELh9nRvF4WSsoeYFjJwFJn7Ade1sCdkvuh3
```

### Frontend Not Starting
```bash
# Clear cache and reinstall
rm -rf .next node_modules package-lock.json
npm install && npm run dev
```

---

## Demo Success Checklist

- [ ] Validator running (Terminal 1)
- [ ] Program deployed (check Program ID)
- [ ] Frontend accessible (http://localhost:3000)
- [ ] Wallet connected (2WPCGJ...)
- [ ] Wallet funded (100 SOL)
- [ ] Encryption key downloaded
- [ ] Poll created successfully
- [ ] Voter registered successfully
- [ ] Vote submitted successfully
- [ ] Results tallied and show 1 vote

---

##  Backup Demo (If Live Demo Fails)

Have screenshots/video of:
1. Poll creation with encryption key generation
2. Voter registration confirmation
3. Voting interface with encrypted submission
4. Browser console showing encryption process
5. Tally showing decrypted results
6. Final results page with vote breakdown

**Practice opening Solana Explorer:**
- Show transaction details
- Show VoteAccount data (encrypted bytes)
- Show event logs (PollCreated, VoterRegistered, VoteCast, ResultsPublished)

---

## Closing Statement

> "Veritas proves that blockchain voting can be both PRIVATE and TRANSPARENT. We achieved anonymity through cryptographic architecture rather than complex zero-knowledge proofs, making the system auditable and trustworthy. With Solana's speed and efficiency, this could scale to national elections. Thank you!"

**Call to Action:**
- GitHub: github.com/Prajwal-k-tech/Veritas
- Live Demo: [deployed link if available]
- Technical Deep Dive: See SMART_CONTRACT_GUIDE.md

---

##  Post-Demo Tasks

- [ ] Upload code to GitHub
- [ ] Deploy to Devnet/Mainnet (optional)
- [ ] Create demo video
- [ ] Update README with screenshots
- [ ] Prepare technical Q&A document

**Good luck! **
