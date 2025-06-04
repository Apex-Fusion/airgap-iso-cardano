import {
  Amount
} from "@airgap/module-kit";

import { 
  TestProtocolSpecBase, 
  WalletTestData, 
  TransactionTestData, 
  MessageTestData,
  TransactionStatusTestData,
  CARDANO_TEST_VECTORS,
  TestCryptoDerivative,
  AirGapWalletStatus
} from "../implementations";
import { CardanoProtocolStub } from "../stubs/cardano.stub";
import { CardanoProtocol } from "../../../src/protocol/cardano-protocol";

export class CardanoTestProtocolSpec extends TestProtocolSpecBase {
  name = "Cardano";
  lib: CardanoProtocol;
  stub = new CardanoProtocolStub();

  validAddresses = [
    // Testnet addresses
    "addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwqsv9y8x",
    "addr_test1vz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq4h7ksj",
    // Mainnet addresses
    "addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq2ytjqp",
    "addr1vx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwqcljjvz"
  ];

  wallet: WalletTestData = {
    privateKey: "f8e71dd5a0d35b8e52c72e2c6c1e5d8f9b7a3c4e6d8f1a2b4c5e7f9a0b2c4d6e8f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1",
    publicKey: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
    addresses: [
      "addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwqsv9y8x"
    ],
    masterFingerprint: "5c1bd648",
    status: AirGapWalletStatus.ACTIVE,
    extendedPrivateKey: "e8d9c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7",
    extendedPublicKey: "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1"
  };

  txs: TransactionTestData[] = [
    {
      to: ["addr_test1vz2pw0x95qgp40n0rzge62p2aps4amnut4hpj55mn6e5e3qqz0992"],
      from: ["addr_test1vz2pw0x95qgp40n0rzge62p2aps4amnut4hpj55mn6e5e3qqz0992"],
      amount: {
        value: "2000000", // 2 ADA in lovelace
        unit: {
          symbol: "ADA",
          decimals: 6
        }
      },
      fee: {
        value: "168273", // Standard fee
        unit: {
          symbol: "ADA", 
          decimals: 6
        }
      },
      properties: ["amount", "fee", "to", "from"],
      unsignedTx: {
        type: "unsigned",
        details: {
          to: "addr_test1vz2pw0x95qgp40n0rzge62p2aps4amnut4hpj55mn6e5e3qqz0992",
          from: "addr_test1vz2pw0x95qgp40n0rzge62p2aps4amnut4hpj55mn6e5e3qqz0992",
          amount: "2000000",
          fee: "168273",
          network: "testnet"
        },
        serialized: "84a40081825820915f7bf0b7aa8a2892715cf7bbfbb1ee31cb05b33fe10bcb6b1f7cc4ebddf1e200018282583901d2e0...7f00821a001e84800582583901d2e0...7f00821a003c6a27021a00029121a0f5f6"
      },
      signedTx: {
        type: "signed",
        details: {
          to: "addr_test1qpak6t3r9ncvtgpqp7lzqaprn4qa7g2k0z0j6l3qn4t2m5p8v2e7x4w6r5y8t1s3n6m9k2l5h8j1d4g7f0a3b6c9e2s5",
          from: "addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwqsv9y8x",
          amount: "2000000",
          fee: "168273",
          network: "testnet"
        },
        serialized: "84a40081825820915f7bf0b7aa8a2892715cf7bbfbb1ee31cb05b33fe10bcb6b1f7cc4ebddf1e200018282583901d2e0...a1008182582073fea80d424276ad0978d4fe5310e8bc2d485f5f6bb3bf87612989f112ad5a7d5840a1b2c3d4e5f6789abc...f6"
      }
    }
  ];

  messages: MessageTestData[] = [
    {
      message: "Hello Cardano!",
      signature: "845846a201276761646472657373581de1d2e0c8a8f7b9d4a7f5e2b8c1d6e9f4a3b7c0d5e8f1a4b6c9e2d5f8a1b4c7e0d3f6a9b2c5e8f1a4d7e0c3584058e1b2c4d6f8a0c2e4f6a8b0d2e4f6a8c0e2f4a6b8d0e2f4a6c8e0f2a4b6d8e0f2a4c6e8f0b2d4a6c8e0d2f4a6b8"
    }
  ];

