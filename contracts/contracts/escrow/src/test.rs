#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    vec, Address, Env, String,
};
use soroban_sdk::token::{StellarAssetClient, TokenClient};

fn create_test_env() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EscrowContract, ());
    let token_admin = Address::generate(&env);
    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);

    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();

    let token_admin_client = StellarAssetClient::new(&env, &token_id);
    token_admin_client.mint(&client_addr, &10_000_i128);

    (env, contract_id, token_id, client_addr, freelancer_addr)
}

fn make_milestones(env: &Env) -> Vec<(i128, String)> {
    vec![
        env,
        (1000_i128, String::from_str(env, "Design")),
        (2000_i128, String::from_str(env, "Development")),
        (500_i128, String::from_str(env, "Testing")),
    ]
}

#[test]
fn test_happy_path() {
    let (env, contract_id, token_id, client_addr, freelancer_addr) = create_test_env();
    let contract = EscrowContractClient::new(&env, &contract_id);
    let token = TokenClient::new(&env, &token_id);

    let milestones = make_milestones(&env);

    let job_id = contract.create_job(&client_addr, &freelancer_addr, &token_id, &milestones);
    assert_eq!(job_id, 1);

    contract.fund_job(&job_id, &client_addr, &3500_i128);
    assert_eq!(token.balance(&contract_id), 3500_i128);

    contract.submit_milestone(&job_id, &0_u32, &freelancer_addr);

    let fl_before = token.balance(&freelancer_addr);
    contract.approve_milestone(&job_id, &0_u32, &client_addr);
    assert_eq!(token.balance(&freelancer_addr), fl_before + 1000_i128);

    let job = contract.get_job(&job_id);
    assert!(matches!(job.status, JobStatus::InProgress));

    contract.submit_milestone(&job_id, &1_u32, &freelancer_addr);
    contract.approve_milestone(&job_id, &1_u32, &client_addr);
    contract.submit_milestone(&job_id, &2_u32, &freelancer_addr);
    contract.approve_milestone(&job_id, &2_u32, &client_addr);

    let job = contract.get_job(&job_id);
    assert!(matches!(job.status, JobStatus::Completed));
    assert_eq!(token.balance(&contract_id), 0_i128);
    assert_eq!(token.balance(&freelancer_addr), 3500_i128);
}

#[test]
fn test_unauthorized_submit() {
    let (env, contract_id, token_id, client_addr, freelancer_addr) = create_test_env();
    let contract = EscrowContractClient::new(&env, &contract_id);
    let milestones = make_milestones(&env);

    let job_id = contract.create_job(&client_addr, &freelancer_addr, &token_id, &milestones);
    contract.fund_job(&job_id, &client_addr, &3500_i128);

    let attacker = Address::generate(&env);
    let result = contract.try_submit_milestone(&job_id, &0_u32, &attacker);
    assert!(result.is_err());
}

#[test]
fn test_double_release_rejected() {
    let (env, contract_id, token_id, client_addr, freelancer_addr) = create_test_env();
    let contract = EscrowContractClient::new(&env, &contract_id);
    let milestones = make_milestones(&env);

    let job_id = contract.create_job(&client_addr, &freelancer_addr, &token_id, &milestones);
    contract.fund_job(&job_id, &client_addr, &3500_i128);
    contract.submit_milestone(&job_id, &0_u32, &freelancer_addr);
    contract.approve_milestone(&job_id, &0_u32, &client_addr);

    // Second approve must fail
    let result = contract.try_approve_milestone(&job_id, &0_u32, &client_addr);
    assert!(result.is_err());
}

#[test]
fn test_refund_path() {
    let (env, contract_id, token_id, client_addr, freelancer_addr) = create_test_env();
    let contract = EscrowContractClient::new(&env, &contract_id);
    let token = TokenClient::new(&env, &token_id);
    let milestones = make_milestones(&env);

    let job_id = contract.create_job(&client_addr, &freelancer_addr, &token_id, &milestones);
    contract.fund_job(&job_id, &client_addr, &3500_i128);

    // Approve first milestone, then refund the rest
    contract.submit_milestone(&job_id, &0_u32, &freelancer_addr);
    contract.approve_milestone(&job_id, &0_u32, &client_addr);

    let client_before = token.balance(&client_addr);
    let refunded = contract.refund(&job_id, &client_addr);
    assert_eq!(refunded, 2500_i128);
    assert_eq!(token.balance(&client_addr), client_before + 2500_i128);

    let job = contract.get_job(&job_id);
    assert!(matches!(job.status, JobStatus::Cancelled));
}

#[test]
fn test_insufficient_funding_rejected() {
    let (env, contract_id, token_id, client_addr, freelancer_addr) = create_test_env();
    let contract = EscrowContractClient::new(&env, &contract_id);
    let milestones = make_milestones(&env);

    let job_id = contract.create_job(&client_addr, &freelancer_addr, &token_id, &milestones);
    let result = contract.try_fund_job(&job_id, &client_addr, &100_i128);
    assert!(result.is_err());
}

#[test]
fn test_reject_milestone_dispute() {
    let (env, contract_id, token_id, client_addr, freelancer_addr) = create_test_env();
    let contract = EscrowContractClient::new(&env, &contract_id);
    let token = TokenClient::new(&env, &token_id);
    let milestones = make_milestones(&env);

    let job_id = contract.create_job(&client_addr, &freelancer_addr, &token_id, &milestones);
    contract.fund_job(&job_id, &client_addr, &3500_i128);
    contract.submit_milestone(&job_id, &0_u32, &freelancer_addr);

    contract.reject_milestone(
        &job_id,
        &0_u32,
        &client_addr,
        &String::from_str(&env, "Work not meeting spec"),
    );

    let job = contract.get_job(&job_id);
    assert!(matches!(
        job.milestones.get(0).unwrap().status,
        MilestoneStatus::Disputed
    ));
    // Funds remain locked
    assert_eq!(token.balance(&contract_id), 3500_i128);
}

#[test]
fn test_no_milestones_error() {
    let (env, contract_id, token_id, client_addr, freelancer_addr) = create_test_env();
    let contract = EscrowContractClient::new(&env, &contract_id);

    let result = contract.try_create_job(
        &client_addr,
        &freelancer_addr,
        &token_id,
        &Vec::new(&env),
    );
    assert!(result.is_err());
}

#[test]
fn test_list_jobs_by_address() {
    let (env, contract_id, token_id, client_addr, freelancer_addr) = create_test_env();
    let contract = EscrowContractClient::new(&env, &contract_id);
    let milestones = make_milestones(&env);

    // Mint extra for second job
    let token_admin = Address::generate(&env);
    let sac = StellarAssetClient::new(&env, &token_id);
    sac.mint(&client_addr, &10_000_i128);

    let id1 = contract.create_job(&client_addr, &freelancer_addr, &token_id, &milestones);
    let id2 = contract.create_job(&client_addr, &freelancer_addr, &token_id, &milestones);

    let _ = token_admin; // suppress warning
    let client_jobs = contract.list_jobs_by_address(&client_addr);
    assert!(client_jobs.contains(&id1));
    assert!(client_jobs.contains(&id2));
}
