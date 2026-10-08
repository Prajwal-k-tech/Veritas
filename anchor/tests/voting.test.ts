import path from 'node:path'
import * as anchor from '@coral-xyz/anchor'
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { startAnchor, Clock } from 'solana-bankrun'
import { BankrunProvider } from 'anchor-bankrun'
import * as nacl from 'tweetnacl'

// Execute the compiled Solana program in bankrun; no remote RPC or private wallet.
describe('Local voting lifecycle', () => {
  let context: any, program: any, admin: Keypair, outsider: Keypair
  let counter: PublicKey, poll: PublicKey, registry: PublicKey, resultAccount: PublicKey
  const id = new anchor.BN(1)
  const candidates = ['A', 'B']
  const tallyKey = nacl.box.keyPair()
  const programId = new PublicKey('H2S4xQeQgwSSZ1nyRjqP6KmSL4gLqcFSYuo69XNqHcy7')
  const pda = (seed: string, pollId = id) =>
    PublicKey.findProgramAddressSync([Buffer.from(seed), pollId.toArrayLike(Buffer, 'le', 8)], programId)[0]
  const voterPda = (voter: PublicKey, pollId = id) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from('voter'), pollId.toArrayLike(Buffer, 'le', 8), voter.toBuffer()],
      programId,
    )[0]
  const votePda = (nullifier: Uint8Array, pollId = id) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from('vote'), pollId.toArrayLike(Buffer, 'le', 8), Buffer.from(nullifier)],
      programId,
    )[0]
  const account = () => ({
    lamports: 10_000_000_000,
    data: Buffer.alloc(0),
    owner: SystemProgram.programId,
    executable: false,
  })
  const setTime = (time: bigint) => context.setClock(new Clock(time, 0n, 0n, 0n, time))
  const publish = (signer: Keypair, results: any[]) =>
    program.methods
      .publishResults(id, results)
      .accounts({
        publisher: signer.publicKey,
        pollAccount: poll,
        resultsAccount: resultAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc()
  const counts = () =>
    candidates.map((candidateName, i) => ({ candidateName, voteCount: new anchor.BN(i === 0 ? 1 : 0) }))
  const register = (voter: Keypair, pollId = id) =>
    program.methods
      .registerVoter(pollId)
      .accounts({
        admin: admin.publicKey,
        voter: voter.publicKey,
        pollAccount: pda('poll', pollId),
        voterRegistry: voterPda(voter.publicKey, pollId),
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc()
  const encryptedBallot = (candidate = 'A') => {
    const ephemeral = nacl.box.keyPair(),
      nonce = nacl.randomBytes(24)
    return Buffer.concat([
      Buffer.from(ephemeral.publicKey),
      Buffer.from(nonce),
      Buffer.from(nacl.box(Buffer.from(candidate), nonce, tallyKey.publicKey, ephemeral.secretKey)),
    ])
  }
  const castVote = (voter: Keypair, nullifier: Uint8Array, encrypted = encryptedBallot(), pollId = id) =>
    program.methods
      .vote(pollId, Array.from(nullifier), encrypted)
      .accounts({
        voter: voter.publicKey,
        pollAccount: pda('poll', pollId),
        voterRegistry: voterPda(voter.publicKey, pollId),
        voteAccount: votePda(nullifier, pollId),
        systemProgram: SystemProgram.programId,
      })
      .signers([voter])
      .rpc()

  beforeAll(async () => {
    context = await startAnchor(path.resolve(__dirname, '..'), [], [])
    admin = Keypair.generate()
    outsider = Keypair.generate()
    context.setAccount(admin.publicKey, account())
    context.setAccount(outsider.publicKey, account())
    const provider = new BankrunProvider(context)
    program = new anchor.Program(require('../target/idl/voting.json'), provider)
    setTime(10n)
    counter = PublicKey.findProgramAddressSync([Buffer.from('global_counter')], programId)[0]
    poll = pda('poll')
    resultAccount = pda('results')
    registry = PublicKey.findProgramAddressSync(
      [Buffer.from('voter'), id.toArrayLike(Buffer, 'le', 8), admin.publicKey.toBuffer()],
      programId,
    )[0]
    await program.methods
      .initializeCounter()
      .accounts({ admin: admin.publicKey, counter, systemProgram: SystemProgram.programId })
      .signers([admin])
      .rpc()
    await program.methods
      .initializePoll(new anchor.BN(20), 'Test poll', 'Lifecycle test', candidates, Array.from(tallyKey.publicKey))
      .accounts({ admin: admin.publicKey, counter, pollAccount: poll, systemProgram: SystemProgram.programId })
      .signers([admin])
      .rpc()
  })

  it('rejects non-admin voter registration', async () => {
    await expect(
      program.methods
        .registerVoter(id)
        .accounts({
          admin: outsider.publicKey,
          voter: admin.publicKey,
          pollAccount: poll,
          voterRegistry: registry,
          systemProgram: SystemProgram.programId,
        })
        .signers([outsider])
        .rpc(),
    ).rejects.toThrow('ConstraintHasOne')
  })

  it('registers, encrypts, stores and decrypts one ballot; rejects repeat voting', async () => {
    await register(admin)
    const encrypted = encryptedBallot()
    const firstNullifier = nacl.randomBytes(32)
    // Poll creation set the start to timestamp 10; this vote is accepted exactly at start.
    await castVote(admin, firstNullifier, encrypted)
    await expect(castVote(admin, nacl.randomBytes(32), encrypted)).rejects.toThrow('AlreadyVoted')
    const firstVotePda = votePda(firstNullifier)
    const ballot = await program.account.voteAccount.fetch(firstVotePda)
    const data = Buffer.from(ballot.encryptedVote)
    const plain = nacl.box.open(data.subarray(56), data.subarray(32, 56), data.subarray(0, 32), tallyKey.secretKey)
    expect(Buffer.from(plain!).toString()).toBe('A')
  })

  it('rejects a vote before the window, accepts the exact deadline and rejects the next second', async () => {
    const earlyVoter = Keypair.generate(),
      deadlineVoter = Keypair.generate(),
      lateVoter = Keypair.generate()
    context.setAccount(earlyVoter.publicKey, account())
    context.setAccount(deadlineVoter.publicKey, account())
    context.setAccount(lateVoter.publicKey, account())
    await register(earlyVoter)
    await register(deadlineVoter)
    await register(lateVoter)
    setTime(9n)
    const earlyNullifier = nacl.randomBytes(32)
    await expect(castVote(earlyVoter, earlyNullifier)).rejects.toThrow('VotingNotStarted')
    expect(await context.banksClient.getAccount(votePda(earlyNullifier))).toBeNull()
    expect((await program.account.voterRegistry.fetch(voterPda(earlyVoter.publicKey))).hasVoted).toBe(false)
    setTime(20n)
    const deadlineNullifier = nacl.randomBytes(32)
    await castVote(deadlineVoter, deadlineNullifier)
    expect((await program.account.voterRegistry.fetch(voterPda(deadlineVoter.publicKey))).hasVoted).toBe(true)
    setTime(21n)
    const lateNullifier = nacl.randomBytes(32)
    await expect(castVote(lateVoter, lateNullifier)).rejects.toThrow('VotingEnded')
    expect(await context.banksClient.getAccount(votePda(lateNullifier))).toBeNull()
    expect((await program.account.voterRegistry.fetch(voterPda(lateVoter.publicKey))).hasVoted).toBe(false)
  })

  it('returns VoterNotRegistered for a valid registry account with registration disabled', async () => {
    const unregistered = Keypair.generate(),
      nullifier = nacl.randomBytes(32)
    context.setAccount(unregistered.publicKey, account())
    const registryAddress = voterPda(unregistered.publicKey)
    const registryDiscriminator = require('../target/idl/voting.json').accounts.find(
      (account: any) => account.name === 'VoterRegistry',
    ).discriminator
    const registryData = Buffer.from([...registryDiscriminator, 0, 0])
    context.setAccount(registryAddress, {
      lamports: 1_000_000,
      data: registryData,
      owner: programId,
      executable: false,
    })
    setTime(10n)
    await expect(castVote(unregistered, nullifier)).rejects.toThrow('VoterNotRegistered')
    expect(await context.banksClient.getAccount(votePda(nullifier))).toBeNull()
  })

  it('enforces candidate-count limits and rolls failed poll creation back', async () => {
    const tenCandidates = Array.from({ length: 10 }, (_, i) => `C${i + 1}`)
    const validId = new anchor.BN(2),
      validPoll = pda('poll', validId)
    await program.methods
      .initializePoll(
        new anchor.BN(30),
        'Ten candidates',
        'Upper valid boundary',
        tenCandidates,
        Array.from(tallyKey.publicKey),
      )
      .accounts({ admin: admin.publicKey, counter, pollAccount: validPoll, systemProgram: SystemProgram.programId })
      .signers([admin])
      .rpc()
    expect((await program.account.pollAccount.fetch(validPoll)).candidates).toHaveLength(10)

    const invalidId = new anchor.BN(3),
      invalidPoll = pda('poll', invalidId)
    const createInvalid = (candidateNames: string[]) =>
      program.methods
        .initializePoll(
          new anchor.BN(30),
          'Invalid candidates',
          'Must not create this poll',
          candidateNames,
          Array.from(tallyKey.publicKey),
        )
        .accounts({ admin: admin.publicKey, counter, pollAccount: invalidPoll, systemProgram: SystemProgram.programId })
        .signers([admin])
        .rpc()
    await expect(createInvalid([])).rejects.toThrow('NoCandidates')
    await expect(createInvalid(Array.from({ length: 11 }, (_, i) => `C${i + 1}`))).rejects.toThrow('TooManyCandidates')
    expect(await context.banksClient.getAccount(invalidPoll)).toBeNull()
    expect((await program.account.globalPollCounter.fetch(counter)).nextPollId.toNumber()).toBe(3)
  })

  it('rejects undersized encrypted ballots without consuming the voter registration or nullifier', async () => {
    const shortVoter = Keypair.generate(),
      nullifier = nacl.randomBytes(32)
    context.setAccount(shortVoter.publicKey, account())
    await register(shortVoter)
    setTime(10n)
    await expect(castVote(shortVoter, nullifier, Buffer.alloc(72))).rejects.toThrow('InvalidEncryptedVote')
    expect(await context.banksClient.getAccount(votePda(nullifier))).toBeNull()
    expect((await program.account.voterRegistry.fetch(voterPda(shortVoter.publicKey))).hasVoted).toBe(false)
  })

  it('rejects early publication and rolls back result creation', async () => {
    setTime(10n)
    await expect(publish(admin, counts())).rejects.toThrow('VotingNotEnded')
    expect(await context.banksClient.getAccount(resultAccount)).toBeNull()
  })

  it('rejects admin result publication at the exact deadline', async () => {
    setTime(20n)
    const zeroCounts = candidates.map((candidateName) => ({ candidateName, voteCount: new anchor.BN(0) }))
    await expect(publish(admin, zeroCounts)).rejects.toThrow('VotingNotEnded')
    expect(await context.banksClient.getAccount(resultAccount)).toBeNull()
  })

  it('rejects an outsider after the deadline', async () => {
    setTime(21n)
    await expect(publish(outsider, counts())).rejects.toThrow('ConstraintHasOne')
    expect(await context.banksClient.getAccount(resultAccount)).toBeNull()
  })

  it('rejects wrong names and overflowing tallies without occupying the result account', async () => {
    setTime(21n)
    await expect(publish(admin, [{ candidateName: 'X', voteCount: new anchor.BN(1) }, counts()[1]])).rejects.toThrow(
      'InvalidTallyCount',
    )
    await expect(
      publish(admin, [
        { candidateName: 'A', voteCount: new anchor.BN('18446744073709551615') },
        { candidateName: 'B', voteCount: new anchor.BN(1) },
      ]),
    ).rejects.toThrow('InvalidTallyCount')
    expect(await context.banksClient.getAccount(resultAccount)).toBeNull()
  })

  it('publishes the admin tally and retrieves matching names, counts and total', async () => {
    setTime(21n)
    await publish(admin, counts())
    const saved = await program.account.resultsAccount.fetch(resultAccount)
    expect(saved.totalVotes.toNumber()).toBe(1)
    expect(saved.results.map((r: any) => [r.candidateName, r.voteCount.toNumber()])).toEqual([
      ['A', 1],
      ['B', 0],
    ])
  })
})
