const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const anchor = require('@coral-xyz/anchor')
const { Connection, Keypair, PublicKey, SystemProgram } = require('@solana/web3.js')
const nacl = require('tweetnacl')
const idl = require('../anchor/target/idl/voting.json')

const programId = new PublicKey(idl.address)
const walletPath = process.env.ANCHOR_WALLET || path.join(os.homedir(), '.config/solana/id.json')
const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
const wallet = new anchor.Wallet(Keypair.fromSecretKey(secretKey))
const connection = new Connection(process.env.ANCHOR_PROVIDER_URL || 'http://127.0.0.1:8899', 'confirmed')
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' })
const program = new anchor.Program(idl, provider)
const voter = provider.wallet.publicKey

function littleEndianId(id) {
  return new anchor.BN(id).toArrayLike(Buffer, 'le', 8)
}

function getPda(seed, id) {
  return PublicKey.findProgramAddressSync([Buffer.from(seed), littleEndianId(id)], programId)[0]
}

async function main() {
  const programAccount = await provider.connection.getAccountInfo(programId)
  assert.ok(programAccount?.executable, `Program ${programId} is not deployed to the configured cluster`)

  const [counter] = PublicKey.findProgramAddressSync([Buffer.from('global_counter')], programId)
  if (!(await provider.connection.getAccountInfo(counter))) {
    await program.methods.initializeCounter().accounts({
      admin: voter,
      counter,
      systemProgram: SystemProgram.programId,
    }).rpc()
  }

  const counterAccount = await program.account.globalPollCounter.fetch(counter)
  const pollId = counterAccount.nextPollId.toNumber()
  const poll = getPda('poll', pollId)
  const tallyKey = nacl.box.keyPair()
  const chainTime = await provider.connection.getBlockTime(await provider.connection.getSlot('confirmed'))
  assert.ok(chainTime, 'Could not read the local validator block time')
  const endTime = chainTime + 30

  await program.methods.initializePoll(
    new anchor.BN(endTime),
    `Localnet smoke ${pollId}`,
    'Local validator flow check',
    ['Option A', 'Option B'],
    Array.from(tallyKey.publicKey),
  ).accounts({
    admin: voter,
    counter,
    pollAccount: poll,
    systemProgram: SystemProgram.programId,
  }).rpc()

  const [registry] = PublicKey.findProgramAddressSync([
    Buffer.from('voter'), littleEndianId(pollId), voter.toBuffer(),
  ], programId)
  await program.methods.registerVoter(new anchor.BN(pollId)).accounts({
    admin: voter,
    pollAccount: poll,
    voter,
    voterRegistry: registry,
    systemProgram: SystemProgram.programId,
  }).rpc()

  const nullifier = nacl.randomBytes(32)
  const ephemeralKey = nacl.box.keyPair()
  const nonce = nacl.randomBytes(24)
  const ciphertext = nacl.box(Buffer.from('Option A'), nonce, tallyKey.publicKey, ephemeralKey.secretKey)
  const encryptedVote = Buffer.concat([
    Buffer.from(ephemeralKey.publicKey),
    Buffer.from(nonce),
    Buffer.from(ciphertext),
  ])
  const getVotePda = (value) => PublicKey.findProgramAddressSync([
    Buffer.from('vote'), littleEndianId(pollId), Buffer.from(value),
  ], programId)[0]

  const submitVote = (value) => program.methods.vote(
    new anchor.BN(pollId),
    Array.from(value),
    encryptedVote,
  ).accounts({
    voter,
    pollAccount: poll,
    voterRegistry: registry,
    voteAccount: getVotePda(value),
    systemProgram: SystemProgram.programId,
  }).rpc()

  await submitVote(nullifier)

  let doubleVoteRejected = false
  try {
    await submitVote(nacl.randomBytes(32))
  } catch (error) {
    doubleVoteRejected = error?.error?.errorCode?.code === 'AlreadyVoted'
    if (!doubleVoteRejected) throw error
  }
  assert.ok(doubleVoteRejected, 'A second ballot from the same voter should fail')

  const results = getPda('results', pollId)
  let earlyPublishRejected = false
  try {
    await program.methods.publishResults(new anchor.BN(pollId), [
      { candidateName: 'Option A', voteCount: new anchor.BN(1) },
      { candidateName: 'Option B', voteCount: new anchor.BN(0) },
    ]).accounts({
      publisher: voter,
      pollAccount: poll,
      resultsAccount: results,
      systemProgram: SystemProgram.programId,
    }).rpc()
  } catch (error) {
    earlyPublishRejected = error?.error?.errorCode?.code === 'VotingNotEnded'
    if (!earlyPublishRejected) throw error
  }
  assert.ok(earlyPublishRejected, 'Results should not publish before voting ends')
  assert.equal(await provider.connection.getAccountInfo(results), null, 'Failed result creation must roll back')

  const voteAccounts = await program.account.voteAccount.all()
  const ballots = voteAccounts.filter(({ account }) => account.pollId.toNumber() === pollId)
  assert.equal(ballots.length, 1, 'Only the first ballot should be stored')

  const decryptedVotes = ballots.map(({ account }) => {
    const data = Buffer.from(account.encryptedVote)
    const plaintext = nacl.box.open(data.subarray(56), data.subarray(32, 56), data.subarray(0, 32), tallyKey.secretKey)
    assert.ok(plaintext, 'Ballot should decrypt with the poll tally key')
    return Buffer.from(plaintext).toString('utf8')
  })
  assert.deepEqual(decryptedVotes, ['Option A'])

  let currentChainTime = await provider.connection.getBlockTime(await provider.connection.getSlot('confirmed'))
  while (currentChainTime === null || currentChainTime <= endTime) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    currentChainTime = await provider.connection.getBlockTime(await provider.connection.getSlot('confirmed'))
  }

  const voteCounts = ['Option A', 'Option B'].map((candidateName) => ({
    candidateName,
    voteCount: new anchor.BN(decryptedVotes.filter((vote) => vote === candidateName).length),
  }))
  await program.methods.publishResults(new anchor.BN(pollId), voteCounts).accounts({
    publisher: voter,
    pollAccount: poll,
    resultsAccount: results,
    systemProgram: SystemProgram.programId,
  }).rpc()

  const savedResults = await program.account.resultsAccount.fetch(results)
  assert.equal(savedResults.totalVotes.toNumber(), 1)
  assert.deepEqual(savedResults.results.map(({ candidateName, voteCount }) => [candidateName, voteCount.toNumber()]), [
    ['Option A', 1],
    ['Option B', 0],
  ])

  console.log(JSON.stringify({
    programId: programId.toBase58(),
    pollId,
    ballotCount: ballots.length,
    doubleVoteRejected,
    earlyPublishRejected,
    results: savedResults.results.map(({ candidateName, voteCount }) => [candidateName, voteCount.toNumber()]),
    totalVotes: savedResults.totalVotes.toNumber(),
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
