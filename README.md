# Veritas

Veritas is a Solana voting prototype with an Anchor program and a Next.js interface. Its persistent application state lives in Solana program accounts; the repository does not include a separate application database or backend service. It is an educational project, not a production election system or an independently audited protocol.

## Implemented flow

1. A wallet initializes the global poll counter, then creates a poll. Poll creation starts voting immediately and requires a future end time and 1 to 10 candidates.
2. The poll admin registers eligible voter addresses.
3. A registered voter signs a vote transaction during the voting window. The program rejects unregistered addresses and repeat votes from the same address.
4. The frontend encrypts the selected candidate with TweetNaCl `nacl.box`, using the poll's tallier public key, a fresh ephemeral keypair, and a 24-byte nonce. It stores the ephemeral public key, nonce, and ciphertext in a separate vote account derived from a caller-supplied random nullifier.
5. The admin interface reads ballot accounts, decrypts them off-chain with the corresponding secret key, calculates counts, and submits a result array.

The `VoteCastEvent` includes the voter's public key and timestamp. Although ballot content is encrypted, public identity and transaction timing can help correlate a registry update with a ballot account. The separate-account and nullifier design does not provide anonymity.

Only the poll admin may call `publish_results` after voting ends. The program checks that the result array has the poll's candidate names in the configured order and rejects count overflow. It does not verify the submitted counts against the encrypted ballots, so an incorrect admin tally can still be accepted. The results account is initialized once, so the first admin submission prevents later replacement through this program. The tally is not trustlessly verifiable by the contract. Do not use this prototype for real elections or sensitive votes.

The poll creator generates the TweetNaCl tally key in the browser. The interface offers it as a file download; there is no server-side key custody or recovery. The private key is not stored in program accounts. Losing it prevents decrypting the ballots, and only the poll admin may submit a result record after the poll ends.

## Local development

Requirements: Node.js, Solana CLI, Anchor CLI 0.31.1, and a Solana wallet such as Phantom or Solflare. The repository's Anchor configuration targets localnet.

```bash
git clone https://github.com/Prajwal-k-tech/Veritas.git
cd Veritas
npm install --legacy-peer-deps
npm run anchor-build
```

The legacy peer resolver is currently needed because the test-only `anchor-bankrun@0.5.0` dependency declares an Anchor 0.30 peer range while this project uses Anchor 0.31.1.

Start a local validator in a separate interactive terminal from the repository root. Anchor loads the freshly built program at the address in `Anchor.toml`; this is a local deployment, not a public-cluster release. Leave this terminal open while using the app or running the smoke check. Press Enter in it to stop the validator.

```bash
npm run anchor-localnet
```

In another terminal, run the local transaction smoke check. It creates a poll, registers and casts one encrypted ballot, checks duplicate-vote and early-result rejection, decrypts the ballot locally, waits for the on-chain voting deadline, publishes the locally calculated count, and fetches the stored result record:

```bash
npm run anchor-localnet-smoke
```

Start the frontend from the repository root:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and connect a wallet configured for localnet. The frontend wallet must use the same local validator and have local SOL.

### Localnet verification

Verified on 4 October 2026 with Anchor CLI 0.31.1 and Agave/Solana CLI 2.1.0. `npm run anchor-build` succeeded, and `npm run anchor-localnet` loaded the compiled program at `H2S4xQeQgwSSZ1nyRjqP6KmSL4gLqcFSYuo69XNqHcy7`. The program bytes dumped from the validator matched `anchor/target/deploy/voting.so` by SHA-256. The smoke check confirmed one decrypted `Option A` ballot, rejected a second vote from the same address with `AlreadyVoted`, rejected early publication with `VotingNotEnded`, then fetched a result record containing `Option A: 1`, `Option B: 0`, total `1`.

## Contract checks

After compiling the program, run `npm run test:contracts` for the local bankrun lifecycle and rejection checks, and `npm run test:rust` for tally validation. The tests use generated local accounts and do not contact a public chain. `npm run anchor-localnet-smoke` additionally checks a real local validator.

**Contract verification (7 October 2026):** the program rebuilt successfully with the official `solanafoundation/anchor:v0.31.1` image (Anchor 0.31.1, Solana CLI 2.1.0; image digest `sha256:21ab8a16e19df4301a198d7a55ab2988549aa2d996e6b5ad229c1d95b9f2d326`). The rebuilt `voting.so` SHA-256 is `ac91b7b2b5bb8bd5f6907f7c0aaa0bc9d685e2d52b1e5dc81f59a42d9c62bad7`. The bankrun suite passes 11 tests covering voter authorization, registration state, ballot encryption/decryption, duplicate votes, start/end boundaries, rollback on invalid ballots and poll creation, candidate limits, and tally validation. A second smoke run used an Agave 2.1.0 local validator with that exact program binary and a throwaway wallet. It accepted one encrypted ballot, rejected repeat voting, early publication, unauthorized publication, and a candidate-name mismatch, then stored and retrieved the expected tally. Neither check contacts a public cluster or establishes production security.

## Stack and project guides

- Solana program written in Rust with Anchor
- Next.js 15 and React 19 frontend
- Solana wallet adapter
- TweetNaCl.js for client-side ballot encryption
- Tailwind CSS and shadcn/ui components

## On-chain persistence and security limits

- `PollAccount` stores public poll metadata, candidates, times, admin address, and tally public key. A `VoterRegistry` PDA is derived from the poll ID and voter address and stores registration and whether that address has voted.
- `VoteAccount` stores the poll ID, random nullifier, and encrypted ballot bytes in a separate PDA. The transaction still names the voter signer and ballot account; `VoteCastEvent` also includes voter address and timestamp. Separate accounts and random nullifiers do not provide anonymity or stop transaction correlation.
- Ballot bytes are readable on the public chain. Encryption hides the selected candidate from readers who lack the tally private key; it does not hide wallet addresses, registration, timing, or account relationships.
- The poll creator's tally key can decrypt ballots, but the program does not enforce who holds or uses it. Only the poll admin may submit results after voting ends.
- `ResultsAccount` stores caller-submitted candidate names, counts, and total. The program validates candidate count and ordered names against the poll and rejects total-count overflow. It does not cryptographically verify counts against encrypted ballots.
- The results PDA can be created only once, so the admin’s first tally occupies the result address with no correction flow through this program.
- No independent security review or production readiness evidence is documented.

Treat the system as a prototype for studying blockchain application design and privacy trade-offs.

## Further reading

- [Solana documentation](https://solana.com/docs)
- [Anchor documentation](https://www.anchor-lang.com/docs)
- [TweetNaCl.js](https://github.com/dchest/tweetnacl-js)
- [Next.js documentation](https://nextjs.org/docs)
