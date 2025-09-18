export const idlFactory = ({ IDL }) => {
  const Result = IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text });
  const DocumentRef = IDL.Record({
    'title' : IDL.Text,
    'doc_id' : IDL.Text,
    'required_signers' : IDL.Vec(IDL.Principal),
    'current_signers' : IDL.Vec(IDL.Principal),
    'is_signed_by_all' : IDL.Bool,
  });
  const MilestoneStatus = IDL.Variant({
    'VotingActive' : IDL.Null,
    'Approved' : IDL.Null,
    'Rejected' : IDL.Null,
    'Executed' : IDL.Null,
    'ReadyForVoting' : IDL.Null,
    'Pending' : IDL.Null,
  });
  const MilestoneType = IDL.Variant({
    'MultiCondition' : IDL.Record({
      'required_docs' : IDL.Vec(IDL.Text),
      'requires_vote' : IDL.Bool,
      'min_time' : IDL.Opt(IDL.Nat64),
    }),
    'ManualApproval' : IDL.Null,
    'DocumentSignature' : IDL.Record({ 'required_doc_id' : IDL.Text }),
    'TimeRelease' : IDL.Record({ 'release_time' : IDL.Nat64 }),
  });
  const Milestone = IDL.Record({
    'id' : IDL.Nat64,
    'status' : MilestoneStatus,
    'title' : IDL.Text,
    'milestone_type' : MilestoneType,
    'executed_at' : IDL.Opt(IDL.Nat64),
    'votes' : IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Bool)),
    'recipient' : IDL.Principal,
    'description' : IDL.Text,
    'created_at' : IDL.Nat64,
    'completed_at' : IDL.Opt(IDL.Nat64),
    'amount' : IDL.Nat,
  });
  const AgreementStatus = IDL.Variant({
    'Active' : IDL.Null,
    'Cancelled' : IDL.Null,
    'Completed' : IDL.Null,
  });
  const Agreement = IDL.Record({
    'id' : IDL.Text,
    'status' : AgreementStatus,
    'title' : IDL.Text,
    'creator' : IDL.Principal,
    'participants' : IDL.Vec(IDL.Principal),
    'documents' : IDL.Vec(DocumentRef),
    'description' : IDL.Text,
    'created_at' : IDL.Nat64,
    'voting_threshold' : IDL.Nat8,
    'milestones' : IDL.Vec(Milestone),
  });
  const MilestoneVotingInfo = IDL.Record({
    'status' : MilestoneStatus,
    'rejection_votes' : IDL.Nat64,
    'approval_votes' : IDL.Nat64,
    'milestone_id' : IDL.Nat64,
    'voting_threshold' : IDL.Nat8,
    'total_participants' : IDL.Nat64,
    'required_votes' : IDL.Nat64,
  });
  const Result_1 = IDL.Variant({
    'Ok' : MilestoneVotingInfo,
    'Err' : IDL.Text,
  });
  const Event = IDL.Record({
    'actor' : IDL.Principal,
    'document_id' : IDL.Opt(IDL.Text),
    'timestamp' : IDL.Nat64,
    'details' : IDL.Text,
    'milestone_id' : IDL.Opt(IDL.Nat64),
    'agreement_id' : IDL.Text,
    'event_type' : IDL.Text,
  });
  return IDL.Service({
    'add_participant' : IDL.Func([IDL.Text, IDL.Principal], [Result], []),
    'create_agreement' : IDL.Func(
        [
          IDL.Text,
          IDL.Text,
          IDL.Text,
          IDL.Vec(IDL.Principal),
          IDL.Vec(DocumentRef),
          IDL.Vec(Milestone),
          IDL.Nat8,
        ],
        [Result],
        [],
      ),
    'execute_milestone' : IDL.Func([IDL.Text, IDL.Nat64], [Result], []),
    'fund_agreement' : IDL.Func([IDL.Text, IDL.Nat], [Result], []),
    'get_agreement' : IDL.Func([IDL.Text], [IDL.Opt(Agreement)], ['query']),
    'get_agreement_balance' : IDL.Func([IDL.Text], [IDL.Nat], ['query']),
    'get_canister_principal' : IDL.Func([], [IDL.Principal], ['query']),
    'get_ledger_canister_id' : IDL.Func([], [IDL.Principal], ['query']),
    'get_mainnet_ledger_id' : IDL.Func([], [IDL.Principal], ['query']),
    'get_milestone_voting_status' : IDL.Func(
        [IDL.Text, IDL.Nat64],
        [Result_1],
        ['query'],
      ),
    'get_my_agreements' : IDL.Func([], [IDL.Vec(Agreement)], ['query']),
    'list_events' : IDL.Func([], [IDL.Vec(Event)], ['query']),
    'set_ledger_canister_id' : IDL.Func([IDL.Principal], [Result], []),
    'sign_document' : IDL.Func([IDL.Text, IDL.Text], [Result], []),
    'use_mainnet_ledger' : IDL.Func([], [Result], []),
    'vote_milestone' : IDL.Func([IDL.Text, IDL.Nat64, IDL.Bool], [Result], []),
  });
};
export const init = ({ IDL }) => { return [IDL.Principal]; };
