export const idlFactory = ({ IDL }) => {
  return IDL.Service({
    'contract_analysis' : IDL.Func([IDL.Text], [IDL.Text], []),
  });
};
export const init = ({ IDL }) => { return []; };