  transactionStatusTests: TransactionStatusTestData[] = [
    {
      hash: "915f7bf0b7aa8a2892715cf7bbfbb1ee31cb05b33fe10bcb6b1f7cc4ebddf1e2",
      status: "confirmed"
    },
    {
      hash: "pending123abc456def789abc123def456789abc123def456789abc123def456789",
      status: "pending"
    },
    {
      hash: "failed456def789abc123def456789abc123def456789abc123def456789abc123",
      status: "failed"
    }
  ];

  // No encryption support for Cardano
  encryptAsymmetric = undefined;
  encryptAES = undefined;

  constructor() {
    super();
    this.lib = new CardanoProtocol({ network: "testnet" });
  }

  async derivative(): Promise<TestCryptoDerivative> {
    return {
      depth: 5,
      parentFingerprint: 0x5c1bd648,
      index: 0,
      chainCode: "873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508",
      secretKey: "edb2e14f9ee77d26dd93b4ecede8d16ed408ce149b73f55d5f7b69b726a03b06",
      publicKey: "a074b89c0b1f2e8b734f8b1b7e8e92cd5fa3c9a1b4e2f3d6e7f8a9b0c1d2e3f4"
    };
  }

  seed(): string {
    return CARDANO_TEST_VECTORS.mnemonic;
  }

  mnemonic(): string {
    return CARDANO_TEST_VECTORS.mnemonic;
  }

  // Additional Cardano-specific test methods
  async getStakingDerivative(): Promise<TestCryptoDerivative> {
    return {
      depth: 5,
      parentFingerprint: 0x5c1bd648,
      index: 0,
      chainCode: "873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508",
      secretKey: "1aa4f7b43ba90394495b8a2a7e7a76a3cb77abcf6e7a9b20c9c6d73b4c75e8a2",
      publicKey: "b184c8e4d3f2a1b5c6e7f8d9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9"
    };
  }

  async getChangeDerivative(): Promise<TestCryptoDerivative> {
    return {
      depth: 5,
      parentFingerprint: 0x5c1bd648,
      index: 1,
      chainCode: "873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508",
      secretKey: "2bb5f8c54cb10495506c9b3b8f8b87b4dc88bcde7f8bac31dada84c5d86f9b3",
      publicKey: "c295d9f5e4g3b2c6d7f8e9da1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0"
    };
  }

  // Test data for multi-asset transactions
  getMultiAssetTransaction(): TransactionTestData {
    return {
      to: ["addr_test1vz2pw0x95qgp40n0rzge62p2aps4amnut4hpj55mn6e5e3qqz0992"],
      from: ["addr_test1vz2pw0x95qgp40n0rzge62p2aps4amnut4hpj55mn6e5e3qqz0992"],
      amount: {
        value: "1500000", // 1.5 ADA
        unit: {
          symbol: "ADA",
          decimals: 6
        }
      },
      fee: {
        value: "185000", // Higher fee for multi-asset
        unit: {
          symbol: "ADA",
          decimals: 6
        }
      },
      properties: ["amount", "fee", "to", "from", "assets"],
      unsignedTx: {
        type: "unsigned",
        details: {
          to: "addr_test1qpak6t3r9ncvtgpqp7lzqaprn4qa7g2k0z0j6l3qn4t2m5p8v2e7x4w6r5y8t1s3n6m9k2l5h8j1d4g7f0a3b6c9e2s5",
          from: "addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwqsv9y8x",
          amount: "1500000",
          fee: "185000",
          network: "testnet",
          assets: [
            {
              unit: "329728f73683fe04364631c27a7912538c116d802416ca1eaf2d7a96736166636f696e",
              quantity: "100000000" // 100 tokens
            }
          ]
        },
        serialized: "84a40081825820915f7bf0b7aa8a2892715cf7bbfbb1ee31cb05b33fe10bcb6b1f7cc4ebddf1e200018282583901d2e0...a20058396502d9316b7c8c1b2e1d4a5c8f7b0d3e6a9c2f5b8e1d4a7f0c3b6e9d2f5a8c1e4f7b0d3e6a9c2821a0016e360a1581c329728f73683fe04364631c27a7912538c116d802416ca1eaf2d7a96a1496d696e74546f6b656e1a05f5e100021a0002d2f8a0f5f6"
      },
      signedTx: {
        type: "signed",
        details: {
          to: "addr_test1qpak6t3r9ncvtgpqp7lzqaprn4qa7g2k0z0j6l3qn4t2m5p8v2e7x4w6r5y8t1s3n6m9k2l5h8j1d4g7f0a3b6c9e2s5",
          from: "addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwqsv9y8x",
          amount: "1500000",
          fee: "185000",
          network: "testnet",
          assets: [
            {
              unit: "329728f73683fe04364631c27a7912538c116d802416ca1eaf2d7a96736166636f696e",
              quantity: "100000000"
            }
          ]
        },
        serialized: "84a40081825820915f7bf0b7aa8a2892715cf7bbfbb1ee31cb05b33fe10bcb6b1f7cc4ebddf1e200018282583901d2e0...a1008182582073fea80d424276ad0978d4fe5310e8bc2d485f5f6bb3bf87612989f112ad5a7d5840c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5f6"
      }
    };
  }

