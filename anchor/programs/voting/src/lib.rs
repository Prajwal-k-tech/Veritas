use anchor_lang::prelude::*;

declare_id!("H2S4xQeQgwSSZ1nyRjqP6KmSL4gLqcFSYuo69XNqHcy7"); //Our Poll id

#[program]
pub mod voting { //smart contract name 
    use super::*;

    //Initialize the global poll counter, starts off at 1 duh
    pub fn initialize_counter(ctx: Context<InitializeCounter>) -> Result<()> {
        ctx.accounts.counter.next_poll_id = 1;
        Ok(())
    }
    //Create a new poll with auto-incrementing ID
    pub fn initialize_poll(
        ctx: Context<InitializePoll>,
        start_time: u64,
        end_time: u64,
        name: String,
        description: String,
        candidates: Vec<String>,
        tallier_pubkey: [u8; 32], // Admin's encryption public key
    ) -> Result<()> {
        let current_time = Clock::get()?.unix_timestamp;
        
        require!(candidates.len() <= 10, ErrorCode::TooManyCandidates); //max of 10 candidates
        require!(candidates.len() > 0, ErrorCode::NoCandidates); //make sure more than 1 duh 
        require!(start_time as i64 >= current_time, ErrorCode::InvalidStartTime); //start time must be now or future
        require!(end_time > start_time, ErrorCode::InvalidTimeRange); //make sure the time range is valid 

        let poll = &mut ctx.accounts.poll_account; //the poll being created
        let counter = &mut ctx.accounts.counter; //counter has its own account 

        poll.poll_id = counter.next_poll_id;
        poll.admin = ctx.accounts.admin.key();
        poll.poll_name = name.clone();
        poll.poll_description = description.clone();
        poll.poll_voting_start = start_time;
        poll.poll_voting_end = end_time;
        poll.candidates = candidates.clone();
        poll.tallier_pubkey = tallier_pubkey;

        // Increment counter for next poll
        counter.next_poll_id += 1;

        emit!(PollCreatedEvent {
            poll_id: poll.poll_id,
            admin: poll.admin,
            name,
            description,
            candidates,
            start_time,
            end_time,
        }); //log event

        Ok(())
    }

    // Admin registers a voter for a specific poll
    pub fn register_voter(
        ctx: Context<RegisterVoter>,
        _poll_id: u64,
    ) -> Result<()> {
        let voter_registry = &mut ctx.accounts.voter_registry;
        voter_registry.registered = true;
        voter_registry.has_voted = false;
        //registered these voters 
        emit!(VoterRegisteredEvent {
            poll_id: _poll_id,
            voter: ctx.accounts.voter.key(),
        });
        Ok(())
    }
    // Voter submits encrypted vote
    pub fn vote(
        ctx: Context<Vote>,
        _poll_id: u64,
        nullifier: [u8; 32], // Random value for anonymous PDA
        encrypted_vote: Vec<u8>, // Decrypted later by poll owner while tallying 
    ) -> Result<()> {
        let current_time = Clock::get()?.unix_timestamp;
        let poll = &ctx.accounts.poll_account;
        let voter_registry = &mut ctx.accounts.voter_registry;
        let vote_account = &mut ctx.accounts.vote_account;

        // Time validation
        require!(
            current_time >= poll.poll_voting_start as i64,
            ErrorCode::VotingNotStarted
        );
        require!(
            current_time <= poll.poll_voting_end as i64,
            ErrorCode::VotingEnded
        );

        // Voter validation
        require!(voter_registry.registered, ErrorCode::VoterNotRegistered);
        require!(!voter_registry.has_voted, ErrorCode::AlreadyVoted);
        
        // Validate encrypted vote size (minimum: 32 + 24 + 1 + 16 = 73 bytes)
        require!(encrypted_vote.len() >= 73, ErrorCode::InvalidEncryptedVote);

        // Store encrypted vote in ANONYMOUS vote account
        vote_account.poll_id = _poll_id;
        vote_account.encrypted_vote = encrypted_vote;
        vote_account.nullifier = nullifier;
        
        // Mark voter as having voted (prevents double voting)
        voter_registry.has_voted = true;

        emit!(VoteCastEvent {
            poll_id: _poll_id,
            voter: ctx.accounts.voter.key(),
            timestamp: current_time,
        });

        Ok(())
    }

    // Publish final results after voting ends (callable by anyone)
    pub fn publish_results(
        ctx: Context<PublishResults>,
        _poll_id: u64,
        results: Vec<CandidateResult>,
    ) -> Result<()> {
        let current_time = Clock::get()?.unix_timestamp;
        let poll = &ctx.accounts.poll_account;

        // Ensure voting has ended
        require!(
            current_time > poll.poll_voting_end as i64,
            ErrorCode::VotingNotEnded
        );

        // Validate results match candidates
        require!(
            results.len() == poll.candidates.len(),
            ErrorCode::InvalidTallyCount
        );

        let results_account = &mut ctx.accounts.results_account;
        let total: u64 = results.iter().map(|r| r.vote_count).sum();

        results_account.poll_id = _poll_id;
        results_account.results = results.clone();
        results_account.total_votes = total;

        emit!(ResultsPublishedEvent {
            poll_id: _poll_id,
            results,
            total_votes: total,
        });

        Ok(())
    }
}

// ============= ACCOUNT CONTEXTS =============

