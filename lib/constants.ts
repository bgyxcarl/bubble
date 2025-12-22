import { Transaction } from '../types';

const NAMED_ENTITIES = [
  'Binance 8', 'Gnosis Safe General', 'Starknet Bridge', 'Wintermute', 
  'Alameda (Legacy)', 'Kraken Hot Wallet', 'Uniswap V3: USDC', 'Optimism Gateway'
];

const METHODS = ['Transfer', 'Swap', 'Approve', 'Deposit', 'Withdraw', 'Execute', 'Mint'];

// Initial state is now empty for professional use (User starts with 0 data)
export const MOCK_DATA: Transaction[] = [];

export interface ChainConfig {
    name: string;
    id: string;
    currency: string;
}

export const SUPPORTED_CHAINS: ChainConfig[] = [
    { name: 'Ethereum Mainnet', id: '1', currency: 'ETH' },
    { name: 'Tron Mainnet', id: 'TRON', currency: 'TRX' },
    { name: 'Sepolia Testnet', id: '11155111', currency: 'ETH' },
    { name: 'Holesky Testnet', id: '17000', currency: 'ETH' },
    { name: 'Arbitrum One', id: '42161', currency: 'ETH' },
    { name: 'Arbitrum Nova', id: '42170', currency: 'ETH' },
    { name: 'Arbitrum Sepolia', id: '421614', currency: 'ETH' },
    { name: 'Polygon Mainnet', id: '137', currency: 'POL' },
    { name: 'Polygon Amoy', id: '80002', currency: 'POL' },
    { name: 'Optimism', id: '10', currency: 'ETH' },
    { name: 'Optimism Sepolia', id: '11155420', currency: 'ETH' },
    { name: 'Base Mainnet', id: '8453', currency: 'ETH' },
    { name: 'Base Sepolia', id: '84532', currency: 'ETH' },
    { name: 'BSC Mainnet', id: '56', currency: 'BNB' }, 
    { name: 'Blast Mainnet', id: '81457', currency: 'ETH' },
    { name: 'Blast Sepolia', id: '168587773', currency: 'ETH' },
    { name: 'Linea Mainnet', id: '59144', currency: 'ETH' },
    { name: 'Linea Sepolia', id: '59141', currency: 'ETH' },
    { name: 'Scroll Mainnet', id: '534352', currency: 'ETH' },
    { name: 'Scroll Sepolia', id: '534351', currency: 'ETH' },
    { name: 'zkSync Mainnet', id: '324', currency: 'ETH' },
    { name: 'zkSync Sepolia', id: '300', currency: 'ETH' },
    { name: 'Gnosis Chain', id: '100', currency: 'XDAI' },
    { name: 'Celo Mainnet', id: '42220', currency: 'CELO' },
    { name: 'Celo Sepolia', id: '11142220', currency: 'CELO' },
    { name: 'Moonbeam', id: '1284', currency: 'GLMR' },
    { name: 'Moonriver', id: '1285', currency: 'MOVR' },
    { name: 'Moonbase Alpha', id: '1287', currency: 'DEV' },
    { name: 'Mantle Mainnet', id: '5000', currency: 'MNT' },
    { name: 'Mantle Sepolia', id: '5003', currency: 'MNT' },
    { name: 'opBNB Mainnet', id: '204', currency: 'BNB' },
    { name: 'opBNB Testnet', id: '5611', currency: 'BNB' },
    { name: 'BitTorrent Mainnet', id: '199', currency: 'BTT' },
    { name: 'Berachain Mainnet', id: '80094', currency: 'BERA' },
    { name: 'Taiko Mainnet', id: '167000', currency: 'ETH' },
    { name: 'Sei Mainnet', id: '1329', currency: 'SEI' },
    { name: 'Sonic Mainnet', id: '146', currency: 'S' },
    { name: 'Unichain Mainnet', id: '130', currency: 'ETH' },
    { name: 'World Mainnet', id: '480', currency: 'ETH' },
];