  // Test data for delegation transactions
  getDelegationTransaction(): TransactionTestData {
    return {
      to: ["addr_test1vz2pw0x95qgp40n0rzge62p2aps4amnut4hpj55mn6e5e3qqz0992"],
      from: ["addr_test1vz2pw0x95qgp40n0rzge62p2aps4amnut4hpj55mn6e5e3qqz0992"],
      amount: {
        value: "2000000", // Key deposit
        unit: {
          symbol: "ADA",
          decimals: 6
        }
      },
      fee: {
        value: "180000", // Fee for delegation transaction
        unit: {
          symbol: "ADA",
          decimals: 6
        }
      },
      properties: ["amount", "fee", "to", "from", "delegation"],
      unsignedTx: {
        type: "unsigned",
        details: {
          to: "addr_test1vz2pw0x95qgp40n0rzge62p2aps4amnut4hpj55mn6e5e3qqz0992",
          from: "addr_test1vz2pw0x95qgp40n0rzge62p2aps4amnut4hpj55mn6e5e3qqz0992",
          amount: "0", // No ADA sent in delegation
          fee: "180000",
          network: "testnet",
          poolId: "pool1pu5jlj4q9w9jlxeu370a3c9myx47md5j5m2str0naunn2q3lkdy",
          certificates: [
            {
              type: "StakeRegistration",
              stakeCredential: "stake_test1uz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3qk6vqem"
            },
            {
              type: "StakeDelegation", 
              stakeCredential: "stake_test1uz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3qk6vqem",
              poolKeyHash: "pool1pu5jlj4q9w9jlxeu370a3c9myx47md5j5m2str0naunn2q3lkdy"
            }
          ]
        },
        serialized: "84a50081825820915f7bf0b7aa8a2892715cf7bbfbb1ee31cb05b33fe10bcb6b1f7cc4ebddf1e20001818258390...021a0002bbc003a1008304828200581c...8302581c...581c...a0f5f6"
      },
      signedTx: {
        type: "signed", 
        details: {
          to: "stake_test1uz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3qk6vqem",
          from: "addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwqsv9y8x",
          amount: "0",
          fee: "180000",
          network: "testnet",
          poolId: "pool1pu5jlj4q9w9jlxeu370a3c9myx47md5j5m2str0naunn2q3lkdy",
          certificates: [
            {
              type: "StakeRegistration",
              stakeCredential: "stake_test1uz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3qk6vqem"
            },
            {
              type: "StakeDelegation",
              stakeCredential: "stake_test1uz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3qk6vqem", 
              poolKeyHash: "pool1pu5jlj4q9w9jlxeu370a3c9myx47md5j5m2str0naunn2q3lkdy"
            }
          ]
        },
        serialized: "84a50081825820915f7bf0b7aa8a2892715cf7bbfbb1ee31cb05b33fe10bcb6b1f7cc4ebddf1e20001818258390...a1008282582073fea80d424276ad0978d4fe5310e8bc2d485f5f6bb3bf87612989f112ad5a7d5840...58209ac2f7c090c4e74c...5840...f6"
      }
    };
  }
}