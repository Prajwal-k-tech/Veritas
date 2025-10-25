# Local Testing Guide

Complete guide to testing the Solana Voting System locally with test SOL.

## Prerequisites

- Solana CLI installed (`solana --version`)
- Anchor CLI installed (`anchor --version`)
- Node.js and npm installed
- Phantom or Solflare wallet extension

---

## Step 1: Set Up Local Validator

### Start the Local Test Validator

Open a terminal and run:

```bash
cd anchor
solana-test-validator
```

**What this does:**
- Starts a local Solana blockchain on your machine
- Runs on localhost (127.0.0.1:8899)
- Gives you unlimited test SOL
- Resets when you restart it (unless you use `--ledger` flag)

**Keep this terminal running during all testing**

### Configure Solana CLI for Localhost

In a new terminal:

```bash
solana config set --url localhost
solana config get
```

Expected output:
```
Config File: /home/username/.config/solana/cli/config.yml
RPC URL: http://localhost:8899
WebSocket URL: ws://localhost:8900/
Keypair Path: /home/username/.config/solana/id.json
Commitment: confirmed
```

---

## Step 2: Create Test Wallets

### Generate a Test Wallet

```bash
solana-keygen new --outfile ~/test-wallet.json
```

Save the seed phrase if you want to recover it later (optional for testing).

### Set as Default Wallet

```bash
solana config set --keypair ~/test-wallet.json
```

### Check Wallet Address

```bash
solana address
```

Copy this address - you'll need it later.

### Airdrop Test SOL

```bash
solana airdrop 10
solana balance
```

You should see: `10 SOL`

**You have unlimited test SOL on localhost!** Airdrop as much as you need.

---

## Step 3: Deploy the Program

### Build the Program

```bash
cd anchor
anchor build
```

Expected output:
```
Finished release profile [optimized] target(s) in 2.6s
```

### Deploy to Local Validator

```bash
anchor deploy
```

Expected output:
```
Deploying cluster: http://localhost:8899
Upgrade authority: YourWalletAddress
Deploying program "Voting"...
Program Id: 5s3PtT8kLYCv1WEp6dSh3T7EuF35Z6jSu5Cvx4hWG79H

Deploy success
```

**Important:** Note the Program ID. It should match the one in `lib.rs` (line 3).

### Verify Deployment

```bash
solana program show 5s3PtT8kLYCv1WEp6dSh3T7EuF35Z6jSu5Cvx4hWG79H
```

Should show program details and executable data length.

---

## Step 4: Configure Frontend for Local Testing

### Update Cluster Settings

The app should auto-detect localhost when running. To verify:

1. Start the dev server:
```bash
cd ..  # Back to project root
npm run dev
```

2. Open browser: http://localhost:3000 (or 3001 if 3000 is busy)

3. Look for cluster selector in the UI (usually top right)

4. Select "Localhost" or "Custom" and enter: `http://localhost:8899`

### Import Test Wallet to Browser

**Option A: Phantom Wallet**
1. Open Phantom
2. Settings > Add/Connect Wallet
3. Import Private Key
4. Paste the contents of `~/test-wallet.json`

**Option B: Export from CLI**
```bash
solana-keygen pubkey ~/test-wallet.json --outfile ~/test-wallet-pubkey.txt
cat ~/test-wallet.json
```

Copy the array of numbers and import into wallet.

### Verify Connection

In the browser app:
- Click "Connect Wallet"
- Select your wallet
- Approve connection
- You should see your wallet address in the UI

---

## Step 5: Test the Complete Flow

### Test 1: Initialize Counter (One-Time Setup)

This only needs to be done once per program deployment.

**Method A: Through UI**
1. Go to http://localhost:3000/create
2. The first time you create a poll, it will auto-initialize the counter
3. Check console for "Counter initialized" or "Counter already initialized"

**Method B: Using Anchor CLI**
```bash
cd anchor
anchor run initialize-counter
```

### Test 2: Create a Poll

1. Navigate to http://localhost:3000/create

2. Fill in the form:
   - **Poll Name:** "Class President Election"
   - **Description:** "Vote for your class representative"
   - **Start Time:** Current time (click the datetime picker)
   - **End Time:** 1 hour from now
   - **Candidates:** Add 3-5 candidates (click "Add Candidate")
     - Alice Johnson
     - Bob Smith
     - Carol White

