#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env,
    String, Symbol, Vec,
};

// ─── Error Types ─────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    JobNotFound = 1,
    Unauthorized = 2,
    InvalidAmount = 3,
    AlreadyFunded = 4,
    NotFunded = 5,
    MilestoneNotFound = 6,
    InvalidMilestoneStatus = 7,
    DoubleRelease = 8,
    ArithmeticError = 9,
    JobNotCancellable = 10,
    NoMilestonesProvided = 11,
    TooManyMilestones = 12,
    ZeroAmountMilestone = 13,
}

// ─── Data Structures ─────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum JobStatus {
    Created,
    Funded,
    InProgress,
    Completed,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MilestoneStatus {
    Pending,
    Submitted,
    Approved,
    Released,
    Refunded,
    Disputed,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Milestone {
    pub index: u32,
    pub amount: i128,
    pub description: String,
    pub status: MilestoneStatus,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Job {
    pub id: u64,
    pub client: Address,
    pub freelancer: Address,
    pub token: Address,
    pub total_amount: i128,
    pub milestones: Vec<Milestone>,
    pub status: JobStatus,
}

// ─── Storage Keys ────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Job(u64),
    JobCounter,
    ClientJobs(Address),
    FreelancerJobs(Address),
}

// ─── Events ──────────────────────────────────────────────────────────────────

#[contractevent]
pub struct JobCreated {
    pub job_id: u64,
    pub client: Address,
    pub freelancer: Address,
}

#[contractevent]
pub struct JobFunded {
    pub job_id: u64,
    pub funder: Address,
    pub amount: i128,
}

#[contractevent]
pub struct MilestoneSubmitted {
    pub job_id: u64,
    pub milestone_index: u32,
    pub freelancer: Address,
}

#[contractevent]
pub struct MilestoneReleased {
    pub job_id: u64,
    pub milestone_index: u32,
    pub client: Address,
    pub amount: i128,
}

#[contractevent]
pub struct MilestoneDisputed {
    pub job_id: u64,
    pub milestone_index: u32,
    pub client: Address,
}

#[contractevent]
pub struct JobRefunded {
    pub job_id: u64,
    pub client: Address,
    pub amount: i128,
}

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Create a new job with milestones. Returns the job ID.
    pub fn create_job(
        env: Env,
        client: Address,
        freelancer: Address,
        token: Address,
        milestone_data: Vec<(i128, String)>,
    ) -> Result<u64, Error> {
        client.require_auth();

        if milestone_data.is_empty() {
            return Err(Error::NoMilestonesProvided);
        }
        if milestone_data.len() > 50 {
            return Err(Error::TooManyMilestones);
        }

        let mut milestones: Vec<Milestone> = Vec::new(&env);
        let mut total_amount: i128 = 0_i128;

        for (i, (amount, description)) in milestone_data.iter().enumerate() {
            if amount <= 0 {
                return Err(Error::ZeroAmountMilestone);
            }
            total_amount = total_amount
                .checked_add(amount)
                .ok_or(Error::ArithmeticError)?;
            milestones.push_back(Milestone {
                index: i as u32,
                amount,
                description,
                status: MilestoneStatus::Pending,
            });
        }

        let job_id: u64 = env
            .storage()
            .instance()
            .get::<_, u64>(&DataKey::JobCounter)
            .unwrap_or(0)
            .checked_add(1)
            .ok_or(Error::ArithmeticError)?;

        env.storage().instance().set(&DataKey::JobCounter, &job_id);

        let job = Job {
            id: job_id,
            client: client.clone(),
            freelancer: freelancer.clone(),
            token,
            total_amount,
            milestones,
            status: JobStatus::Created,
        };

        env.storage().persistent().set(&DataKey::Job(job_id), &job);

        let mut client_jobs: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::ClientJobs(client.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        client_jobs.push_back(job_id);
        env.storage()
            .persistent()
            .set(&DataKey::ClientJobs(client.clone()), &client_jobs);

        let mut fl_jobs: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::FreelancerJobs(freelancer.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        fl_jobs.push_back(job_id);
        env.storage()
            .persistent()
            .set(&DataKey::FreelancerJobs(freelancer.clone()), &fl_jobs);

        JobCreated {
            job_id,
            client,
            freelancer,
        }
        .publish(&env);

        Ok(job_id)
    }

    /// Client deposits stablecoin equal to total_amount into escrow.
    pub fn fund_job(env: Env, job_id: u64, from: Address, amount: i128) -> Result<(), Error> {
        from.require_auth();

        let mut job: Job = env
            .storage()
            .persistent()
            .get(&DataKey::Job(job_id))
            .ok_or(Error::JobNotFound)?;

        if from != job.client {
            return Err(Error::Unauthorized);
        }
        if matches!(
            job.status,
            JobStatus::Funded | JobStatus::InProgress | JobStatus::Completed
        ) {
            return Err(Error::AlreadyFunded);
        }
        if amount != job.total_amount {
            return Err(Error::InvalidAmount);
        }

        let token_client = token::Client::new(&env, &job.token);
        token_client.transfer(&from, &env.current_contract_address(), &amount);

        job.status = JobStatus::Funded;
        env.storage().persistent().set(&DataKey::Job(job_id), &job);

        JobFunded {
            job_id,
            funder: from,
            amount,
        }
        .publish(&env);

        Ok(())
    }

    /// Freelancer marks a milestone as submitted for review.
    pub fn submit_milestone(
        env: Env,
        job_id: u64,
        milestone_index: u32,
        freelancer: Address,
    ) -> Result<(), Error> {
        freelancer.require_auth();

        let mut job: Job = env
            .storage()
            .persistent()
            .get(&DataKey::Job(job_id))
            .ok_or(Error::JobNotFound)?;

        if freelancer != job.freelancer {
            return Err(Error::Unauthorized);
        }
        if !matches!(job.status, JobStatus::Funded | JobStatus::InProgress) {
            return Err(Error::NotFunded);
        }

        let milestone = job
            .milestones
            .get(milestone_index)
            .ok_or(Error::MilestoneNotFound)?;

        if !matches!(milestone.status, MilestoneStatus::Pending) {
            return Err(Error::InvalidMilestoneStatus);
        }

        let updated = Milestone {
            status: MilestoneStatus::Submitted,
            ..milestone
        };
        job.milestones.set(milestone_index, updated);

        if matches!(job.status, JobStatus::Funded) {
            job.status = JobStatus::InProgress;
        }

        env.storage().persistent().set(&DataKey::Job(job_id), &job);

        MilestoneSubmitted {
            job_id,
            milestone_index,
            freelancer,
        }
        .publish(&env);

        Ok(())
    }

    /// Client approves a submitted milestone and releases funds to freelancer.
    pub fn approve_milestone(
        env: Env,
        job_id: u64,
        milestone_index: u32,
        client: Address,
    ) -> Result<(), Error> {
        client.require_auth();

        let mut job: Job = env
            .storage()
            .persistent()
            .get(&DataKey::Job(job_id))
            .ok_or(Error::JobNotFound)?;

        if client != job.client {
            return Err(Error::Unauthorized);
        }

        let milestone = job
            .milestones
            .get(milestone_index)
            .ok_or(Error::MilestoneNotFound)?;

        if matches!(milestone.status, MilestoneStatus::Released) {
            return Err(Error::DoubleRelease);
        }
        if !matches!(milestone.status, MilestoneStatus::Submitted) {
            return Err(Error::InvalidMilestoneStatus);
        }

        let released_amount = milestone.amount;

        let token_client = token::Client::new(&env, &job.token);
        token_client.transfer(
            &env.current_contract_address(),
            &job.freelancer,
            &released_amount,
        );

        let updated = Milestone {
            status: MilestoneStatus::Released,
            ..milestone
        };
        job.milestones.set(milestone_index, updated);

        let all_done = job.milestones.iter().all(|m| {
            matches!(
                m.status,
                MilestoneStatus::Released | MilestoneStatus::Refunded
            )
        });
        if all_done {
            job.status = JobStatus::Completed;
        }

        env.storage().persistent().set(&DataKey::Job(job_id), &job);

        MilestoneReleased {
            job_id,
            milestone_index,
            client,
            amount: released_amount,
        }
        .publish(&env);

        Ok(())
    }

    /// Client rejects/disputes a submitted milestone; funds stay locked.
    pub fn reject_milestone(
        env: Env,
        job_id: u64,
        milestone_index: u32,
        client: Address,
        _reason: String,
    ) -> Result<(), Error> {
        client.require_auth();

        let mut job: Job = env
            .storage()
            .persistent()
            .get(&DataKey::Job(job_id))
            .ok_or(Error::JobNotFound)?;

        if client != job.client {
            return Err(Error::Unauthorized);
        }

        let milestone = job
            .milestones
            .get(milestone_index)
            .ok_or(Error::MilestoneNotFound)?;

        if !matches!(milestone.status, MilestoneStatus::Submitted) {
            return Err(Error::InvalidMilestoneStatus);
        }

        let updated = Milestone {
            status: MilestoneStatus::Disputed,
            ..milestone
        };
        job.milestones.set(milestone_index, updated);
        env.storage().persistent().set(&DataKey::Job(job_id), &job);

        MilestoneDisputed {
            job_id,
            milestone_index,
            client,
        }
        .publish(&env);

        Ok(())
    }

    /// Refund remaining undisbursed escrow back to client.
    pub fn refund(env: Env, job_id: u64, client: Address) -> Result<i128, Error> {
        client.require_auth();

        let mut job: Job = env
            .storage()
            .persistent()
            .get(&DataKey::Job(job_id))
            .ok_or(Error::JobNotFound)?;

        if client != job.client {
            return Err(Error::Unauthorized);
        }
        if matches!(
            job.status,
            JobStatus::Created | JobStatus::Completed | JobStatus::Cancelled
        ) {
            return Err(Error::JobNotCancellable);
        }

        let mut refund_amount: i128 = 0_i128;
        let mut updated_milestones: Vec<Milestone> = Vec::new(&env);

        for milestone in job.milestones.iter() {
            if matches!(
                milestone.status,
                MilestoneStatus::Pending | MilestoneStatus::Disputed
            ) {
                refund_amount = refund_amount
                    .checked_add(milestone.amount)
                    .ok_or(Error::ArithmeticError)?;
                updated_milestones.push_back(Milestone {
                    status: MilestoneStatus::Refunded,
                    ..milestone
                });
            } else {
                updated_milestones.push_back(milestone);
            }
        }

        if refund_amount > 0 {
            let token_client = token::Client::new(&env, &job.token);
            token_client.transfer(&env.current_contract_address(), &client, &refund_amount);
        }

        job.milestones = updated_milestones;
        job.status = JobStatus::Cancelled;
        env.storage().persistent().set(&DataKey::Job(job_id), &job);

        JobRefunded {
            job_id,
            client,
            amount: refund_amount,
        }
        .publish(&env);

        Ok(refund_amount)
    }

    /// Read-only: full job details.
    pub fn get_job(env: Env, job_id: u64) -> Result<Job, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Job(job_id))
            .ok_or(Error::JobNotFound)
    }

    /// Read-only: job IDs for an address.
    pub fn list_jobs_by_address(env: Env, address: Address) -> Vec<u64> {
        let mut jobs: Vec<u64> = Vec::new(&env);

        let client_jobs: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::ClientJobs(address.clone()))
            .unwrap_or_else(|| Vec::new(&env));

        let fl_jobs: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::FreelancerJobs(address.clone()))
            .unwrap_or_else(|| Vec::new(&env));

        for id in client_jobs.iter() {
            jobs.push_back(id);
        }
        for id in fl_jobs.iter() {
            if !jobs.iter().any(|j| j == id) {
                jobs.push_back(id);
            }
        }
        jobs
    }

    /// Read-only: total jobs created.
    pub fn get_job_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get::<_, u64>(&DataKey::JobCounter)
            .unwrap_or(0)
    }
}

mod test;
