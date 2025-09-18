import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Agreement {
  'id' : string,
  'status' : AgreementStatus,
  'title' : string,
  'creator' : Principal,
  'participants' : Array<Principal>,
  'documents' : Array<DocumentRef>,
  'description' : string,
  'created_at' : bigint,
  'voting_threshold' : number,
  'milestones' : Array<Milestone>,
}
export type AgreementStatus = { 'Active' : null } |
  { 'Cancelled' : null } |
  { 'Completed' : null };
export interface DocumentRef {
  'title' : string,
  'doc_id' : string,
  'required_signers' : Array<Principal>,
  'current_signers' : Array<Principal>,
  'is_signed_by_all' : boolean,
}
export interface Event {
  'actor' : Principal,
  'document_id' : [] | [string],
  'timestamp' : bigint,
  'details' : string,
  'milestone_id' : [] | [bigint],
  'agreement_id' : string,
  'event_type' : string,
}
export interface Milestone {
  'id' : bigint,
  'status' : MilestoneStatus,
  'title' : string,
  'milestone_type' : MilestoneType,
  'executed_at' : [] | [bigint],
  'votes' : Array<[Principal, boolean]>,
  'recipient' : Principal,
  'description' : string,
  'created_at' : bigint,
  'completed_at' : [] | [bigint],
  'amount' : bigint,
}
export type MilestoneStatus = { 'VotingActive' : null } |
  { 'Approved' : null } |
  { 'Rejected' : null } |
  { 'Executed' : null } |
  { 'ReadyForVoting' : null } |
  { 'Pending' : null };
export type MilestoneType = {
    'MultiCondition' : {
      'required_docs' : Array<string>,
      'requires_vote' : boolean,
      'min_time' : [] | [bigint],
    }
  } |
  { 'ManualApproval' : null } |
  { 'DocumentSignature' : { 'required_doc_id' : string } } |
  { 'TimeRelease' : { 'release_time' : bigint } };
export interface MilestoneVotingInfo {
  'status' : MilestoneStatus,
  'rejection_votes' : bigint,
  'approval_votes' : bigint,
  'milestone_id' : bigint,
  'voting_threshold' : number,
  'total_participants' : bigint,
  'required_votes' : bigint,
}
export type Result = { 'Ok' : string } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : MilestoneVotingInfo } |
  { 'Err' : string };
export interface _SERVICE {
  'add_participant' : ActorMethod<[string, Principal], Result>,
  'create_agreement' : ActorMethod<
    [
      string,
      string,
      string,
      Array<Principal>,
      Array<DocumentRef>,
      Array<Milestone>,
      number,
    ],
    Result
  >,
  'execute_milestone' : ActorMethod<[string, bigint], Result>,
  'fund_agreement' : ActorMethod<[string, bigint], Result>,
  'get_agreement' : ActorMethod<[string], [] | [Agreement]>,
  'get_agreement_balance' : ActorMethod<[string], bigint>,
  'get_canister_principal' : ActorMethod<[], Principal>,
  'get_ledger_canister_id' : ActorMethod<[], Principal>,
  'get_mainnet_ledger_id' : ActorMethod<[], Principal>,
  'get_milestone_voting_status' : ActorMethod<[string, bigint], Result_1>,
  'get_my_agreements' : ActorMethod<[], Array<Agreement>>,
  'list_events' : ActorMethod<[], Array<Event>>,
  'set_ledger_canister_id' : ActorMethod<[Principal], Result>,
  'sign_document' : ActorMethod<[string, string], Result>,
  'use_mainnet_ledger' : ActorMethod<[], Result>,
  'vote_milestone' : ActorMethod<[string, bigint, boolean], Result>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
