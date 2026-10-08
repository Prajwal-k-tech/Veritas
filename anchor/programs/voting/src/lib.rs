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
        end_time: u64,
        name: String,
        description: String,
        candidates: Vec<String>,
        tallier_pubkey: [u8; 32], // Admin's encryption public key
    ) -> Result<()> {
        let current_time = Clock::get()?.unix_timestamp;
        
        require!(candidates.len() <= 10, ErrorCode::TooManyCandidates); // At most 10 candidates.
        require!(candidates.len() > 0, ErrorCode::NoCandidates); // At least one candidate.
        // Poll starts NOW (blockchain time), end time must be in future
        require!(end_time as i64 > current_time, ErrorCode::InvalidTimeRange);

        let poll = &mut ctx.accounts.poll_account; //the poll being created
        let counter = &mut ctx.accounts.counter; //counter has its own account 

        poll.poll_id = counter.next_poll_id;
        poll.admin = ctx.accounts.admin.key();
        poll.poll_name = name.clone();
        poll.poll_description = description.clone();
        poll.poll_voting_start = current_time as u64; //start immediately (blockchain time ) 
        poll.poll_voting_end = end_time;
        poll.candidates = candidates.clone();
        poll.tallier_pubkey = tallier_pubkey;

        counter.next_poll_id += 1; //counter incremented for next poll 

        emit!(PollCreatedEvent {
            poll_id: poll.poll_id,
            admin: poll.admin,
            name,
            description,
            candidates,
            start_time: poll.poll_voting_start,
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
        nullifier: [u8; 32], // Random value for the VoteAccount PDA; it does not hide public transaction metadata
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

        // Store encrypted ballot bytes in a VoteAccount derived from the nullifier.
        // The public transaction still includes the voter and VoteAccount accounts.
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

    // Only the poll admin may publish a structurally valid tally after voting ends.
    pub fn publish_results(
        ctx: Context<PublishResults>,
        _poll_id: u64,
        results: Vec<CandidateResult>,
    ) -> Result<()> {
        let current_time = Clock::get()?.unix_timestamp;
        let poll = &ctx.accounts.poll_account;

        require_keys_eq!(ctx.accounts.publisher.key(), poll.admin, anchor_lang::error::ErrorCode::ConstraintHasOne);

        // Ensure voting has ended
        require!(
            current_time > poll.poll_voting_end as i64,
            ErrorCode::VotingNotEnded
        );

        let results_account = &mut ctx.accounts.results_account;
        let total = validate_tally(&results, &poll.candidates)?;

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
    // Ballots use separate VoteAccounts derived from a nullifier. The public
    // transaction still exposes the voter signer and VoteAccount relationship.
}

#[account]
#[derive(InitSpace)]
pub struct VoteAccount {
    pub poll_id: u64,
    #[max_len(150)] // TweetNaCl: 32 (ephemeral_key) + 24 (nonce) + 32 (max candidate) + 16 (MAC) + buffer
    pub encrypted_vote: Vec<u8>,
    pub nullifier: [u8; 32], // Random value used in the VoteAccount PDA seed; it does not provide anonymity
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
    // Reserved in place to preserve the numeric codes of later errors for existing clients.
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

// A trusted admin still supplies counts; this validates shape, names and arithmetic,
// not that the encrypted ballots cryptographically support the tally.
fn validate_tally(results: &[CandidateResult], candidates: &[String]) -> Result<u64> {
    require!(results.len() == candidates.len(), ErrorCode::InvalidTallyCount);
    let mut total = 0u64;
    for (result, candidate) in results.iter().zip(candidates) {
        require!(result.candidate_name == *candidate, ErrorCode::InvalidTallyCount);
        total = total.checked_add(result.vote_count).ok_or(ErrorCode::InvalidTallyCount)?;
    }
    Ok(total)
}

#[cfg(test)]
mod tally_tests {
    use super::*;
    fn result(name: &str, count: u64) -> CandidateResult {
        CandidateResult { candidate_name: name.into(), vote_count: count }
    }
    #[test]
    fn valid_tally_and_empty_counts() {
        let candidates = vec!["A".into(), "B".into()];
        assert_eq!(validate_tally(&[result("A", 1), result("B", 2)], &candidates).unwrap(), 3);
        assert_eq!(validate_tally(&[result("A", 0), result("B", 0)], &candidates).unwrap(), 0);
    }
    #[test]
    fn rejects_missing_unknown_reordered_and_overflowing_results() {
        let candidates = vec!["A".into(), "B".into()];
        for results in [vec![result("A", 1)], vec![result("X", 1), result("B", 0)],
            vec![result("B", 1), result("A", 0)], vec![result("A", u64::MAX), result("B", 1)]] {
            assert!(validate_tally(&results, &candidates).is_err());
        }
    }
}
