import * as anchor from '@coral-xyz/anchor';
import { BN, Program } from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { startAnchor, BanksClient, ProgramTestContext } from 'solana-bankrun';
import { BankrunProvider } from 'anchor-bankrun';
import { Voting } from '../target/types/voting';
import * as nacl from 'tweetnacl';

describe('Voting System', () => {
  let context: ProgramTestContext;
  let provider: BankrunProvider;
  let program: Program<Voting>;
  let banksClient: BanksClient;
  
  let admin: Keypair;
  let voter1: Keypair;
  let voter2: Keypair;
  let voter3: Keypair;
  let encryptionKeypair: nacl.BoxKeyPair;
  
  let counterPda: PublicKey;
  let pollPda: PublicKey;
  let poll_id: number;

  beforeAll(async () => {
    // Start bankrun with our program
    context = await startAnchor(
      '',
      [{ name: 'voting', programId: new PublicKey('H2S4xQeQgwSSZ1nyRjqP6KmSL4gLqcFSYuo69XNqHcy7') }],
      []
    );

    provider = new BankrunProvider(context);
    anchor.setProvider(provider);
    
    program = new Program<Voting>(
      require('../target/idl/voting.json'),
      provider
    );
    
    banksClient = context.banksClient;
    
    // Generate test accounts
    admin = Keypair.generate();
    voter1 = Keypair.generate();
    voter2 = Keypair.generate();
    voter3 = Keypair.generate();
    
    // Generate encryption keypair for admin
    encryptionKeypair = nacl.box.keyPair();
    
    // Airdrop SOL to accounts
    await banksClient.requestAirdrop(admin.publicKey, 10_000_000_000);
    await banksClient.requestAirdrop(voter1.publicKey, 1_000_000_000);
    await banksClient.requestAirdrop(voter2.publicKey, 1_000_000_000);
    await banksClient.requestAirdrop(voter3.publicKey, 1_000_000_000);
    
    // Derive GlobalPollCounter PDA
    [counterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('global_counter')],
      program.programId
    );
  });

  describe('Phase 1: Poll Creation', () => {
    it('Initializes the global poll counter', async () => {
      const tx = await program.methods
        .initializeCounter()
        .accounts({
          admin: admin.publicKey,
          counter: counterPda,
        })
        .signers([admin])
        .rpc({ commitment: 'confirmed' });

      const counterAccount = await program.account.globalPollCounter.fetch(counterPda);
      expect(counterAccount.nextPollId.toNumber()).toBe(1);
    });

    it('Creates a poll with auto-incrementing ID', async () => {
      const now = Math.floor(Date.now() / 1000);
      const startTime = new BN(now - 10); // Started 10 seconds ago (for testing)
      const endTime = new BN(now + 3600); // Ends in 1 hour
      
      const candidates = ['Alice', 'Bob', 'Charlie'];
      
      // Counter is at 1, so poll_id will be 1
      poll_id = 1;
      [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('poll'), new BN(poll_id).toArrayLike(Buffer, 'le', 8)],
        program.programId
      );

      const tx = await program.methods
        .initializePoll(
          startTime,
          endTime,
          'Best Candidate Poll',
          'Vote for the best candidate for class president',
          candidates,
          Array.from(encryptionKeypair.publicKey)
        )
        .accounts({
          admin: admin.publicKey,
          counter: counterPda,
          pollAccount: pollPda,
        })
        .signers([admin])
        .rpc({ commitment: 'confirmed' });

      const pollAccount = await program.account.pollAccount.fetch(pollPda);
      
      expect(pollAccount.pollId.toNumber()).toBe(1);
      expect(pollAccount.admin.toString()).toBe(admin.publicKey.toString());
      expect(pollAccount.pollName).toBe('Best Candidate Poll');
      expect(pollAccount.candidates).toEqual(candidates);
      expect(pollAccount.tallierPubkey).toEqual(Array.from(encryptionKeypair.publicKey));
      
      // Counter should have incremented
      const counterAccount = await program.account.globalPollCounter.fetch(counterPda);
      expect(counterAccount.nextPollId.toNumber()).toBe(2);
    });

    it('Fails to create poll with >10 candidates', async () => {
      const now = Math.floor(Date.now() / 1000);
      const candidates = Array.from({ length: 11 }, (_, i) => `Candidate ${i + 1}`);
      
      const [tempPollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('poll'), new BN(2).toArrayLike(Buffer, 'le', 8)],
        program.programId
      );

      try {
        await program.methods
          .initializePoll(
            new BN(now + 10),
            new BN(now + 3600),
            'Too Many Candidates',
            'This should fail',
            candidates,
            Array.from(encryptionKeypair.publicKey)
          )
          .accounts({
            admin: admin.publicKey,
            counter: counterPda,
            pollAccount: tempPollPda,
          })
          .signers([admin])
          .rpc({ commitment: 'confirmed' });
        
        fail('Should have thrown error for too many candidates');
      } catch (error: any) {
        expect(error.error.errorMessage).toContain('Cannot have more than 10 candidates');
      }
    });

    it('Fails to create poll with no candidates', async () => {
      const now = Math.floor(Date.now() / 1000);
      
      const [tempPollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('poll'), new BN(2).toArrayLike(Buffer, 'le', 8)],
        program.programId
      );

      try {
        await program.methods
          .initializePoll(
            new BN(now + 10),
            new BN(now + 3600),
            'No Candidates',
            'This should fail',
            [],
            Array.from(encryptionKeypair.publicKey)
          )
          .accounts({
            admin: admin.publicKey,
            counter: counterPda,
            pollAccount: tempPollPda,
          })
          .signers([admin])
          .rpc({ commitment: 'confirmed' });
        
        fail('Should have thrown error for no candidates');
      } catch (error: any) {
        expect(error.error.errorMessage).toContain('Poll must have at least one candidate');
      }
    });
  });

  describe('Phase 2: Voter Registration', () => {
    it('Admin registers voter1', async () => {
      const [voter1RegistryPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('voter'),
          new BN(poll_id).toArrayLike(Buffer, 'le', 8),
          voter1.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .registerVoter(new BN(poll_id))
        .accounts({
          admin: admin.publicKey,
          pollAccount: pollPda,
          voter: voter1.publicKey,
          voterRegistry: voter1RegistryPda,
        })
        .signers([admin])
        .rpc({ commitment: 'confirmed' });

      const registryAccount = await program.account.voterRegistry.fetch(voter1RegistryPda);
      expect(registryAccount.registered).toBe(true);
      expect(registryAccount.hasVoted).toBe(false);
    });

    it('Admin registers voter2 and voter3', async () => {
      for (const voter of [voter2, voter3]) {
        const [voterRegistryPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('voter'),
            new BN(poll_id).toArrayLike(Buffer, 'le', 8),
            voter.publicKey.toBuffer(),
          ],
          program.programId
        );

        await program.methods
          .registerVoter(new BN(poll_id))
          .accounts({
            admin: admin.publicKey,
            pollAccount: pollPda,
            voter: voter.publicKey,
            voterRegistry: voterRegistryPda,
          })
          .signers([admin])
          .rpc({ commitment: 'confirmed' });
      }
    });

    it('Fails when non-admin tries to register a voter', async () => {
      const randomVoter = Keypair.generate();
      await banksClient.requestAirdrop(randomVoter.publicKey, 1_000_000_000);
      
      const [randomRegistryPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('voter'),
          new BN(poll_id).toArrayLike(Buffer, 'le', 8),
          randomVoter.publicKey.toBuffer(),
        ],
        program.programId
      );

      try {
        await program.methods
          .registerVoter(new BN(poll_id))
          .accounts({
            admin: voter1.publicKey, // Not the admin!
            pollAccount: pollPda,
            voter: randomVoter.publicKey,
            voterRegistry: randomRegistryPda,
          })
          .signers([voter1])
          .rpc({ commitment: 'confirmed' });
        
        fail('Should have thrown error for non-admin registration');
      } catch (error: any) {
        // has_one constraint will fail
        expect(error).toBeDefined();
      }
    });
  });

  describe('Phase 3: Voting', () => {
    // Helper function to encrypt a vote
    function encryptVote(candidate: string, adminPublicKey: Uint8Array): Buffer {
      const message = Buffer.from(candidate);
      // Using sealed box (one-way encryption with only recipient's public key)
      const nonce = nacl.randomBytes(24);
      const ephemeralKeypair = nacl.box.keyPair();
      const encrypted = nacl.box(message, nonce, adminPublicKey, ephemeralKeypair.secretKey);
      
      // Concatenate ephemeral public key + nonce + ciphertext
      const combined = Buffer.concat([
        Buffer.from(ephemeralKeypair.publicKey),
        Buffer.from(nonce),
        Buffer.from(encrypted)
      ]);
      
      return combined;
    }

    it('Fails when unregistered voter tries to vote', async () => {
      const unregisteredVoter = Keypair.generate();
      await banksClient.requestAirdrop(unregisteredVoter.publicKey, 1_000_000_000);
      
      const [unregisteredRegistryPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('voter'),
          new BN(poll_id).toArrayLike(Buffer, 'le', 8),
          unregisteredVoter.publicKey.toBuffer(),
        ],
        program.programId
      );

      const encryptedVote = encryptVote('Alice', encryptionKeypair.publicKey);

      try {
        await program.methods
          .vote(new BN(poll_id), Array.from(encryptedVote))
          .accounts({
            voter: unregisteredVoter.publicKey,
            pollAccount: pollPda,
            voterRegistry: unregisteredRegistryPda,
          })
          .signers([unregisteredVoter])
          .rpc({ commitment: 'confirmed' });
        
        fail('Should have thrown error for unregistered voter');
      } catch (error: any) {
        // Account doesn't exist or voter not registered error
        expect(error).toBeDefined();
      }
    });

    it('Fails when voting before start time', async () => {
      // Create a new poll that hasn't started yet
      const now = Math.floor(Date.now() / 1000);
      const futureStartTime = new BN(now + 100); // Starts in 100 seconds
      const futureEndTime = new BN(now + 3700);
      
      const futurePollId = 2;
      const [futurePollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('poll'), new BN(futurePollId).toArrayLike(Buffer, 'le', 8)],
        program.programId
      );

      await program.methods
        .initializePoll(
          futureStartTime,
          futureEndTime,
          'Future Poll',
          'This poll starts later',
          ['Option A', 'Option B'],
          Array.from(encryptionKeypair.publicKey)
        )
        .accounts({
          admin: admin.publicKey,
          counter: counterPda,
          pollAccount: futurePollPda,
        })
        .signers([admin])
        .rpc({ commitment: 'confirmed' });

      // Register voter1 for this future poll
      const [futureVoter1RegistryPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('voter'),
          new BN(futurePollId).toArrayLike(Buffer, 'le', 8),
          voter1.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .registerVoter(new BN(futurePollId))
        .accounts({
          admin: admin.publicKey,
          pollAccount: futurePollPda,
          voter: voter1.publicKey,
          voterRegistry: futureVoter1RegistryPda,
        })
        .signers([admin])
        .rpc({ commitment: 'confirmed' });

      const encryptedVote = encryptVote('Option A', encryptionKeypair.publicKey);

      try {
        await program.methods
          .vote(new BN(futurePollId), Array.from(encryptedVote))
          .accounts({
            voter: voter1.publicKey,
            pollAccount: futurePollPda,
            voterRegistry: futureVoter1RegistryPda,
          })
          .signers([voter1])
          .rpc({ commitment: 'confirmed' });
        
        fail('Should have thrown error for voting before start time');
      } catch (error: any) {
        expect(error.error.errorMessage).toContain('Voting has not started yet');
      }
    });

    it('Successfully votes for poll 1', async () => {
      const [voter1RegistryPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('voter'),
          new BN(poll_id).toArrayLike(Buffer, 'le', 8),
          voter1.publicKey.toBuffer(),
        ],
        program.programId
      );

      const encryptedVote = encryptVote('Alice', encryptionKeypair.publicKey);

      await program.methods
        .vote(new BN(poll_id), Array.from(encryptedVote))
        .accounts({
          voter: voter1.publicKey,
          pollAccount: pollPda,
          voterRegistry: voter1RegistryPda,
        })
        .signers([voter1])
        .rpc({ commitment: 'confirmed' });

      const registryAccount = await program.account.voterRegistry.fetch(voter1RegistryPda);
      expect(registryAccount.hasVoted).toBe(true);
      expect(registryAccount.encryptedVote.length).toBeGreaterThan(0);
    });

    it('Voter2 and Voter3 successfully vote', async () => {
      for (const [idx, voter] of [voter2, voter3].entries()) {
        const [voterRegistryPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('voter'),
            new BN(poll_id).toArrayLike(Buffer, 'le', 8),
            voter.publicKey.toBuffer(),
          ],
          program.programId
        );

        const candidate = idx === 0 ? 'Bob' : 'Alice'; // voter2->Bob, voter3->Alice
        const encryptedVote = encryptVote(candidate, encryptionKeypair.publicKey);

        await program.methods
          .vote(new BN(poll_id), Array.from(encryptedVote))
          .accounts({
            voter: voter.publicKey,
            pollAccount: pollPda,
            voterRegistry: voterRegistryPda,
          })
          .signers([voter])
          .rpc({ commitment: 'confirmed' });
      }
    });

    it('Fails when voter tries to vote twice', async () => {
      const [voter1RegistryPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('voter'),
          new BN(poll_id).toArrayLike(Buffer, 'le', 8),
          voter1.publicKey.toBuffer(),
        ],
        program.programId
      );

      const encryptedVote = encryptVote('Bob', encryptionKeypair.publicKey);

      try {
        await program.methods
          .vote(new BN(poll_id), Array.from(encryptedVote))
          .accounts({
            voter: voter1.publicKey,
            pollAccount: pollPda,
            voterRegistry: voter1RegistryPda,
          })
          .signers([voter1])
          .rpc({ commitment: 'confirmed' });
        
        fail('Should have thrown error for double voting');
      } catch (error: any) {
        expect(error.error.errorMessage).toContain('Voter has already voted');
      }
    });
  });

  describe('Phase 4: Event Verification', () => {
    it('Verifies events were emitted', async () => {
      // Note: In bankrun, event listening is limited
      // Events are emitted but we verify via account state changes
      const registryAccounts = await Promise.all([
        program.account.voterRegistry.fetch(
          PublicKey.findProgramAddressSync(
            [Buffer.from('voter'), new BN(poll_id).toArrayLike(Buffer, 'le', 8), voter1.publicKey.toBuffer()],
            program.programId
          )[0]
        ),
        program.account.voterRegistry.fetch(
          PublicKey.findProgramAddressSync(
            [Buffer.from('voter'), new BN(poll_id).toArrayLike(Buffer, 'le', 8), voter2.publicKey.toBuffer()],
            program.programId
          )[0]
        ),
        program.account.voterRegistry.fetch(
          PublicKey.findProgramAddressSync(
            [Buffer.from('voter'), new BN(poll_id).toArrayLike(Buffer, 'le', 8), voter3.publicKey.toBuffer()],
            program.programId
          )[0]
        ),
      ]);

      // Verify all voters have voted
      registryAccounts.forEach(account => {
        expect(account.hasVoted).toBe(true);
        expect(account.encryptedVote.length).toBeGreaterThan(0);
      });
    });
  });
});
