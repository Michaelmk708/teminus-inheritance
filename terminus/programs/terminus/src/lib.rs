use anchor_lang::prelude::*;

// Replace this after running `anchor keys list`
declare_id!("6whJ6RmLqz8JZ9i9r335bvsff8gqxCmUfSB35EfeFJh5");

#[program]
pub mod terminus {
    use super::*;

    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        beneficiary: Pubkey,
        fiduciary: Pubkey,
        ai_oracle: Pubkey,
        medical_allowance: u64,
        deposit_amount: u64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault_account;
        vault.owner = ctx.accounts.owner.key();
        vault.beneficiary = beneficiary;
        vault.fiduciary = fiduciary;
        vault.ai_oracle = ai_oracle;
        vault.state = VaultState::Active;
        vault.last_heartbeat = Clock::get()?.unix_timestamp;
        vault.challenge_end_time = 0;
        vault.medical_allowance = medical_allowance;
        vault.claim_stake = 0;
        vault.pending_claim_type = 0;
        vault.bump = ctx.bumps.vault_account;

        // Transfer SOL to Vault
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.owner.key(),
            &vault.key(),
            deposit_amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.owner.to_account_info(),
                vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Emit Event for UI tracking
        emit!(VaultInitialized {
            owner: vault.owner,
            deposit_amount,
        });

        Ok(())
    }

    pub fn ping_heartbeat(ctx: Context<PingHeartbeat>) -> Result<()> {
        let vault = &mut ctx.accounts.vault_account;
        require!(vault.state == VaultState::Active, TerminusError::VaultNotActive);
        vault.last_heartbeat = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn trigger_challenge(
        ctx: Context<TriggerChallenge>, 
        claim_type: u8, 
        stake_amount: u64
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault_account;
        require!(vault.state == VaultState::Active, TerminusError::VaultNotActive);

        // Take the Stake
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.claimant.key(),
            &vault.key(),
            stake_amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.claimant.to_account_info(),
                vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        vault.claim_stake = stake_amount;
        vault.state = VaultState::ChallengePeriod;
        vault.pending_claim_type = claim_type;
        
        // HACKATHON DEMO: 5 SECONDS. 
        // PRODUCTION MAINNET: Clock::get()?.unix_timestamp + 2592000; // (30 days in seconds)
        vault.challenge_end_time = Clock::get()?.unix_timestamp + 5; 

        emit!(ChallengeTriggered {
            vault: vault.key(),
            claim_type,
            end_time: vault.challenge_end_time,
        });

        Ok(())
    }

    pub fn panic_button(ctx: Context<PanicButton>) -> Result<()> {
        let vault = &mut ctx.accounts.vault_account;
        require!(vault.state == VaultState::ChallengePeriod, TerminusError::NotInChallenge);

        vault.state = VaultState::Active;
        vault.challenge_end_time = 0;
        vault.pending_claim_type = 0;
        
        let stake = vault.claim_stake;
        vault.claim_stake = 0;

        // Slash Stake
        **vault.to_account_info().try_borrow_mut_lamports()? -= stake;
        **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += stake;

        Ok(())
    }

    pub fn execute_claim(ctx: Context<ExecuteClaim>) -> Result<()> {
        let vault = &mut ctx.accounts.vault_account;
        require!(vault.state == VaultState::ChallengePeriod, TerminusError::NotInChallenge);
        
        let current_time = Clock::get()?.unix_timestamp;
        require!(current_time >= vault.challenge_end_time, TerminusError::ChallengePeriodActive);

        let payout: u64;

        if vault.pending_claim_type == 1 {
            vault.state = VaultState::Incapacitated;
            payout = vault.medical_allowance;
            **vault.to_account_info().try_borrow_mut_lamports()? -= payout;
            **ctx.accounts.fiduciary.to_account_info().try_borrow_mut_lamports()? += payout;
        } else {
            vault.state = VaultState::Deceased;
            let rent_exempt_minimum = Rent::get()?.minimum_balance(vault.to_account_info().data_len());
            payout = vault.to_account_info().lamports() - rent_exempt_minimum;
            **vault.to_account_info().try_borrow_mut_lamports()? -= payout;
            **ctx.accounts.beneficiary.to_account_info().try_borrow_mut_lamports()? += payout;
        }

        emit!(VaultExecuted {
            vault: vault.key(),
            claim_type: vault.pending_claim_type,
            amount_transferred: payout,
        });

        Ok(())
    }
}

// --- DATA STRUCTURES, EVENTS & ERRORS ---

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum VaultState {
    Active,
    ChallengePeriod,
    Incapacitated,
    Deceased,
}

#[account]
pub struct VaultAccount {
    pub owner: Pubkey,
    pub beneficiary: Pubkey,
    pub fiduciary: Pubkey,
    pub ai_oracle: Pubkey,
    pub state: VaultState,
    pub last_heartbeat: i64,
    pub challenge_end_time: i64,
    pub medical_allowance: u64,
    pub claim_stake: u64,
    pub pending_claim_type: u8,
    pub bump: u8,
}

#[event]
pub struct VaultInitialized {
    pub owner: Pubkey,
    pub deposit_amount: u64,
}

#[event]
pub struct ChallengeTriggered {
    pub vault: Pubkey,
    pub claim_type: u8,
    pub end_time: i64,
}

#[event]
pub struct VaultExecuted {
    pub vault: Pubkey,
    pub claim_type: u8,
    pub amount_transferred: u64,
}

// --- CONTEXTS ---

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + std::mem::size_of::<VaultAccount>(),
        seeds = [b"vault", owner.key().as_ref()],
        bump
    )]
    pub vault_account: Account<'info, VaultAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PingHeartbeat<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [b"vault", owner.key().as_ref()], bump = vault_account.bump)]
    pub vault_account: Account<'info, VaultAccount>,
}

#[derive(Accounts)]
pub struct TriggerChallenge<'info> {
    #[account(mut)]
    pub ai_oracle: Signer<'info>, 
    #[account(mut)]
    pub claimant: Signer<'info>, 
    #[account(
        mut, 
        seeds = [b"vault", vault_account.owner.as_ref()], 
        bump = vault_account.bump,
        has_one = ai_oracle @ TerminusError::UnauthorizedOracle
    )]
    pub vault_account: Account<'info, VaultAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PanicButton<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [b"vault", owner.key().as_ref()], bump = vault_account.bump, has_one = owner @ TerminusError::UnauthorizedOwner)]
    pub vault_account: Account<'info, VaultAccount>,
}

#[derive(Accounts)]
pub struct ExecuteClaim<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>, 
    #[account(mut)]
    /// CHECK: Validated by has_one below
    pub beneficiary: AccountInfo<'info>, 
    #[account(mut)]
    /// CHECK: Validated by has_one below
    pub fiduciary: AccountInfo<'info>,
    #[account(
        mut, 
        seeds = [b"vault", vault_account.owner.as_ref()], 
        bump = vault_account.bump,
        has_one = beneficiary,
        has_one = fiduciary
    )]
    pub vault_account: Account<'info, VaultAccount>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum TerminusError {
    #[msg("Vault is not Active.")]
    VaultNotActive,
    #[msg("Only the AI Oracle can trigger this.")]
    UnauthorizedOracle,
    #[msg("Only the Owner can press Panic.")]
    UnauthorizedOwner,
    #[msg("Vault is not in Challenge Period.")]
    NotInChallenge,
    #[msg("Challenge period has not expired.")]
    ChallengePeriodActive,
}