#[derive(Accounts)]
pub struct InitializeCounter<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + GlobalPollCounter::INIT_SPACE,
        seeds = [b"global_counter"],
        bump
    )]
    pub counter: Account<'info, GlobalPollCounter>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializePoll<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"global_counter"],
        bump
    )]
    pub counter: Account<'info, GlobalPollCounter>,

    #[account(
        init,
        payer = admin,
        space = 8 + PollAccount::INIT_SPACE,
        seeds = [b"poll", counter.next_poll_id.to_le_bytes().as_ref()],
        bump
    )]
    pub poll_account: Account<'info, PollAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct RegisterVoter<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [b"poll", poll_id.to_le_bytes().as_ref()],
        bump,
        has_one = admin
    )]
    pub poll_account: Account<'info, PollAccount>,

    /// CHECK: This is the voter being registered
    pub voter: AccountInfo<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + VoterRegistry::INIT_SPACE,
        seeds = [b"voter", poll_id.to_le_bytes().as_ref(), voter.key().as_ref()],
        bump
    )]
    pub voter_registry: Account<'info, VoterRegistry>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(poll_id: u64, nullifier: [u8; 32])]
pub struct Vote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        seeds = [b"poll", poll_id.to_le_bytes().as_ref()],
        bump
    )]
    pub poll_account: Account<'info, PollAccount>,

    #[account(
        mut,
        seeds = [b"voter", poll_id.to_le_bytes().as_ref(), voter.key().as_ref()],
        bump
    )]
    pub voter_registry: Account<'info, VoterRegistry>,

    #[account(
        init,
        payer = voter,
        space = 8 + 8 + (4 + 150) + 32, // discriminator + poll_id + Vec<u8> + nullifier
        seeds = [b"vote", poll_id.to_le_bytes().as_ref(), nullifier.as_ref()],
        bump
    )]
    pub vote_account: Account<'info, VoteAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct PublishResults<'info> {
    #[account(mut)]
    pub publisher: Signer<'info>,

    #[account(
        seeds = [b"poll", poll_id.to_le_bytes().as_ref()],
        bump
    )]
    pub poll_account: Account<'info, PollAccount>,

    #[account(
        init,
        payer = publisher,
        space = 8 + 8 + (4 + 10 * (4 + 32 + 8)) + 8, // discriminator + poll_id + Vec<CandidateResult> + total_votes
        seeds = [b"results", poll_id.to_le_bytes().as_ref()],
        bump
    )]
    pub results_account: Account<'info, ResultsAccount>,

    pub system_program: Program<'info, System>,
}

// ============= ACCOUNT DATA STRUCTURES =============

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CandidateResult {
    pub candidate_name: String,
    pub vote_count: u64,
}

#[account]
#[derive(InitSpace)]
pub struct GlobalPollCounter {
    pub next_poll_id: u64,
}

#[account]
#[derive(InitSpace)]
pub struct PollAccount {
    pub poll_id: u64,
    pub admin: Pubkey,
    #[max_len(32)]
    pub poll_name: String,
    #[max_len(280)]
    pub poll_description: String,
    pub poll_voting_start: u64,
    pub poll_voting_end: u64,
    #[max_len(10, 32)] // Max 10 candidates, each max 32 chars
    pub candidates: Vec<String>,
    pub tallier_pubkey: [u8; 32],
}

#[account]
#[derive(InitSpace)]
pub struct VoterRegistry {
    pub registered: bool,
    pub has_voted: bool,
    // encrypted_vote removed - votes stored in separate anonymous VoteAccount
}

#[account]
#[derive(InitSpace)]
pub struct VoteAccount {
    pub poll_id: u64,
    #[max_len(150)] // TweetNaCl: 32 (ephemeral_key) + 24 (nonce) + 32 (max candidate) + 16 (MAC) + buffer
    pub encrypted_vote: Vec<u8>,
    pub nullifier: [u8; 32], // Random value used in PDA seed for anonymity
}

#[account]
pub struct ResultsAccount {
    pub poll_id: u64,
    pub results: Vec<CandidateResult>,
    pub total_votes: u64,
}

// ============= EVENTS =============

#[event]
pub struct PollCreatedEvent {
    pub poll_id: u64,
    pub admin: Pubkey,
    pub name: String,
    pub description: String,
    pub candidates: Vec<String>,
    pub start_time: u64,
    pub end_time: u64,
}

#[event]
pub struct VoterRegisteredEvent {
    pub poll_id: u64,
    pub voter: Pubkey,
}

#[event]
pub struct VoteCastEvent {
    pub poll_id: u64,
    pub voter: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ResultsPublishedEvent {
    pub poll_id: u64,
    pub results: Vec<CandidateResult>,
    pub total_votes: u64,
}

//Errors: 

#[error_code] 
pub enum ErrorCode {
    #[msg("Voting has not started yet")]
    VotingNotStarted,
    #[msg("Voting has ended")]
    VotingEnded,
    #[msg("Voter is not registered for this poll")]
    VoterNotRegistered,
    #[msg("Voter has already voted")]
    AlreadyVoted,
    #[msg("Cannot have more than 10 candidates")]
    TooManyCandidates,
    #[msg("Poll must have at least one candidate")]
    NoCandidates,
    #[msg("Start time cannot be in the past")]
    InvalidStartTime,
    #[msg("End time must be after start time")]
    InvalidTimeRange,
    #[msg("Voting has not ended yet")]
    VotingNotEnded,
    #[msg("Tally count must match number of candidates")]
    InvalidTallyCount,
    #[msg("Encrypted vote data is invalid or too small")]
    InvalidEncryptedVote,
}