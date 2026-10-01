# Veritas

Veritas is a Solana voting prototype with an Anchor program and a Next.js interface. The program creates polls, registers voter addresses, accepts encrypted ballots, and stores a submitted result record. It is an educational project, not a production election system or an independently audited protocol.

## Implemented flow

1. A wallet initializes the global poll counter, then creates a poll. Poll creation starts voting immediately and requires a future end time and 1 to 10 candidates.
2. The poll admin registers eligible voter addresses.
3. A registered voter signs a vote transaction during the voting window. The program rejects unregistered addresses and repeat votes from the same address.
4. The frontend encrypts the selected candidate with TweetNaCl `nacl.box`, using the poll's tallier public key, a fresh ephemeral keypair, and a 24-byte nonce. It stores the ephemeral public key, nonce, and ciphertext in a separate vote account derived from a caller-supplied random nullifier.
5. The admin interface reads ballot accounts, decrypts them off-chain with the corresponding secret key, calculates counts, and submits a result array.

The `VoteCastEvent` includes the voter's public key and timestamp. Although ballot content is encrypted, public identity and transaction timing can help correlate a registry update with a ballot account. The separate-account and nullifier design does not provide anonymity.

Anyone may call `publish_results` after voting ends. The program checks only that the result array has the same number of entries as the poll's candidates. It does not check candidate names or counts against ballots. The results account is initialized once, so the first caller can publish fabricated results and prevent later replacement. The tally is not trustlessly verifiable by the contract. Do not use this prototype for real elections or sensitive votes.

## Local development

Requirements: Node.js, Solana CLI, Anchor CLI 0.31.1, and a Solana wallet such as Phantom or Solflare. The repository's Anchor configuration targets localnet.

```bash
git clone https://github.com/Prajwal-k-tech/Veritas.git
cd Veritas
npm install
npm run anchor-build
```

Start the local validator and program deployment flow in a separate terminal from the repository root:

```bash
npm run anchor-localnet
```

Start the frontend from the repository root:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and connect a wallet configured for localnet. Deployment and wallet configuration must match the local setup. These commands follow the repository package scripts and Anchor config; they were not executed for this draft.

## Stack and project guides

- Solana program written in Rust with Anchor
- Next.js 15 and React 19 frontend
- Solana wallet adapter
- TweetNaCl.js for client-side ballot encryption
- Tailwind CSS and shadcn/ui components

The repository retains two hackathon-era guides as historical artifacts. Their privacy and security claims are superseded by this README and the protocol notes in the app; neither guide describes verified security properties.

## Privacy and security limits

- The public chain exposes voter registration and voting activity, including voter identity and vote timestamp in an event.
- Separate accounts and random nullifiers do not prevent timing or transaction correlation.
- The poll's tally private key can decrypt ballot contents, but key possession is not enforced on-chain. Any signer may submit a result after voting ends.
- The program does not verify that published counts match encrypted ballots or that result names match poll candidates.
- Publishing results is permissionless after the poll ends. The account can be created only once, so there is no on-chain correction flow for a fabricated first tally.
- No independent security review or production readiness evidence is documented.

Treat the system as a prototype for studying blockchain application design and privacy trade-offs.

## Further reading

- [Solana documentation](https://solana.com/docs)
- [Anchor documentation](https://www.anchor-lang.com/docs)
- [TweetNaCl.js](https://github.com/dchest/tweetnacl-js)
- [Next.js documentation](https://nextjs.org/docs)