3. Click "Create Poll"

4. **Important:** Download the private key file that appears
   - File name: `poll-1-PRIVATE-KEY.json`
   - Keep this safe - you'll need it to decrypt votes

5. Note the Poll ID shown (should be "1" for first poll)

**Expected Result:**
- Transaction success message
- Poll ID displayed
- Private key download prompt

**Verify on Chain:**
```bash
# Get the poll account address (PDA)
# Poll 1 with seed "poll" and poll_id as bytes
solana account <POLL_PDA_ADDRESS>
```

### Test 3: Register Voters

You need to register wallet addresses that are allowed to vote.

#### Create Voter Wallets

```bash
# Create 3 test voter wallets
solana-keygen new --outfile ~/voter1.json --no-bip39-passphrase
solana-keygen new --outfile ~/voter2.json --no-bip39-passphrase
solana-keygen new --outfile ~/voter3.json --no-bip39-passphrase

# Get their addresses
solana-keygen pubkey ~/voter1.json
solana-keygen pubkey ~/voter2.json
solana-keygen pubkey ~/voter3.json
```

Copy these addresses.

#### Create CSV File

Create a file `voters.csv`:

```csv
address
9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin
7jPJz9QPqFTQf4vqHLfAZH8kcyYCyvJz8r4kYLKJhQ8e
4kF2pL9eMvCzQwRzVxHjW5aGkYdRzPqL8tN3mXvFhYpE
```

(Replace with your actual voter addresses from above)

#### Register Voters via UI

1. Go to http://localhost:3000/manage/1 (for Poll ID 1)

2. Connect with the admin wallet (the one that created the poll)

3. Upload the `voters.csv` file

4. Click "Register All Voters"

5. Wait for transactions to complete (about 3-5 seconds)

**Expected Result:**
- Green checkmarks for each successful registration
- "Successfully registered X voters" message

**Verify Registration:**
```bash
# Check if voter 1 is registered (you need to calculate the PDA address)
solana account <VOTER_REGISTRY_PDA>
```

### Test 4: Cast Votes

Now switch to voter wallets to cast votes.

#### Import Voter Wallet to Browser

1. Open your wallet extension
2. Add new account / Import private key
3. Paste contents of `~/voter1.json`
4. Name it "Test Voter 1"

#### Vote

1. Go to http://localhost:3000/poll/1

2. Connect with Voter 1 wallet

3. You should see:
   - Poll details (name, description, time remaining)
   - List of candidates
   - "Cast Vote" button

4. Select a candidate (e.g., "Alice Johnson")

5. Click "Cast Vote"

6. Approve the transaction in your wallet

**Expected Result:**
- "Vote cast successfully!" message
- "You have already voted" status appears
- Vote button becomes disabled

**Repeat for Voter 2 and Voter 3:**
- Switch wallet to Voter 2
- Vote for a different candidate
- Switch wallet to Voter 3
- Vote for another candidate

### Test 5: Wait for Voting to End

**Option A: Wait for Real Time**
If your end time is 1 hour away, wait 1 hour.

**Option B: Time Travel (Advanced)**
Stop the validator and restart with a different time:

```bash
# Stop validator (Ctrl+C)

# Restart with future time (1 hour ahead in Unix timestamp)
solana-test-validator --bpf-program 5s3PtT8kLYCv1WEp6dSh3T7EuF35Z6jSu5Cvx4hWG79H \
  target/deploy/voting.so \
  --reset \
  --warp-slot 1000000

# Note: This is complex - easier to just set a short voting window (5 minutes)
```

**Best Practice for Testing:**
Create polls with very short durations (5-10 minutes) for quick testing.

### Test 6: Decrypt Votes and Publish Results

After voting ends, the admin needs to decrypt votes and publish results.

#### Decrypt Votes Manually (Off-Chain)

Currently, you need to do this manually. Here's a Node.js script:

Create `decrypt-votes.js`:

