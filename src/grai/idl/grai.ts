/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/grai.json`.
 */
export type Grai = {
  "address": "3Bc99GroACdqAVPbPUt7eHR8sPvKxh2m3suYfcnCtsCh",
  "metadata": {
    "name": "grai",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "acceptOwnership",
      "docs": [
        "Pending owner takes over; clears `confirmed` so prior liquidation consent dies with the old owner."
      ],
      "discriminator": [
        172,
        23,
        43,
        13,
        238,
        213,
        85,
        150
      ],
      "accounts": [
        {
          "name": "pendingOwner",
          "signer": true
        },
        {
          "name": "graiState",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "bribe",
      "discriminator": [
        40,
        207,
        231,
        7,
        109,
        179,
        119,
        140
      ],
      "accounts": [
        {
          "name": "briber",
          "writable": true,
          "signer": true
        },
        {
          "name": "voter"
        },
        {
          "name": "graiState",
          "writable": true
        },
        {
          "name": "graiMint"
        },
        {
          "name": "escrow",
          "writable": true
        },
        {
          "name": "settlementMint"
        },
        {
          "name": "settlementAssetConfig",
          "writable": true
        },
        {
          "name": "settlementPriceFeed"
        },
        {
          "name": "graiVaultAta",
          "writable": true
        },
        {
          "name": "settlementVaultAta",
          "writable": true
        },
        {
          "name": "briberGraiAta",
          "writable": true
        },
        {
          "name": "briberSettlementAta",
          "writable": true
        },
        {
          "name": "voterSettlementAta",
          "writable": true
        },
        {
          "name": "treasuryVault",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram"
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "graiAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "claim",
      "docs": [
        "Claim yield dividends for one listed asset.",
        "`amount == u64::MAX` claims the full accrued balance; otherwise `min(amount, claimable)`.",
        "Tip (`claim_tip_bps`) is paid to `payer`; remainder to `holder`."
      ],
      "discriminator": [
        62,
        198,
        214,
        193,
        213,
        159,
        108,
        210
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "graiState"
        },
        {
          "name": "holder"
        },
        {
          "name": "escrow"
        },
        {
          "name": "assetMint"
        },
        {
          "name": "assetConfig",
          "writable": true
        },
        {
          "name": "priceFeed"
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "vaultAta",
          "writable": true
        },
        {
          "name": "treasuryVault",
          "writable": true
        },
        {
          "name": "holderAssetAta",
          "writable": true
        },
        {
          "name": "tipAssetAta",
          "docs": [
            "Caller tip ATA (EVM `msg.sender` tip from `claimTipBps`). Same as holder ATA when self-claiming."
          ],
          "writable": true
        },
        {
          "name": "beneficiarAta",
          "writable": true
        },
        {
          "name": "holderReferrer",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram"
        },
        {
          "name": "systemProgram"
        },
        {
          "name": "rent"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "claimAll",
      "docs": [
        "EVM `claimAll(locker)`. Remaining per listed mint: vault PDA + holder/payer ATAs are bound",
        "on-chain (`[\"vault\", mint]`, ATA(holder), ATA(payer))."
      ],
      "discriminator": [
        194,
        194,
        80,
        194,
        234,
        210,
        217,
        90
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "graiState",
          "writable": true
        },
        {
          "name": "holder"
        },
        {
          "name": "escrow"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": []
    },
    {
      "name": "deposit",
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "graiState",
          "writable": true
        },
        {
          "name": "assetMint"
        },
        {
          "name": "graiMint",
          "writable": true
        },
        {
          "name": "assetConfig"
        },
        {
          "name": "priceFeed"
        },
        {
          "name": "grindersState"
        },
        {
          "name": "referrer",
          "writable": true
        },
        {
          "name": "treasuryNftMint",
          "writable": true
        },
        {
          "name": "treasuryNftMetadata",
          "writable": true
        },
        {
          "name": "treasuryNftEdition",
          "writable": true
        },
        {
          "name": "treasuryNftAta",
          "writable": true
        },
        {
          "name": "depositorAta",
          "writable": true
        },
        {
          "name": "grindersAta",
          "writable": true
        },
        {
          "name": "depositorGraiAta",
          "writable": true
        },
        {
          "name": "escrow",
          "writable": true
        },
        {
          "name": "graiVaultAta",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram"
        },
        {
          "name": "tokenMetadataProgram"
        },
        {
          "name": "systemProgram"
        },
        {
          "name": "rent"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "lock",
          "type": "bool"
        },
        {
          "name": "referrer",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "depositSol",
      "discriminator": [
        108,
        81,
        78,
        117,
        125,
        155,
        56,
        200
      ],
      "accounts": [
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "graiState",
          "writable": true
        },
        {
          "name": "assetMint"
        },
        {
          "name": "graiMint",
          "writable": true
        },
        {
          "name": "assetConfig"
        },
        {
          "name": "priceFeed"
        },
        {
          "name": "grindersState"
        },
        {
          "name": "referrer",
          "writable": true
        },
        {
          "name": "treasuryNftMint",
          "writable": true
        },
        {
          "name": "treasuryNftMetadata",
          "writable": true
        },
        {
          "name": "treasuryNftEdition",
          "writable": true
        },
        {
          "name": "treasuryNftAta",
          "writable": true
        },
        {
          "name": "depositorWsolAta",
          "writable": true
        },
        {
          "name": "grindersAta",
          "writable": true
        },
        {
          "name": "depositorGraiAta",
          "writable": true
        },
        {
          "name": "escrow",
          "writable": true
        },
        {
          "name": "graiVaultAta",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram"
        },
        {
          "name": "tokenMetadataProgram"
        },
        {
          "name": "systemProgram"
        },
        {
          "name": "rent"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "lock",
          "type": "bool"
        },
        {
          "name": "referrer",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "distribute",
      "discriminator": [
        191,
        44,
        223,
        207,
        164,
        236,
        126,
        61
      ],
      "accounts": [
        {
          "name": "custodyWallet",
          "writable": true,
          "signer": true
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "graiState",
          "writable": true
        },
        {
          "name": "assetMint"
        },
        {
          "name": "assetConfig",
          "writable": true
        },
        {
          "name": "priceFeed"
        },
        {
          "name": "graiMint"
        },
        {
          "name": "custodyAta",
          "writable": true
        },
        {
          "name": "vaultAta",
          "writable": true
        },
        {
          "name": "treasuryVault",
          "docs": [
            "In-program treasury inventory vault (EVM `Treasury` balance for this asset).",
            "Created on `set_feed` list alongside the asset vault."
          ],
          "writable": true
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "yieldAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "getAssets",
      "docs": [
        "EVM `getAssets`."
      ],
      "discriminator": [
        120,
        189,
        135,
        174,
        32,
        140,
        201,
        186
      ],
      "accounts": [
        {
          "name": "graiState"
        }
      ],
      "args": [],
      "returns": {
        "vec": "pubkey"
      }
    },
    {
      "name": "getLockers",
      "docs": [
        "EVM `getLockers(fromId, toId)`. Remaining: escrow PDA per locker in the slice."
      ],
      "discriminator": [
        118,
        164,
        170,
        60,
        46,
        97,
        47,
        121
      ],
      "accounts": [
        {
          "name": "graiState"
        }
      ],
      "args": [
        {
          "name": "fromId",
          "type": "u32"
        },
        {
          "name": "toId",
          "type": "u32"
        }
      ],
      "returns": {
        "vec": {
          "defined": {
            "name": "escrowView"
          }
        }
      }
    },
    {
      "name": "getRedeemables",
      "docs": [
        "EVM `getRedeemables` — redeemable basket while liquidation is open.",
        "Remaining: `[asset_config, vault_ata]` × N."
      ],
      "discriminator": [
        190,
        32,
        35,
        230,
        63,
        63,
        53,
        238
      ],
      "accounts": [
        {
          "name": "graiState"
        }
      ],
      "args": [],
      "returns": {
        "defined": {
          "name": "redeemQuote"
        }
      }
    },
    {
      "name": "getLockersData",
      "docs": [
        "EVM GRAI `getLockersData(fromId, toId)`: bound lockers plus `previewClaimAll`.",
        "Remaining: `[referrer] × M`, `[escrow] × M`, `[asset_config] × N`, then",
        "`[position]` locker-major (`M` in `[from, to)`, `N` listed mints).",
        "Escrow / position PDAs may be empty."
      ],
      "discriminator": [
        120,
        98,
        207,
        9,
        166,
        41,
        51,
        34
      ],
      "accounts": [
        {
          "name": "graiState"
        }
      ],
      "args": [
        {
          "name": "fromId",
          "type": "u32"
        },
        {
          "name": "toId",
          "type": "u32"
        }
      ],
      "returns": {
        "vec": {
          "defined": {
            "name": "lockerDataView"
          }
        }
      }
    },
    {
      "name": "getVoters",
      "docs": [
        "EVM `getVoters(fromId, toId)`. Remaining: escrow PDA per voter in the slice."
      ],
      "discriminator": [
        102,
        140,
        8,
        39,
        189,
        118,
        11,
        27
      ],
      "accounts": [
        {
          "name": "graiState"
        }
      ],
      "args": [
        {
          "name": "fromId",
          "type": "u32"
        },
        {
          "name": "toId",
          "type": "u32"
        }
      ],
      "returns": {
        "vec": {
          "defined": {
            "name": "escrowView"
          }
        }
      }
    },
    {
      "name": "hasQuorum",
      "discriminator": [
        246,
        60,
        175,
        169,
        209,
        9,
        176,
        199
      ],
      "accounts": [
        {
          "name": "graiState"
        },
        {
          "name": "graiMint"
        }
      ],
      "args": [],
      "returns": "bool"
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "graiState",
          "writable": true
        },
        {
          "name": "graiMint",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "tokenMetadataProgram"
        },
        {
          "name": "metadata",
          "writable": true
        },
        {
          "name": "systemProgram"
        },
        {
          "name": "rent"
        }
      ],
      "args": []
    },
    {
      "name": "liquidate",
      "discriminator": [
        223,
        179,
        226,
        125,
        48,
        46,
        39,
        74
      ],
      "accounts": [
        {
          "name": "caller",
          "writable": true,
          "signer": true
        },
        {
          "name": "graiState",
          "writable": true
        },
        {
          "name": "graiMint"
        },
        {
          "name": "graiVaultAta",
          "writable": true
        },
        {
          "name": "callerGraiAta",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram"
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": []
    },
    {
      "name": "lock",
      "discriminator": [
        21,
        19,
        208,
        43,
        237,
        62,
        255,
        87
      ],
      "accounts": [
        {
          "name": "locker",
          "writable": true,
          "signer": true
        },
        {
          "name": "graiState",
          "writable": true
        },
        {
          "name": "graiMint"
        },
        {
          "name": "escrow",
          "writable": true
        },
        {
          "name": "lockerGraiAta",
          "writable": true
        },
        {
          "name": "graiVaultAta",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram"
        },
        {
          "name": "rent"
        }
      ],
      "args": [
        {
          "name": "graiAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "poach",
      "docs": [
        "Purchase `locker`'s affiliate slot for `value + l1_value` GRAI."
      ],
      "discriminator": [
        53,
        255,
        175,
        100,
        32,
        162,
        71,
        140
      ],
      "accounts": [
        {
          "name": "poacher",
          "writable": true,
          "signer": true
        },
        {
          "name": "graiState",
          "writable": true
        },
        {
          "name": "locker"
        },
        {
          "name": "lockerReferrer",
          "writable": true
        },
        {
          "name": "buyerBook",
          "writable": true
        },
        {
          "name": "sellerBook",
          "writable": true
        },
        {
          "name": "oldL2Book",
          "writable": true
        },
        {
          "name": "newL2Book",
          "writable": true
        },
        {
          "name": "graiMint"
        },
        {
          "name": "poacherGraiAta",
          "writable": true
        },
        {
          "name": "sellerGraiAta",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": []
    },
    {
      "name": "previewBribe",
      "docs": [
        "Dynamic bribe ask for `grai_amount` of `voter`'s vote: `(bribe_amount, premium, discount)`",
        "in `settlement_asset` units. Exactly one of `premium` / `discount` is non-zero."
      ],
      "discriminator": [
        213,
        162,
        180,
        90,
        167,
        52,
        43,
        63
      ],
      "accounts": [
        {
          "name": "voter"
        },
        {
          "name": "graiState"
        },
        {
          "name": "graiMint"
        },
        {
          "name": "escrow"
        },
        {
          "name": "settlementMint"
        },
        {
          "name": "settlementAssetConfig"
        },
        {
          "name": "settlementPriceFeed"
        }
      ],
      "args": [
        {
          "name": "graiAmount",
          "type": "u64"
        }
      ],
      "returns": {
        "defined": {
          "name": "bribeQuote"
        }
      }
    },
    {
      "name": "previewClaim",
      "docs": [
        "EVM `previewClaim`. `amount == u64::MAX` = full pending."
      ],
      "discriminator": [
        33,
        140,
        113,
        100,
        71,
        91,
        10,
        71
      ],
      "accounts": [
        {
          "name": "holder"
        },
        {
          "name": "graiState"
        },
        {
          "name": "escrow"
        },
        {
          "name": "assetMint"
        },
        {
          "name": "assetConfig"
        },
        {
          "name": "position"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ],
      "returns": "u64"
    },
    {
      "name": "previewClaimAll",
      "docs": [
        "EVM `previewClaimAll`. Remaining: `[asset_config, position]` × N."
      ],
      "discriminator": [
        92,
        7,
        89,
        58,
        107,
        239,
        180,
        43
      ],
      "accounts": [
        {
          "name": "holder"
        },
        {
          "name": "graiState"
        },
        {
          "name": "escrow"
        }
      ],
      "args": [],
      "returns": {
        "defined": {
          "name": "claimAllQuote"
        }
      }
    },
    {
      "name": "previewDeposit",
      "docs": [
        "EVM `previewDeposit` → `(value, grai_out)`."
      ],
      "discriminator": [
        16,
        61,
        8,
        235,
        146,
        126,
        80,
        84
      ],
      "accounts": [
        {
          "name": "graiState"
        },
        {
          "name": "graiMint"
        },
        {
          "name": "assetMint"
        },
        {
          "name": "assetConfig"
        },
        {
          "name": "priceFeed"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ],
      "returns": {
        "defined": {
          "name": "depositQuote"
        }
      }
    },
    {
      "name": "previewPoach",
      "docs": [
        "Quote the current referral-slot purchase price and seller."
      ],
      "discriminator": [
        131,
        232,
        124,
        111,
        180,
        205,
        224,
        214
      ],
      "accounts": [
        {
          "name": "poacher"
        },
        {
          "name": "locker"
        },
        {
          "name": "lockerReferrer"
        }
      ],
      "args": [],
      "returns": {
        "defined": {
          "name": "poachQuote"
        }
      }
    },
    {
      "name": "previewRedeem",
      "docs": [
        "EVM `previewRedeem`. Remaining: `[asset_config, vault_ata]` × N."
      ],
      "discriminator": [
        122,
        195,
        125,
        8,
        168,
        149,
        50,
        40
      ],
      "accounts": [
        {
          "name": "holder"
        },
        {
          "name": "graiState"
        },
        {
          "name": "graiMint"
        },
        {
          "name": "escrow"
        },
        {
          "name": "holderGraiAta"
        }
      ],
      "args": [
        {
          "name": "graiAmount",
          "type": "u64"
        }
      ],
      "returns": {
        "defined": {
          "name": "redeemQuote"
        }
      }
    },
    {
      "name": "previewUnlock",
      "docs": [
        "EVM `previewUnlock`. Pass `timestamp == 0` to use the cluster clock."
      ],
      "discriminator": [
        196,
        221,
        72,
        255,
        21,
        11,
        169,
        136
      ],
      "accounts": [
        {
          "name": "account"
        },
        {
          "name": "graiState"
        },
        {
          "name": "escrow"
        }
      ],
      "args": [
        {
          "name": "graiAmount",
          "type": "u64"
        },
        {
          "name": "timestamp",
          "type": "i64"
        }
      ],
      "returns": {
        "defined": {
          "name": "unlockQuote"
        }
      }
    },
    {
      "name": "redeem",
      "discriminator": [
        184,
        12,
        86,
        149,
        70,
        196,
        97,
        225
      ],
      "accounts": [
        {
          "name": "holder",
          "writable": true,
          "signer": true
        },
        {
          "name": "graiState",
          "writable": true
        },
        {
          "name": "graiMint",
          "writable": true
        },
        {
          "name": "escrow",
          "writable": true
        },
        {
          "name": "holderGraiAta",
          "writable": true
        },
        {
          "name": "graiVaultAta",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram"
        },
        {
          "name": "rent"
        }
      ],
      "args": [
        {
          "name": "graiAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "revive",
      "discriminator": [
        202,
        187,
        79,
        18,
        27,
        117,
        147,
        82
      ],
      "accounts": [
        {
          "name": "caller",
          "signer": true
        },
        {
          "name": "graiState",
          "writable": true
        },
        {
          "name": "graiMint"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "setBeneficiar",
      "discriminator": [
        64,
        113,
        88,
        151,
        202,
        160,
        228,
        51
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true
        },
        {
          "name": "graiState",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "beneficiar",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "setConfig",
      "discriminator": [
        108,
        158,
        154,
        175,
        212,
        98,
        52,
        66
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true
        },
        {
          "name": "graiState",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "cfg",
          "type": {
            "defined": {
              "name": "config"
            }
          }
        }
      ]
    },
    {
      "name": "setFeed",
      "docs": [
        "EVM `setFeed` waterfall: list / pause-only / replace-while-paused / delist (`FEED_NONE`).",
        "`paused` mirrors `Feed.paused`. Pass System Program as `price_feed` for delist (must be paused).",
        "`moved_asset_config` is the swapped tail config on mid-list delist; pass `asset_config` otherwise."
      ],
      "discriminator": [
        79,
        150,
        2,
        207,
        41,
        104,
        77,
        41
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "assetMint"
        },
        {
          "name": "graiState",
          "writable": true
        },
        {
          "name": "assetConfig",
          "docs": [
            "Seeds: `[AssetConfig::SEED, asset_mint]`."
          ],
          "writable": true
        },
        {
          "name": "vaultAta",
          "docs": [
            "Seeds: `[AssetConfig::VAULT_SEED, asset_mint]`."
          ],
          "writable": true
        },
        {
          "name": "treasuryVault",
          "writable": true
        },
        {
          "name": "priceFeed"
        },
        {
          "name": "movedAssetConfig",
          "docs": [
            "Pass `asset_config` when unused (list / update / last asset)."
          ],
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram"
        },
        {
          "name": "rent"
        }
      ],
      "args": [
        {
          "name": "paused",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setGrinders",
      "discriminator": [
        251,
        52,
        204,
        156,
        125,
        4,
        56,
        220
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true
        },
        {
          "name": "graiState",
          "writable": true
        },
        {
          "name": "grindersState"
        }
      ],
      "args": [
        {
          "name": "grinders",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "setRevenueShareBps",
      "discriminator": [
        197,
        178,
        161,
        230,
        149,
        224,
        122,
        41
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true
        },
        {
          "name": "graiState",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "shares",
          "type": {
            "vec": "u16"
          }
        }
      ]
    },
    {
      "name": "setRoyaltyBps",
      "discriminator": [
        158,
        109,
        174,
        236,
        163,
        54,
        179,
        149
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true
        },
        {
          "name": "graiState",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "royaltyBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "setSettlementAsset",
      "discriminator": [
        136,
        125,
        240,
        24,
        103,
        4,
        38,
        219
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true
        },
        {
          "name": "graiState",
          "writable": true
        },
        {
          "name": "settlementMint"
        },
        {
          "name": "settlementAssetConfig"
        },
        {
          "name": "settlementPriceFeed"
        }
      ],
      "args": []
    },
    {
      "name": "transferOwnership",
      "docs": [
        "Propose a new owner (EVM `Ownable2Step.transferOwnership`).",
        "Pass `Pubkey::default()` to cancel a pending handoff; `owner` is unchanged until accept."
      ],
      "discriminator": [
        65,
        177,
        215,
        73,
        53,
        45,
        99,
        47
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true
        },
        {
          "name": "graiState",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "newOwner",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "unlock",
      "discriminator": [
        101,
        155,
        40,
        21,
        158,
        189,
        56,
        203
      ],
      "accounts": [
        {
          "name": "account",
          "writable": true,
          "signer": true
        },
        {
          "name": "graiState",
          "writable": true
        },
        {
          "name": "graiMint"
        },
        {
          "name": "escrow",
          "writable": true
        },
        {
          "name": "accountGraiAta",
          "writable": true
        },
        {
          "name": "graiVaultAta",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "graiAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "vote",
      "discriminator": [
        227,
        110,
        155,
        23,
        136,
        126,
        172,
        25
      ],
      "accounts": [
        {
          "name": "voter",
          "writable": true,
          "signer": true
        },
        {
          "name": "graiState",
          "writable": true
        },
        {
          "name": "graiMint"
        },
        {
          "name": "escrow",
          "writable": true
        },
        {
          "name": "voterGraiAta",
          "writable": true
        },
        {
          "name": "graiVaultAta",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram"
        },
        {
          "name": "rent"
        }
      ],
      "args": [
        {
          "name": "graiAmount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "assetConfig",
      "discriminator": [
        57,
        112,
        247,
        166,
        247,
        64,
        140,
        23
      ]
    },
    {
      "name": "escrow",
      "discriminator": [
        31,
        213,
        123,
        187,
        186,
        22,
        218,
        155
      ]
    },
    {
      "name": "graiState",
      "discriminator": [
        145,
        250,
        216,
        73,
        29,
        234,
        121,
        33
      ]
    },
    {
      "name": "position",
      "discriminator": [
        170,
        188,
        143,
        228,
        122,
        64,
        247,
        208
      ]
    },
    {
      "name": "referrer",
      "discriminator": [
        99,
        150,
        214,
        66,
        111,
        120,
        49,
        126
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Only the configured owner can perform this action"
    },
    {
      "code": 6001,
      "name": "invalidPendingOwner",
      "msg": "New owner must differ from the current owner"
    },
    {
      "code": 6002,
      "name": "amountZero",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6003,
      "name": "invalidAmount",
      "msg": "Amount or limit is out of range"
    },
    {
      "code": 6004,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6005,
      "name": "bpsTooHigh",
      "msg": "BPS value exceeds 10_000"
    },
    {
      "code": 6006,
      "name": "periodZero",
      "msg": "Liquidation and redeem periods must be non-zero"
    },
    {
      "code": 6007,
      "name": "invalidMint",
      "msg": "GRAI mint authority does not match program config"
    },
    {
      "code": 6008,
      "name": "invalidDestination",
      "msg": "Token account is invalid for this operation"
    },
    {
      "code": 6009,
      "name": "invalidDepositSource",
      "msg": "Depositor token account is invalid"
    },
    {
      "code": 6010,
      "name": "invalidGrinders",
      "msg": "Grinders state does not match grai config"
    },
    {
      "code": 6011,
      "name": "grindersGraiMismatch",
      "msg": "Grinders.grai_program does not match this GRAI program"
    },
    {
      "code": 6012,
      "name": "zeroAddress",
      "msg": "Address must be non-default"
    },
    {
      "code": 6013,
      "name": "alreadyBound",
      "msg": "Referral slot is already bound to this affiliate"
    },
    {
      "code": 6014,
      "name": "referralLoop",
      "msg": "Referral rebind would create a cycle"
    },
    {
      "code": 6015,
      "name": "invalidShares",
      "msg": "Affiliate share weights invalid (empty or sum != 10_000)"
    },
    {
      "code": 6016,
      "name": "assetUnknown",
      "msg": "Asset is unknown / not listed"
    },
    {
      "code": 6017,
      "name": "assetAlreadyRegistered",
      "msg": "Asset is already registered"
    },
    {
      "code": 6018,
      "name": "notPaused",
      "msg": "Asset must be paused before removal"
    },
    {
      "code": 6019,
      "name": "paused",
      "msg": "Asset is paused"
    },
    {
      "code": 6020,
      "name": "assetBalanceNonZero",
      "msg": "Asset vault balance must be zero to remove"
    },
    {
      "code": 6021,
      "name": "bribeAssetUnset",
      "msg": "Bribe asset is unset"
    },
    {
      "code": 6022,
      "name": "settlementAssetUnset",
      "msg": "Settlement asset is unset"
    },
    {
      "code": 6023,
      "name": "invalidCuts",
      "msg": "Yield cuts must sum to 10_000"
    },
    {
      "code": 6024,
      "name": "votesOpen",
      "msg": "Cannot change asset while votes are open"
    },
    {
      "code": 6025,
      "name": "liquidationOpen",
      "msg": "Liquidation is open"
    },
    {
      "code": 6026,
      "name": "liquidationClosed",
      "msg": "Liquidation is closed"
    },
    {
      "code": 6027,
      "name": "liquidationQuorumNotMet",
      "msg": "Liquidation quorum not met"
    },
    {
      "code": 6028,
      "name": "liquidationDelay",
      "msg": "Liquidation delay has not elapsed"
    },
    {
      "code": 6029,
      "name": "redeemPeriodActive",
      "msg": "Redeem period is still active"
    },
    {
      "code": 6030,
      "name": "chainlinkReadError",
      "msg": "Failed to read Chainlink feed account"
    },
    {
      "code": 6031,
      "name": "chainlinkRoundMissing",
      "msg": "Chainlink feed has no latest round data"
    },
    {
      "code": 6032,
      "name": "invalidChainlinkPrice",
      "msg": "Chainlink price must be positive"
    },
    {
      "code": 6033,
      "name": "staleChainlinkPrice",
      "msg": "Chainlink price is stale"
    },
    {
      "code": 6034,
      "name": "invalidChainlinkFeed",
      "msg": "Price feed does not match asset config"
    },
    {
      "code": 6035,
      "name": "invalidCustomPriceFeed",
      "msg": "Custom price feed does not match asset mint"
    },
    {
      "code": 6036,
      "name": "pythReadError",
      "msg": "Failed to read Pyth price feed account"
    },
    {
      "code": 6037,
      "name": "stalePythPrice",
      "msg": "Pyth price is stale"
    },
    {
      "code": 6038,
      "name": "invalidPythPrice",
      "msg": "Pyth price must be positive"
    },
    {
      "code": 6039,
      "name": "invalidRemainingAccounts",
      "msg": "Remaining accounts do not match asset registry"
    },
    {
      "code": 6040,
      "name": "invalidVoteEscrow",
      "msg": "Vote escrow does not match voter"
    },
    {
      "code": 6041,
      "name": "insufficientGraiBalance",
      "msg": "Insufficient GRAI balance"
    },
    {
      "code": 6042,
      "name": "insolventRevive",
      "msg": "Leftover NAV would dilute remaining shares"
    },
    {
      "code": 6043,
      "name": "insolventBook",
      "msg": "Deposit book is zero while shares remain"
    },
    {
      "code": 6044,
      "name": "liquidationNotConfirmed",
      "msg": "Liquidation has not been confirmed by the owner"
    },
    {
      "code": 6045,
      "name": "invalidLockerRange",
      "msg": "Invalid get_lockers range"
    },
    {
      "code": 6046,
      "name": "invalidVoterRange",
      "msg": "Invalid get_voters range"
    },
    {
      "code": 6047,
      "name": "invalidReferrer",
      "msg": "Sticky referrer / poach target is a protocol sink (GRAI, treasury, WSOL)"
    },
    {
      "code": 6048,
      "name": "invalidReferralRange",
      "msg": "Invalid get_lockers_data range"
    },
    {
      "code": 6049,
      "name": "invalidPdaInit",
      "msg": "PDA must be system-owned and empty to initialize"
    },
    {
      "code": 6050,
      "name": "invalidPythFeedId",
      "msg": "Pyth PriceUpdateV2 feed_id mismatch or unset"
    }
  ],
  "types": [
    {
      "name": "assetConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "assetMint",
            "type": "pubkey"
          },
          {
            "name": "priceFeed",
            "type": "pubkey"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "id",
            "type": "u32"
          },
          {
            "name": "accShare",
            "docs": [
              "Dividend index per unvoted locked GRAI, scaled by 1e18 (EVM `TotalPosition.accShare`)."
            ],
            "type": "u128"
          },
          {
            "name": "totalClaimable",
            "docs": [
              "Vault inventory reserved for locker claims (excluded from redeem / revive)."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "pythFeedId",
            "docs": [
              "Pyth push price id (EVM `Feed.data`). Zero for custom / Chainlink / legacy Pyth."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "bribeQuote",
      "docs": [
        "Return shape of the `preview_bribe` view."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bribeAmount",
            "type": "u64"
          },
          {
            "name": "premium",
            "type": "u64"
          },
          {
            "name": "discount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "claimAllQuote",
      "docs": [
        "Return shape of `preview_claim_all`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "assets",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "amounts",
            "type": {
              "vec": "u64"
            }
          }
        ]
      }
    },
    {
      "name": "config",
      "docs": [
        "Yield split, bribe premium, liquidation quorum, unlock penalty, and timing.",
        "",
        "Mirrors the EVM `Config`. `dividend_cut_bps + treasury_cut_bps` MUST sum to `BPS` (10_000).",
        "Yield cuts are immutable after `initialize`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "dividendCutBps",
            "docs": [
              "Share of distributed yield / bribe cut pool paid as dividends on unvoted locked GRAI, in bps."
            ],
            "type": "u16"
          },
          {
            "name": "treasuryCutBps",
            "docs": [
              "Share of distributed yield / bribe cut pool sent to the in-program treasury vault, in bps."
            ],
            "type": "u16"
          },
          {
            "name": "revenueShareBps",
            "docs": [
              "Affiliate slice of treasury income allocated on claim (`claimed * this / dividend_cut`).",
              "EVM default `5_55` (~5.55% of yield → affiliates)."
            ],
            "type": "u16"
          },
          {
            "name": "claimTipBps",
            "docs": [
              "Share of each `claim` paid to the caller as a tip, in bps of claimed amount (max 5%)."
            ],
            "type": "u16"
          },
          {
            "name": "bribePremiumBps",
            "docs": [
              "Max |ask adjustment| for dynamic bribes, in bps of book value."
            ],
            "type": "u16"
          },
          {
            "name": "quorumBps",
            "docs": [
              "Voted / supply needed to open liquidation, in bps."
            ],
            "type": "u16"
          },
          {
            "name": "unlockPenaltyBps",
            "docs": [
              "Flat unlock fee in bps of unlocked GRAI (EVM `unlockPenaltyBps`)."
            ],
            "type": "u16"
          },
          {
            "name": "liquidationPeriod",
            "docs": [
              "Delay after liquidation opens before `redeem` is allowed."
            ],
            "type": "u32"
          },
          {
            "name": "redeemPeriod",
            "docs": [
              "Extra window after `liquidation_period` before liquidation can be closed via `revive`."
            ],
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "depositQuote",
      "docs": [
        "Return shape of `preview_deposit`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "value",
            "type": "u128"
          },
          {
            "name": "graiOut",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "escrow",
      "docs": [
        "Per-user lock + liquidation vote escrow (GRAI held by the GRAI vault while locked)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "docs": [
              "Actively locked GRAI (max voting capacity; `amount - voted` earns dividends)."
            ],
            "type": "u64"
          },
          {
            "name": "voted",
            "docs": [
              "GRAI counted toward liquidation quorum (<= amount)."
            ],
            "type": "u64"
          },
          {
            "name": "votedAt",
            "docs": [
              "Timestamp of the latest `vote`."
            ],
            "type": "i64"
          },
          {
            "name": "lockerId",
            "docs": [
              "Index of this account in `grai_state.lockers`."
            ],
            "type": "u32"
          },
          {
            "name": "voterId",
            "docs": [
              "Index of this account in `grai_state.voters`."
            ],
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "escrowView",
      "docs": [
        "EVM `Escrow` view row for `getLockers` / `getVoters`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "account",
            "type": "pubkey"
          },
          {
            "name": "lockerId",
            "type": "u32"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "voted",
            "type": "u64"
          },
          {
            "name": "votedAt",
            "type": "i64"
          },
          {
            "name": "voterId",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "graiState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "Protocol admin (EVM `Ownable.owner`)."
            ],
            "type": "pubkey"
          },
          {
            "name": "pendingOwner",
            "docs": [
              "Two-step handoff target (EVM `Ownable2Step.pendingOwner`). Default = none."
            ],
            "type": "pubkey"
          },
          {
            "name": "beneficiar",
            "docs": [
              "Protocol fee recipient for the non-affiliate slice of claim-time treasury income",
              "(EVM `Treasury.beneficiar`)."
            ],
            "type": "pubkey"
          },
          {
            "name": "grinders",
            "type": "pubkey"
          },
          {
            "name": "settlementAsset",
            "docs": [
              "Asset used for bribe payments (EVM `settlementAsset`). `Pubkey::default()` means unset."
            ],
            "type": "pubkey"
          },
          {
            "name": "totalValue",
            "type": "u128"
          },
          {
            "name": "totalLocked",
            "docs": [
              "Total escrowed GRAI (`total_locked - total_voted` is the dividend base)."
            ],
            "type": "u64"
          },
          {
            "name": "totalVoted",
            "type": "u64"
          },
          {
            "name": "liquidation",
            "type": "bool"
          },
          {
            "name": "confirmed",
            "docs": [
              "Owner consent bit for 2-of-2 liquidation open (EVM `confirmed`)."
            ],
            "type": "bool"
          },
          {
            "name": "liquidationAt",
            "type": "i64"
          },
          {
            "name": "config",
            "type": {
              "defined": {
                "name": "config"
              }
            }
          },
          {
            "name": "royaltyBps",
            "docs": [
              "Secondary-sale royalty in bps (EVM ERC-2981 `royaltyBps`); receiver = locker."
            ],
            "type": "u16"
          },
          {
            "name": "affiliateLevels",
            "docs": [
              "Active affiliate referrer levels (`affiliate_share_bps[0..affiliate_levels]`)."
            ],
            "type": "u8"
          },
          {
            "name": "affiliateShareBps",
            "docs": [
              "Per-level split of claim-time revenue share (bps; active prefix sums to 10_000)."
            ],
            "type": {
              "array": [
                "u16",
                2
              ]
            }
          },
          {
            "name": "assetMints",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "lockers",
            "docs": [
              "Accounts with an open lock (`escrow.amount > 0`). EVM `lockers`."
            ],
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "voters",
            "docs": [
              "Accounts with an open liquidation vote (`escrow.voted > 0`)."
            ],
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "referrers",
            "docs": [
              "Treasury-bound lockers in mint order (EVM ERC-721 enumerable / `getLockersData`)."
            ],
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "lockerDataView",
      "docs": [
        "EVM GRAI `LockerData` (+ `nft_mint` for Metaplex cashflow NFT).",
        "`assets` / `claimable` match `preview_claim_all` (listed-mint order; amount may be 0)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "locker",
            "type": "pubkey"
          },
          {
            "name": "referrer",
            "type": "pubkey"
          },
          {
            "name": "ownerOf",
            "docs": [
              "Current NFT holder when known; default if not passed / not minted."
            ],
            "type": "pubkey"
          },
          {
            "name": "nftMint",
            "type": "pubkey"
          },
          {
            "name": "book",
            "type": {
              "defined": {
                "name": "referralBookView"
              }
            }
          },
          {
            "name": "assets",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "claimable",
            "type": {
              "vec": "u64"
            }
          }
        ]
      }
    },
    {
      "name": "poachQuote",
      "docs": [
        "Return shape of `preview_poach`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "referrer",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "position",
      "docs": [
        "Per-account, per-asset ledger (EVM `Position`).",
        "",
        "Locker dividends use `debt` / `claimable` vs `AssetConfig.acc_share`.",
        "Custodian `distribute` increments `yielded`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "debt",
            "docs": [
              "Debt vs the asset dividend index (MasterChef checkpoint)."
            ],
            "type": "u128"
          },
          {
            "name": "claimable",
            "docs": [
              "Dividends accrued but not yet claimed (`claim` may take a partial amount)."
            ],
            "type": "u64"
          },
          {
            "name": "yielded",
            "docs": [
              "Cumulative yield distributed by this account as custodian."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "redeemQuote",
      "docs": [
        "Return shape of `preview_redeem` / `get_redeemables`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "assets",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "amounts",
            "type": {
              "vec": "u64"
            }
          }
        ]
      }
    },
    {
      "name": "referralBookView",
      "docs": [
        "EVM `ITreasury.ReferralBook`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "value",
            "type": "u128"
          },
          {
            "name": "l1Value",
            "type": "u128"
          },
          {
            "name": "l2Value",
            "type": "u128"
          },
          {
            "name": "referrer",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "referrer",
      "docs": [
        "Sticky referrer tree + Metaplex cashflow NFT for a locker (EVM Treasury three-layer slot).",
        "",
        "- `referrer` = sticky tree link (`referrerOf`); moved only by first `mint` / `poach`.",
        "- `nft_mint` = Metaplex 1/1 cashflow NFT (`ownerOf`); OTC via ordinary NFT transfer.",
        "- `value` / `l1_value` / `l2_value` = deposit books keyed by locker identity."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "referrer",
            "docs": [
              "Sticky referrer locker (EVM `ReferralBook.referrer`); `Pubkey::default()` means unbound."
            ],
            "type": "pubkey"
          },
          {
            "name": "nftMint",
            "docs": [
              "Treasury cashflow NFT mint (`[\"treasury-nft\", locker]`); default = not minted yet."
            ],
            "type": "pubkey"
          },
          {
            "name": "value",
            "docs": [
              "This locker's cumulative deposited USD value."
            ],
            "type": "u128"
          },
          {
            "name": "l1Value",
            "docs": [
              "Cumulative value directly referred by this wallet."
            ],
            "type": "u128"
          },
          {
            "name": "l2Value",
            "docs": [
              "Cumulative value referred through its direct affiliates."
            ],
            "type": "u128"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "unlockQuote",
      "docs": [
        "Return shape of `preview_unlock`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "unlockAmount",
            "type": "u64"
          },
          {
            "name": "penalty",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
