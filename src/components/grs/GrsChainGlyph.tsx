import { SolanaLogomark } from '../SolanaLogomark'
import { EvmChainListIcon } from '../WalletNetworkSelect'

/** Chain glyph for GRS selects / book rows from a free-form network label. */
export function GrsChainGlyph({
  name,
  solana,
  size = 16,
}: {
  name: string
  solana?: boolean
  size?: number
}) {
  if (solana || /solana/i.test(name)) return <SolanaLogomark size={size} />
  if (/arbitrum/i.test(name)) return <EvmChainListIcon name="Arbitrum" />
  if (/base/i.test(name)) return <EvmChainListIcon name="Base" />
  if (/sepolia/i.test(name)) return <EvmChainListIcon name="Sepolia" />
  if (/ethereum/i.test(name)) return <EvmChainListIcon name="Ethereum" />
  return <EvmChainListIcon name="Ethereum" />
}
