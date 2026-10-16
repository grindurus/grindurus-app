/** Native asset sentinel — matches GRAI.sol `address(0)`. */
export const NATIVE_EVM_ASSET = '0x0000000000000000000000000000000000000000' as const

/** Matches `GRAI.decimals()` / `PriceOracleRouter.USD_DECIMALS` (book NAV + share units). */
export const GRAI_DECIMALS_EVM = 6
export const USD_SCALE_EVM = 6