```javascript
const nacl = require('tweetnacl');
const fs = require('fs');
const { Connection, PublicKey } = require('@solana/web3.js');
const { Program, AnchorProvider } = require('@coral-xyz/anchor');

async function decryptVotes() {
  // Load private key from downloaded file
  const keyFile = JSON.parse(fs.readFileSync('./poll-1-PRIVATE-KEY.json'));
  const privateKey = Buffer.from(keyFile.privateKey, 'hex');
  
  // Connect to local validator
  const connection = new Connection('http://localhost:8899', 'confirmed');
  
  // Load program IDL
  const idl = JSON.parse(fs.readFileSync('./anchor/target/idl/Voting.json'));
  const programId = new PublicKey('5s3PtT8kLYCv1WEp6dSh3T7EuF35Z6jSu5Cvx4hWG79H');
  
  // Get all voter registries for poll 1
  // (You'd need to fetch all accounts with the "voter" seed)
  
  const votes = [];
  
  // For each voter registry with encrypted_vote data:
  for (const registry of voterRegistries) {
    const encryptedVote = Buffer.from(registry.account.encryptedVote);
    
    // Extract components
    const ephemeralPublicKey = encryptedVote.slice(0, 32);
    const nonce = encryptedVote.slice(32, 56);
    const ciphertext = encryptedVote.slice(56);
    
    // Decrypt
    const decrypted = nacl.box.open(
      ciphertext,
      nonce,
      ephemeralPublicKey,
      privateKey
    );
    
    if (decrypted) {
      const candidateIndex = decrypted[0];
      votes.push(candidateIndex);
    }
  }
  
  // Tally results
  const tally = {};
  votes.forEach(vote => {
    tally[vote] = (tally[vote] || 0) + 1;
  });
  
  console.log('Results:', tally);
}

decryptVotes();
```

Run:
```bash
node decrypt-votes.js
```

#### Publish Results via UI

1. Go to http://localhost:3000/poll/1

2. Connect with admin wallet

3. You should see "Publish Results" section

4. Enter vote counts for each candidate:
   - Alice Johnson: 5 votes
   - Bob Smith: 3 votes
   - Carol White: 2 votes

5. Click "Publish Results"

**Expected Result:**
- Transaction succeeds
- Results appear on the poll page
- Anyone can now view the results

---

## Step 6: Verify Everything on Chain

### Check All Accounts

```bash
# Check counter
solana account <COUNTER_PDA>

# Check poll 1
solana account <POLL_1_PDA>

# Check voter registries
solana account <VOTER_1_REGISTRY_PDA>

# Check results
solana account <RESULTS_PDA>
```

### View Transaction History

```bash
solana transaction-history <YOUR_WALLET_ADDRESS>
```

### Check Program Logs

In the validator terminal, you should see logs for each transaction:

```
Program log: Instruction: InitializeCounter
Program log: Instruction: InitializePoll
Program log: Instruction: RegisterVoter
Program log: Instruction: Vote
Program log: Instruction: PublishResults
```

---

## Common Issues and Solutions

### Issue: "Insufficient funds"

**Solution:**
```bash
solana airdrop 10
```

Airdrop more test SOL to your wallet.

### Issue: "Account not found"

**Cause:** Counter not initialized

**Solution:**
```bash
cd anchor
anchor run initialize-counter
```

Or create a poll through the UI (auto-initializes counter).

### Issue: "VoterNotRegistered" error when voting

**Cause:** Voter wallet not registered by admin

**Solution:**
1. Go to /manage/1
2. Add voter address to CSV
3. Upload and register

### Issue: "Voting has not started yet"

**Cause:** Your start time is in the future

**Solution:**
Edit the poll start time or wait until it starts.

### Issue: "Transaction simulation failed"

**Cause:** Multiple possible reasons

**Debug steps:**
1. Check browser console for detailed error
2. Check validator logs in the terminal
3. Verify account addresses are correct
4. Check your wallet has enough SOL for transaction fees

### Issue: Program ID mismatch

**Cause:** Deployed program ID doesn't match `declare_id!` in lib.rs

**Solution:**
```bash
# Get deployed program ID
anchor keys list

# Update lib.rs line 3:
declare_id!("YOUR_ACTUAL_PROGRAM_ID");

# Rebuild and redeploy
anchor build
anchor deploy
```

---

## Testing Checklist

Use this checklist to verify everything works:

