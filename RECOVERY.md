# Recovery after a fresh clone

This file records how to restore a working checkout without retaining dependency caches or compiler output.

```bash
git clone --recurse-submodules https://github.com/Prajwal-k-tech/Veritas.git
cd Veritas
```

Start with the committed README for configuration and prerequisites. Git restores committed source and assets. Dependency directories, virtual environments and compiler caches can be rebuilt.

## Veritas localnet

Use Node.js, Anchor CLI **0.31.1** and Agave/Solana CLI **2.1.0**, matching the repository's recorded verification. Install dependencies from the lockfile:

```bash
npm ci --legacy-peer-deps
npm run anchor-build
```

The official build image used previously is pinned by digest:

```bash
docker pull solanafoundation/anchor@sha256:21ab8a16e19df4301a198d7a55ab2988549aa2d996e6b5ad229c1d95b9f2d326
```

`anchor/target/debug`, `anchor/target/release`, `anchor/target/sbpf-solana-solana`, `node_modules`, and `.next` are compiler/dependency output. They can be removed while this project is inactive. Keep the committed IDL/type files in `anchor/target/idl` and `anchor/target/types` where present.

### Keys and local test state

The faucet, validator, stake and vote keys under `anchor/.anchor/test-ledger` belong to the throwaway local validator. A fresh local ledger regenerates local test identities; deleting it discards old local accounts and transactions. It does not restore a public-cluster deployment. See [Solana's local-validator guide](https://solana.com/docs/toolkit/local-validator).

The **program deployment key** `anchor/target/deploy/voting-keypair.json` is different. To reuse the existing program address, restore that key from your private key backup. Never commit it, a wallet, or browser-exported ballot tally secrets. Your provider wallet in `~/.config/solana/id.json` is separate and must be preserved or intentionally replaced.

For a completely fresh local prototype with a newly generated program key:

1. Build once to generate the program key, then run `(cd anchor && anchor keys sync)`.
2. Obtain its public key with `solana-keygen pubkey anchor/target/deploy/voting-keypair.json`. Update the hard-coded `PROGRAM_ID` in `src/components/voting/voting-data-access.tsx` and the displayed address in `src/app/audit/page.tsx`.
3. Run `npm run anchor-build` again so the IDL and compiled program agree.
4. Run `npm run anchor-localnet`, then `npm run anchor-localnet-smoke` from another terminal. `npm run test:contracts` and `npm run test:rust` are the existing focused checks.

[Anchor documents key synchronization](https://www.anchor-lang.com/docs/basics/program-structure). A newly generated key cannot recover an old wallet, the same program address, or previously encrypted ballots.

No fresh full toolchain download/build was run for this recovery document; the commands and versions are based on the repository's existing scripts and recorded verification.

## Data that Git does not restore

A clone restores pushed commits, not unpublished edits, local `.env` files, private keys, trained model weights or local-only data. Preserve such artifacts separately until explicitly replaced, backed up off-device or discarded. Credentials must come from private storage or be regenerated through their provider. No credentials belong in this document.

## Owner-only local snapshot index

The owner's [private recovery index](https://github.com/Prajwal-k-tech/project-recovery-20261023) preserves retained local-only files and source history from the October 2026 offload. Access requires the owner's GitHub authorization. Use the public setup instructions above for a normal clone; downloaded datasets and discarded generated caches are not in that snapshot. Current credentials were excluded and kept in a tiny local private overlay.
