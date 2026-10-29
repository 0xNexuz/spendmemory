import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';

// Sign-to-save only needs a personal message signature. No transaction is ever built or sent.
export const dAppKit = createDAppKit({
  networks: ['mainnet'],
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: 'https://fullnode.mainnet.sui.io:443' }),
  autoConnect: true,
});

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