- [ ] Local validator running
- [ ] Program deployed successfully
- [ ] Frontend running and connected to localhost
- [ ] Wallet connected with test SOL
- [ ] Counter initialized
- [ ] Poll created successfully
- [ ] Private key downloaded
- [ ] Multiple voters registered
- [ ] Votes cast from different wallets
- [ ] All votes encrypted properly
- [ ] Voting period ended
- [ ] Results published
- [ ] Results visible to all users
- [ ] No errors in console or validator logs

---

## Advanced Testing

### Testing Error Cases

**Test double voting:**
1. Vote with a wallet
2. Try to vote again with the same wallet
3. Should see "AlreadyVoted" error

**Test unregistered voter:**
1. Create a new wallet
2. Try to vote without registering
3. Should see "VoterNotRegistered" error

**Test time windows:**
1. Try to vote before start time
2. Should see "VotingNotStarted" error
3. Try to vote after end time
4. Should see "VotingEnded" error

**Test admin restrictions:**
1. Try to register a voter with non-admin wallet
2. Should fail with constraint error

### Automated Testing with Anchor

Create `tests/voting-full.test.ts`:

```typescript
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Voting } from '../target/types/Voting';
import { expect } from 'chai';
import nacl from 'tweetnacl';

describe('Voting System', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  const program = anchor.workspace.Voting as Program<Voting>;
  
  it('Initializes counter', async () => {
    // Test implementation
  });
  
  it('Creates a poll', async () => {
    // Test implementation
  });
  
  it('Registers voters', async () => {
    // Test implementation
  });
  
  it('Casts encrypted votes', async () => {
    // Test implementation
  });
  
  it('Prevents double voting', async () => {
    // Test implementation
  });
  
  it('Publishes results', async () => {
    // Test implementation
  });
});
```

Run tests:
```bash
anchor test
```

---

## Resetting Everything

If you want to start fresh:

### Option 1: Restart Validator (Full Reset)

```bash
# Stop validator (Ctrl+C)
# Remove ledger data
rm -rf test-ledger
# Start fresh
solana-test-validator
```

This wipes all accounts and transactions.

### Option 2: Redeploy Program (Keep Validator Running)

```bash
anchor build
anchor deploy --program-name voting
```

This redeploys the program but keeps the validator data.

---

## Tips for Efficient Testing

1. **Use Short Time Windows**
   - Set voting periods to 5-10 minutes for testing
   - Don't wait hours between tests

2. **Script Repetitive Tasks**
   - Create bash scripts for wallet creation
   - Automate voter registration

3. **Use Anchor Tests**
   - Write automated tests for regression testing
   - Run `anchor test` before each demo

4. **Keep Validator Logs Open**
   - Watch for program logs in real-time
   - Debug issues faster

5. **Airdrop Generously**
   - Test SOL is unlimited
   - Airdrop 10 SOL to each test wallet

6. **Use Multiple Browser Profiles**
   - One profile per voter wallet
   - Easier than constantly switching wallets

---

## Next Steps

After successful local testing:

1. **Test on Devnet**
   - Deploy to Solana Devnet
   - Use real devnet SOL (airdrop available)
   - Test with real network conditions

2. **Test on Mainnet-Beta**
   - Only after thorough devnet testing
   - Use real SOL (costs money)
   - Production-ready deployment

3. **Add Monitoring**
   - Set up error tracking
   - Monitor transaction success rates
   - Log important events

---

## Reference Commands

```bash
# Validator
solana-test-validator                    # Start validator
solana-test-validator --reset            # Reset and start
solana-test-validator --help             # See all options

# Configuration
solana config set --url localhost        # Use local validator
solana config set --url devnet           # Use devnet
solana config get                        # Show current config

# Wallet Management
solana-keygen new                        # Create new wallet
solana address                           # Show current address
solana balance                           # Show SOL balance
solana airdrop 10                        # Get 10 test SOL

# Program Deployment
anchor build                             # Build program
anchor deploy                            # Deploy to configured cluster
anchor test                              # Run tests
anchor keys list                         # Show program IDs

# Account Inspection
solana account <ADDRESS>                 # View account data
solana program show <PROGRAM_ID>         # View program info
solana transaction-history <ADDRESS>     # View transactions
```

---

**You're now ready to test the complete voting system locally with unlimited test SOL!**
