'use client'

import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Voting } from '@/../anchor/target/types/voting'
import IDL from '@/../anchor/target/idl/voting.json'

const PROGRAM_ID = new PublicKey('H2S4xQeQgwSSZ1nyRjqP6KmSL4gLqcFSYuo69XNqHcy7')

export function useVotingProgram() {
  const { connection } = useConnection()
  const wallet = useWallet()

  const provider = useMemo(() => {
    if (!wallet.publicKey) return null
    return new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' })
  }, [connection, wallet])

  const program = useMemo(() => {
    if (!provider) return null
    return new Program(IDL as Voting, provider)
  }, [provider])

  // Derive PDAs
  const getCounterPDA = () => {
    return PublicKey.findProgramAddressSync([Buffer.from('global_counter')], PROGRAM_ID)[0]
  }

  const getPollPDA = (pollId: number) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('poll'), new BN(pollId).toArrayLike(Buffer, 'le', 8)],
      PROGRAM_ID
    )[0]
  }

  const getVoterRegistryPDA = (pollId: number, voter: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('voter'),
        new BN(pollId).toArrayLike(Buffer, 'le', 8),
        voter.toBuffer(),
      ],
      PROGRAM_ID
    )[0]
  }

  const getResultsPDA = (pollId: number) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('results'), new BN(pollId).toArrayLike(Buffer, 'le', 8)],
      PROGRAM_ID
    )[0]
  }

  // Initialize counter mutation
  const initializeCounter = useMutation({
    mutationFn: async () => {
      if (!program || !wallet.publicKey) throw new Error('Wallet not connected')
      
      const tx = await program.methods
        .initializeCounter()
        .accounts({
          admin: wallet.publicKey,
        })
        .rpc()
      
      return tx
    },
  })

  // Initialize poll mutation
  const initializePoll = useMutation({
    mutationFn: async (params: {
      startTime: BN
      endTime: BN
      name: string
      description: string
      candidates: string[]
      tallierPubkey: number[]
    }) => {
      if (!program || !wallet.publicKey) throw new Error('Wallet not connected')
      
      const counterPDA = getCounterPDA()
      
      const tx = await program.methods
        .initializePoll(
          params.startTime,
          params.endTime,
          params.name,
          params.description,
          params.candidates,
          params.tallierPubkey
        )
        .accounts({
          admin: wallet.publicKey,
          counter: counterPDA,
        })
        .rpc()
      
      return tx
    },
  })

  // Register voter mutation
  const registerVoter = useMutation({
    mutationFn: async (params: { pollId: number; voter: PublicKey }) => {
      if (!program || !wallet.publicKey) throw new Error('Wallet not connected')
      
      const pollPDA = getPollPDA(params.pollId)
      
      const tx = await program.methods
        .registerVoter(new BN(params.pollId))
        .accounts({
          pollAccount: pollPDA,
          admin: wallet.publicKey,
          voter: params.voter,
        })
        .rpc()
      
      return tx
    },
  })

  // Vote mutation
  const vote = useMutation({
    mutationFn: async (params: { pollId: number; nullifier: number[]; encryptedVote: Buffer }) => {
      if (!program || !wallet.publicKey) throw new Error('Wallet not connected')
      
      const pollPDA = getPollPDA(params.pollId)
      const voterRegistryPDA = getVoterRegistryPDA(params.pollId, wallet.publicKey)
      
      // Derive vote account PDA from poll_id and nullifier
      const [voteAccountPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('vote'),
          new BN(params.pollId).toArrayLike(Buffer, 'le', 8),
          Buffer.from(params.nullifier),
        ],
        program.programId
      )
      
      const tx = await program.methods
        .vote(
          new BN(params.pollId),
          params.nullifier,
          params.encryptedVote
        )
        .accounts({
          pollAccount: pollPDA,
          voterRegistry: voterRegistryPDA,
          voter: wallet.publicKey,
          voteAccount: voteAccountPDA,
        })
        .rpc()
      
      return tx
    },
  })

  // Publish results mutation
  const publishResults = useMutation({
    mutationFn: async (params: {
      pollId: number
      results: { candidateName: string; voteCount: BN }[]
    }) => {
      if (!program || !wallet.publicKey) throw new Error('Wallet not connected')
      
      const pollPDA = getPollPDA(params.pollId)
      
      const tx = await program.methods
        .publishResults(new BN(params.pollId), params.results)
        .accounts({
          publisher: wallet.publicKey,
          pollAccount: pollPDA,
        })
        .rpc()
      
      return tx
    },
  })

  // Fetch counter query
  const useCounter = () => {
    return useQuery({
      queryKey: ['voting', 'counter'],
      queryFn: async () => {
        if (!program) return null
        const pda = getCounterPDA()
        return await (program.account as any).globalPollCounter.fetch(pda)
      },
      enabled: !!program,
    })
  }

  // Fetch poll query
  const usePoll = (pollId: number) => {
    return useQuery({
      queryKey: ['voting', 'poll', pollId],
      queryFn: async () => {
        if (!program) return null
        const pda = getPollPDA(pollId)
        return await (program.account as any).pollAccount.fetch(pda)
      },
      enabled: !!program && pollId > 0,
    })
  }

  // Fetch voter registry query
  const useVoterRegistry = (pollId: number, voter: string) => {
    return useQuery({
      queryKey: ['voting', 'voter', pollId, voter],
      queryFn: async () => {
        if (!program) throw new Error('Program not initialized')
        try {
          const voterPubkey = new PublicKey(voter)
          const pda = getVoterRegistryPDA(pollId, voterPubkey)
          return await (program.account as any).voterRegistry.fetch(pda)
        } catch (error) {
          console.log('Voter not registered:', error)
          return null
        }
      },
    })
  }  // Fetch results query
  const useResults = (pollId: number) => {
    return useQuery({
      queryKey: ['voting', 'results', pollId],
      queryFn: async () => {
        if (!program) return null
        const pda = getResultsPDA(pollId)
        try {
          return await (program.account as any).resultsAccount.fetch(pda)
        } catch {
          return null // Not published yet
        }
      },
      enabled: !!program && pollId > 0,
    })
  }

  return {
    program,
    programId: PROGRAM_ID,
    initializeCounter,
    initializePoll,
    registerVoter,
    vote,
    publishResults,
    useCounter,
    usePoll,
    useVoterRegistry,
    useResults,
    getPollPDA,
    getCounterPDA,
    getVoterRegistryPDA,
    getResultsPDA,
  }
}
