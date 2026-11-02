import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import './LegalPage.css'

const LEGAL_UNDERLINE = 'Always confirm transactions in your wallet.'

function renderLegalText(text: string): ReactNode {
  const i = text.indexOf(LEGAL_UNDERLINE)
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <u className="legal-page-underline">{LEGAL_UNDERLINE}</u>
      {text.slice(i + LEGAL_UNDERLINE.length)}
    </>
  )
}

type LegalSection = {
  heading: string
  body?: string[]
  bullets?: string[]
  /** Paragraphs rendered after `bullets` (e.g. closing disclaimer). */
  after?: string[]
  subsections?: { heading: string; body?: string[]; bullets?: string[] }[]
}

type LegalDoc = {
  title: string
  updated: string
  sections: LegalSection[]
}

const LEGAL_DOCS: Record<string, LegalDoc> = {
  privacy: {
    title: 'Privacy Policy',
    updated: '2 November 2026',
    sections: [
      {
        heading: 'Introduction',
        body: [
          'This Privacy Policy (the “Policy”) explains how GrindURUS (“GrindURUS,” the “Company,” “we,” “us,” or “our”) collects, uses, and shares data in connection with the services offered on https://grindurus.xyz (including the marketing landing page and product surfaces such as /grai, /grinders, /affiliate, /backtest, /risk, /terms, and /privacy), documentation at https://docs.grindurus.xyz, and other GrindURUS properties, products, and services that link to this Policy (the “Services”). Your use of the Services is also subject to our Terms of Service at https://grindurus.xyz/terms and Risk Disclosure at https://grindurus.xyz/risk.',
          'Please note that your use of the GrindURUS on-chain protocol (smart contracts and programs deployed on public blockchains — including GRAI, Grinders, Treasury / affiliate routing, Custodian implementations, PriceOracleRouter, and related Solana programs) is not governed by this Privacy Policy. On-chain activity is public by design and is outside our control once confirmed on a network. Where Interface descriptions disagree with deployed bytecode, the contracts control for on-chain behavior.',
        ],
      },
      {
        heading: 'High Level Summary',
        body: [
          'We do not seek to collect information that directly identifies individuals (such as legal name, street address, date of birth, or precise geolocation) for typical use of the Services. You do not need a traditional user account, password, or KYC to browse or connect a non-custodial wallet.',
        ],
        bullets: [
          'We collect limited non-identifying or weakly identifying data such as public on-chain addresses and activity, device/browser technical data, and aggregated product analytics — to operate, secure, and improve the Services, not to build a marketing profile of you.',
          'If you contact us or voluntarily provide an email or other contact detail, we may store that information to respond. We do not require email to use a wallet with the Services.',
          'Paid backtests (for example via x402 USDC or promocode) may involve payment-related metadata processed by us or payment infrastructure.',
          'Off-chain protocol ops surfaces (for example Toreador /table or related APIs used by the Interface) may process public grinder / custodian identifiers and status — not your private keys.',
          'You remain responsible for client-side privacy tools (browser settings, wallet choices, VPN/proxy, and similar). Material changes to this Policy will be reflected in an updated version on this page.',
        ],
      },
      {
        heading: 'Data We Collect',
        body: [
          'Privacy and transparency matter to us. We aspire to be clear about the limited data we process. We generally do not maintain traditional user accounts and do not ask for your name as a condition of using the Services. When you interact with the Services, we may collect or process:',
        ],
        bullets: [
          'Publicly available blockchain data. When you connect a non-custodial wallet, we may read and log publicly available blockchain addresses and related on-chain data to provide product features — including GRAI balances and locks, votes, claims, liquidations, referrer / cashflow NFT state, poach-related views, Grinders / custodian allocations, oracle-backed book displays, sales, vesting, and similar — understand usage of the Services, and, where applicable, screen for illicit activity using blockchain analytics intelligence. Blockchain addresses are public data not created by us and, by themselves, are not personal names.',
          'Wallet connection and transaction metadata. Interface sessions may involve wallet connection events and the payloads you authorize for signing (deposit, lock, unlock, vote, bribe, claim, poach, liquidate / redeem, and similar). We do not receive your private keys or seed phrases, and we cannot move assets from your wallet without your signature. Always confirm transactions in your wallet.',
          'Technical and device data; localStorage and similar technologies. We and certain third-party providers may access information from cookies, localStorage, device or browser identifiers, and similar technologies to provide and personalize the Services across sessions (for example theme preference, UI state, remembered chain or referral selections). This may include browser type, referring/exit pages, operating system, language, and related device information. We may analyze journeys in aggregate to improve UX.',
          'Analytics. The Services may use analytics tooling (including third-party scripts loaded on https://grindurus.xyz, such as Google Analytics and similar product analytics) to understand traffic and feature usage.',
          'Information from other sources. We may receive information about wallet addresses or transactions from service providers (RPC nodes, indexers, explorers, oracles, bridge/messaging infrastructure, blockchain analytics, and protocol ops APIs such as Toreador) to operate the Services, display live tables / status, comply with legal obligations, and help prevent fraud or illicit use.',
          'Backtest and payment-related data. If you purchase or unlock backtests, we or payment processors may process payment status, amounts, network/tx references, promocode redemption, and related technical metadata needed to grant access.',
          'Correspondence. We receive communications you send via email, social media (including https://x.com/grindurus), GitHub, docs feedback channels, or other support paths, including any information you choose to include.',
          'Information you specifically provide. If you voluntarily provide information (such as an email for updates), we may use it for the purpose described when you provided it. You do not need to provide personal data to use the core wallet-connected Services.',
          'Survey or usability information. If you participate in a survey or usability study, we record biographical details you choose to give and your responses.',
        ],
      },
      {
        heading: 'How We Use Data',
        body: [
          'We use data we collect in accordance with your instructions, our Terms of Service, and applicable law, including to:',
        ],
        bullets: [
          'Provide the Services — operate, maintain, customize, and improve Interfaces for GRAI, Grinders / custodians, affiliates / poach, backtests, legal pages, and related features.',
          'Customer support — respond to inquiries and troubleshooting requests.',
          'Safety and security — protect against, investigate, and stop fraudulent, unauthorized, or illegal activity; address security risks and bugs; enforce our agreements; and protect users and the Company.',
          'Legal compliance — respond to regulators, government entities, and law enforcement as required or requested under applicable law.',
          'Aggregated insights — compile aggregated or de-identified statistics about how the Services are used so we can improve product experience.',
        ],
      },
      {
        heading: 'How We Share Data',
        body: [
          'We may share or disclose data we collect:',
        ],
        bullets: [
          'With service providers. Vendors that help us deliver and improve the Services — for example RPC and infrastructure providers, CDNs, analytics providers, wallet connection tooling, oracle / indexer providers, bridge/messaging providers, blockchain analytics, protocol ops backends (including Toreador / related APIs), and payment processors for paid backtests.',
          'To comply with legal obligations. In litigation, regulatory proceedings, compliance measures, or when compelled by subpoena, court order, or other legal process; and when we believe disclosure is necessary to prevent harm or to enforce our Terms of Service and policies.',
          'Safety and security. To investigate and stop fraud, unauthorized access, or illegal activity, and to address security incidents.',
          'Business changes. In connection with a merger, acquisition, financing, bankruptcy, reorganization, asset sale, or similar transaction.',
          'With your consent. Any other time you ask us to share information or clearly consent to sharing.',
        ],
        after: [
          'We do not sell your personal information for money, and we do not share information with third parties for their own marketing purposes. Public blockchain data you broadcast remains public regardless of this Policy.',
        ],
      },
      {
        heading: 'Third-Party Cookies and Analytics',
        body: [
          'We use services provided by Google and other third parties that rely on cookies, device identifiers, localStorage, and similar technologies to collect information about your use of the Services. You can limit this, including by:',
        ],
        bullets: [
          'Blocking or deleting cookies in your browser settings (see resources such as https://www.allaboutcookies.org).',
          'Using privacy-focused browsers, extensions, or tracking protection features.',
          'Using Google’s ad settings tools at https://adssettings.google.com and reviewing Google’s privacy policy at https://policies.google.com/privacy.',
          'Using industry opt-out tools where available (for example http://optout.aboutads.info and http://optout.networkadvertising.org) on each browser or device you use.',
        ],
      },
      {
        heading: 'Third-Party Links and Sites',
        body: [
          'The Services may integrate or link to technologies and sites operated by others (documentation hosts, explorers, wallets, oracles, adapters / venues, social networks, GitHub, bridges, payment rails, and similar). When you leave the Services or interact with those parties, they may collect information under their own privacy policies. This Policy does not control those parties. We take reasonable steps within our control to isolate how third-party failures affect the Services, but residual third-party risk remains (see also our Risk Disclosure).',
        ],
      },
      {
        heading: 'Security',
        body: [
          'We implement and maintain reasonable administrative, physical, and technical safeguards designed to help protect data from loss, theft, misuse, and unauthorized access. Transmission over the internet is never completely secure, and we cannot guarantee absolute security.',
          'You are responsible for your activity on the Services and for the security of your wallets, addresses, devices, and cryptographic keys. Never share seed phrases or private keys with anyone, including anyone purporting to represent GrindURUS. Always confirm transactions in your wallet before signing.',
        ],
      },
      {
        heading: 'Age Requirements',
        body: [
          'The Services are intended for a general audience and are not directed at children. We do not knowingly collect personal information from children under 18. If you believe we have received such information, contact us through the channels below so we can delete it where feasible.',
        ],
      },
      {
        heading: 'Additional Notice to California Residents (CCPA)',
        body: [
          'If you are a California resident, the California Consumer Privacy Act (“CCPA”), as amended, may provide rights regarding personal information.',
          'Privacy practices. We do not “sell” personal information as that term is commonly understood under the CCPA for monetary consideration. See “How We Share Data” above for categories of recipients.',
          'Privacy rights. Subject to CCPA limits, you may have the right to request information about how we collect, use, and share personal information; request a copy of personal information we maintain about you; and request deletion of personal information we received about you. We will respond only to the extent we can reasonably associate information we maintain with the identifiers you provide. If we deny a request, we will communicate that decision. You may exercise these rights free from discrimination.',
          'Submitting a request. Contact us via the channels in “Contact Us” below. We may need to verify your identity before responding. California residents may designate an authorized agent with appropriate written authorization.',
          'Blockchain limitation. We cannot edit or delete information stored on public blockchains (including wallet addresses, GRAI positions, affiliate NFTs, and confirmed transactions).',
        ],
      },
      {
        heading: 'Disclosures for European Economic Area and UK Users',
        body: [
          'Where GDPR or UK GDPR applies, we process personal data for the purposes in “How We Use Data.” Legal bases may include: consent; performance of a contract with you; compliance with a legal obligation; and/or our legitimate interests (operating, securing, and improving the Services) where those interests are not overridden by your rights.',
          'Your rights may include access, rectification, erasure, restriction, objection, and portability, and the right to withdraw consent where processing is consent-based. Contact us via “Contact Us” to exercise rights. We may request additional information to process your request.',
          'We may retain information as needed for the purpose collected and may continue to retain data where required for legitimate interests such as legal compliance, dispute resolution, fraud prevention, and enforcing agreements. We cannot alter or erase on-chain data.',
        ],
      },
      {
        heading: 'Changes to this Policy',
        body: [
          'If we make material changes to this Policy, we will update the “Last updated” date on this page and may provide additional notice through the Services. Continued use of the Services after changes become effective indicates that you have reviewed and accept the updated Policy.',
        ],
      },
      {
        heading: 'Contact Us',
        body: [
          'Questions about this Policy or how we collect, use, or share information: use the channels listed on https://docs.grindurus.xyz or our public profiles, including https://x.com/grindurus and https://github.com/grindurus.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    updated: '2 November 2026',
    sections: [
      {
        heading: 'Agreement',
        body: [
          'These Terms of Service (the “Agreement”) explain the terms and conditions by which you may access and use the products and interfaces provided by GrindURUS (“GrindURUS,” “we,” “our,” or “us”).',
          'The Products include, without limitation: (a) the website at https://grindurus.xyz, including the marketing landing page and product surfaces such as /grai, /grinders, /affiliate, /risk, /terms, /privacy, and /backtest (together, the “Interface” or “App”); (b) documentation at https://docs.grindurus.xyz; and (c) any other GrindURUS products or services that link to this Agreement (together, the “Products”). There is no separate app subdomain — the canonical product site is https://grindurus.xyz.',
          'You must read this Agreement carefully, together with our Risk Disclosure at https://grindurus.xyz/risk and Privacy Policy at https://grindurus.xyz/privacy. By accessing or using any of the Products, you signify that you have read, understand, and agree to be bound by this Agreement in its entirety. If you do not agree, you are not authorized to access or use any of our Products.',
          'To access or use any of our Products, you must be able to form a legally binding contract with us. You represent that you are at least the age of majority in your jurisdiction and have full right, power, and authority to enter into and comply with this Agreement on behalf of yourself and any entity for which you may access the Products. If you enter into this Agreement on behalf of an entity, you represent that you have authority to bind that entity.',
          'You further represent that you are not (a) the subject of economic or trade sanctions administered or enforced by any governmental authority or otherwise designated on any list of prohibited or restricted parties, or (b) a citizen, resident, or organized in a jurisdiction or territory that is the subject of comprehensive country-wide, territory-wide, or regional economic sanctions by the United States or other applicable authorities. You represent that your access and use of the Products will fully comply with all applicable laws and regulations, and that you will not use the Products to conduct, promote, or facilitate any illegal activity.',
          'NOTICE: This Agreement contains important information, including disclaimers, liability limits, and dispute-related provisions that affect your rights. The Products are available to you only if you agree completely with these terms. Where Interface copy, docs, or marketing disagree with deployed bytecode, the contracts control.',
        ],
      },
      {
        heading: '1. Our Products',
        body: [
          '1.1 The Interface. GrindURUS is an automated market-taking protocol that turns crypto price volatility into yield through dual-sided buy-low/sell-high and sell-high/buy-low strategies. The Interface at https://grindurus.xyz provides a web-based means of access to GrindURUS smart contracts and programs on public blockchains (including EVM networks and Solana) and related tools. Through the Interface you may, among other things: explore the landing overview; deposit into and interact with GRAI; lock, vote, unlock, bribe, claim dividends, and (where enabled) liquidate / redeem / revive; view Grinders / custodian state; use affiliates / referral / poach surfaces; and run strategy backtests.',
          'The Interface is distinct from the on-chain protocol. The protocol comprises open-source or source-available smart contracts and programs (including GRAI, Grinders, Treasury / affiliate routing, Custodian implementations, PriceOracleRouter, and related contracts) deployed on public networks. The Interface is one, but not the exclusive, means of accessing those contracts. By using the Interface, you understand that you are interacting with public blockchains and autonomous contracts — not buying or selling digital assets from us as a counterparty in the ordinary course, and not receiving custody services from us.',
          'Networks, listed assets, deployments, owner-set parameters, and tokenomics may change, including while the project is pre-mainnet or before TGE. Always verify current details against https://docs.grindurus.xyz and live contract state. Always confirm transactions in your wallet.',
          'To access on-chain features of the Interface, you must use non-custodial wallet software. Your relationship with any third-party wallet provider is governed by that provider’s terms. We do not have custody or control over the contents of your wallet and have no ability to retrieve or transfer its contents. By connecting your wallet to the Interface, you agree to be bound by this Agreement.',
          '1.2 GRAI. GRAI (Grinders Artificial Index) is an elastic, non-rebasing, dollar book-priced fund-share token (6 decimals on EVM). It is not a directional prediction product, stablecoin, dollar peg, or promise of instant basket redeem: yield is framed as harvesting realized volatility via Grinders custodians, not forecasting price. Deposits mint against USD book (with an optional compounding mint-premium ask after mintPremiumAt). Assets move to Grinders; GRAI is a claim on fund accounting. Deposits, locks, votes, dividends, unlocks, bribes, and liquidate → redeem → revive flows are executed by smart contracts according to their code and parameters.',
          'Unlocked wallet GRAI earns nothing. Locked GRAI accrues asset dividends after profit is reported via distribute, including locked GRAI that has been voted toward liquidation quorum — voting does not leave the dividend base. Default yield cuts (dividendCutBps / treasuryCutBps) are fixed at initialize; other knobs may be owner-patchable. While regime == GRINDING there is generally no live protocol redeem of the full basket; exit paths include secondary markets, unlock (with penalty to Grinders), bribe of voted GRAI, or post-quorum liquidation redeem where both hasQuorum() and !grinders.grinding() hold. Book values, cuts, penalties, previews, and metrics shown in the Interface are informational and may be stale or wrong.',
          '1.3 Grinders, custodians, and toreador. On deposit, assets are sent to the Grinders reserve and may later be allocated into Custodian smart-contract seats (NFT-indexed) that trade via adapters and venues. Day-to-day ops (allocate / deallocate / mint custodians / heartbeat) are gated by the toreador role — not by GRAI holders. Protocol admin for Grinders resolves from GRAI.owner(). A compromised or idle toreador can strand capital or keep heartbeats fresh (blocking liquidation) but cannot withdraw or steal balances via an owner drain path. Off-chain execution, trading keys, venue risk, counterparty risk, bridge risk, and operational error sit outside GRAI. Yield lands on-chain only when someone calls distribute with assets; past or simulated performance is not a guarantee.',
          '1.4 Affiliates and poach. Affiliate / referral features (including sticky first-deposit referrer binding, claim-time revenueShare to the referrer tree / beneficiar, and cashflow NFTs) are subject to on-chain Treasury rules and the Interface at /affiliate. Tree seat and cashflow NFT are separate markets: poach buys the upline seat for GRAI (fee to Grinders); OTC NFT transfer changes who is paid without changing referrerOf. Eligibility, rates, and presentation may change with upgrades, owner knobs, and this Agreement. Affiliate payouts are not a guaranteed rebate.',
          '1.5 Backtest and educational tools. Backtests on /backtest, calculators, charts, and strategy previews are informational and educational only. They are not offers, solicitations, or promises of future returns. Access to backtests may require payment (for example x402 USDC) or a promocode and is not a free public data scrape API.',
          '1.6 Other Products. We may offer additional products from time to time; such products are “Products” under this Agreement whether or not specifically named here.',
          '1.7 Third-Party Services and Content. The Products may integrate or link to third-party services (RPC providers, wallets, bridges, explorers, oracles, adapters, routers, venues, analytics, documentation hosts, social sites, and similar). Your use of Third-Party Services may be subject to separate terms and privacy policies. We enable them for convenience and do not endorse or assume responsibility for them. Dealings with third parties are solely between you and them. We take reasonable steps within our control to isolate how third-party failures affect protocol accounting and custody boundaries, but residual third-party risk remains.',
        ],
      },
      {
        heading: '2. Modifications',
        body: [
          '2.1 Modifications of this Agreement. We may modify this Agreement from time to time. If we make material modifications, we will update the date at the top of this page and maintain a current version at https://grindurus.xyz/terms. Modifications are effective when posted. Continued access or use of any Products after posting constitutes acceptance. If you do not agree, you must stop using the Products.',
          '2.2 Modifications of our Products. We reserve the right, with or without notice: (a) to modify, substitute, eliminate, or add to any Products; and (b) to review, filter, disable, delete, or remove content and information from the Products. On-chain, GRAI is UUPS-upgradeable and Ownable2Step: the owner may change feeds, listings, pauses, upgrades, and patchable config within coded limits (yield cut identities are immutable after initialize). Smart contracts on public networks may remain accessible through other tools even if the Interface changes.',
        ],
      },
      {
        heading: '3. Intellectual Property',
        body: [
          'We own or license intellectual property and other rights in the Products and their contents (software, text, images, brands, and look and feel), except for open-source protocol code released under its applicable licenses and except for third-party materials. Subject to this Agreement, we grant you a limited, revocable, non-exclusive, non-sublicensable, non-transferable license to access and use the Products solely as permitted herein.',
          'You agree not to copy, modify, distribute, tamper with, reverse engineer, disassemble, or decompile the Products except as expressly allowed by law or open-source licenses. Feedback you provide may be used by us without restriction or compensation.',
          'Protocol repositories and documentation published under open-source or documentation licenses remain governed by those licenses. The protocol is not “owned” by the Interface in the sense of exclusive control over public deployments.',
        ],
      },
      {
        heading: '4. Your Responsibilities',
        body: [
          '4.1 Prohibited Activity. You agree not to engage in, or attempt: intellectual property infringement; cyberattacks or interference with systems; fraud or misrepresentation; market manipulation (including wash trading, pump-and-dump schemes, or similar); securities or derivatives violations under applicable law; circumvention of geographic or other access restrictions; sale of stolen or illicitly obtained property; abusive scraping or data mining of the Products; harmful or unlawful content; or any other unlawful conduct.',
          '4.2 Unsolicited transactions. All transactions you submit through the Products are unsolicited and initiated solely by you. You have not received investment advice from us in connection with any transaction, and we do not conduct suitability reviews. Always confirm transactions in your wallet before signing.',
          '4.3 Non-custodial; no fiduciary duties. The Products are non-custodial applications: we do not take custody, possession, or control of your digital assets at rest in your wallet. Fund assets deposited into the protocol are held and moved by on-chain contracts (Grinders / custodians) under their code — not by us as a custodian or broker. You are solely responsible for your wallets, private keys, and seed phrases. Never share credentials with anyone. We accept no liability for wallet compromise or for how any Product interacts with a specific wallet.',
          'This Agreement does not create fiduciary duties. To the fullest extent permitted by law, any fiduciary duties that might otherwise exist are irrevocably disclaimed and waived. Our only duties to you are those expressly set out in this Agreement.',
          '4.4 Compliance and taxes. Availability of a Product or asset does not mean it is lawful or appropriate for you. You are solely responsible for complying with all laws that apply to you (including sanctions, securities, commodities, and tax rules) and for any transfer or trading restrictions. Deposits, dividends, unlocks, bribes, liquidations, poaches, and token sales can create taxable events; you alone are responsible for determining and remitting any taxes.',
          '4.5 Gas and network fees. Blockchain transactions require network fees. Except as we expressly state otherwise, you are solely responsible for fees for transactions you initiate, including unlock penalties, claim tips, poach fees, LayerZero or bridge fees where applicable, and any fees charged for paid backtests.',
          '4.6 Release. You assume all risks of accessing and using the Products and interacting with the protocol. To the fullest extent permitted by law, you waive and release us from liability, claims, and damages arising from or relating to your use of the Products.',
        ],
      },
      {
        heading: '5. Disclaimers',
        body: [
          '5.1 Assumption of risk. BY ACCESSING AND USING THE PRODUCTS, YOU REPRESENT THAT YOU UNDERSTAND THE INHERENT RISKS OF CRYPTOGRAPHIC AND BLOCKCHAIN SYSTEMS AND DIGITAL ASSETS. Markets are nascent and volatile. Smart contract transactions execute and settle automatically and are generally irreversible when confirmed. Network costs and speeds vary. Bridged or wrapped assets differ from native assets. Strategy, custodian, oracle, lock/unlock, vote/bribe, distribute/claim, liquidation/redeem/revive, affiliate/poach, vesting, sale, IDO, and bridge mechanisms can result in partial or total loss.',
          'YOU FURTHER ACKNOWLEDGE MATERIAL PROTOCOL RISKS DESCRIBED IN THE RISK DISCLOSURE, INCLUDING WITHOUT LIMITATION: STATE CORRUPTION; MISCALCULATIONS IN PRICING OR ACCOUNTING FORMULAS; THIRD-PARTY INTEGRATION FAILURES; TOREADOR / HEARTBEAT GATES ON LIQUIDATION; THIN OR ABSENT SECONDARY MARKETS FOR GRAI; AND ADMIN / UUPS UPGRADE AUTHORITY. WE DESIGN AND OPERATE TO REDUCE ENGINEERING RISKS; NO PROCESS ELIMINATES THEM.',
          'YOU ACKNOWLEDGE THAT WE DO NOT CONTROL PUBLIC BLOCKCHAINS OR THIRD-PARTY INFRASTRUCTURE, AND THAT YOU ASSUME FULL RESPONSIBILITY FOR RISKS OF USING THE INTERFACE TO INTERACT WITH THE PROTOCOL. INTERFACE DOWNTIME DOES NOT PAUSE ON-CHAIN RISK.',
          '5.2 No warranties. THE PRODUCTS AND THIRD-PARTY SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS, IMPLIED, OR STATUTORY, INCLUDING MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. WE DO NOT WARRANT UNINTERRUPTED, SECURE, OR ERROR-FREE ACCESS; ACCURATE OR COMPLETE INFORMATION (INCLUDING BOOK NAV, PREVIEWS, OR RPC DATA); OR FREEDOM FROM HARMFUL CODE. NO STATEMENT WE MAKE CREATES A WARRANTY.',
          'PROTOCOL CONTRACTS AND PROGRAMS ARE LIKEWISE PROVIDED AT YOUR OWN RISK. WE DO NOT GUARANTEE BOOK PRICES, MINT PREMIUM OUTCOMES, DIVIDENDS, SALE CLEARING, LIQUIDITY, BRIDGE SUCCESS, MAINNET TIMING, LIQUIDATION AVAILABILITY, OR CONTINUED AVAILABILITY OF ANY FEATURE.',
          '5.3 No investment advice. Informational materials in the Products (including landing copy, tokenomics, cap tables, APY-like or yield figures, backtests, FDV or price displays, and docs) are for information only and are not investment, legal, tax, or accounting advice and are not a recommendation or solicitation. You alone decide whether any transaction is appropriate for your circumstances and risk tolerance.',
        ],
      },
      {
        heading: '6. Indemnification',
        body: [
          'You agree to hold harmless, defend, and indemnify GrindURUS and our affiliates, and our and their respective officers, directors, employees, contractors, agents, licensors, and representatives (the “GrindURUS Parties”) from and against claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys’ fees) arising from or relating to: (a) your access or use of the Products, the protocol, or Third-Party Services; (b) your violation of this Agreement, third-party rights, or applicable law; (c) any other party’s access or use of the Products using your assistance or a device or account you control; and (d) disputes between you and other users or your own customers. We may assume exclusive defense of any indemnified matter; you will cooperate reasonably. You may not settle a claim against a GrindURUS Party without our written consent.',
        ],
      },
      {
        heading: '7. Limitation of Liability',
        body: [
          'TO THE FULLEST EXTENT PERMITTED BY LAW, WE AND THE GRINDURUS PARTIES WILL NOT BE LIABLE FOR ANY INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES, INCLUDING LOSS OF PROFITS, GOODWILL, DATA, DIGITAL ASSETS, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATING TO ACCESS TO, USE OF, OR INABILITY TO USE THE PRODUCTS, THE PROTOCOL, OR THIRD-PARTY SERVICES — WHETHER BASED IN CONTRACT, TORT, NEGLIGENCE, STRICT LIABILITY, OR OTHERWISE — EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.',
          'WITHOUT LIMITING THE FOREGOING, WE ASSUME NO LIABILITY FOR: (A) ERRORS OR INACCURACIES OF CONTENT OR PREVIEWS; (B) UNAUTHORIZED ACCESS TO SERVERS OR DATA; (C) INTERRUPTION OF THE PRODUCTS; (D) BUGS, STATE CORRUPTION, OR MALWARE; (E) LOSS FROM ON-CHAIN PAYMENTS OR TRANSACTIONS YOU INITIATE; (F) THIRD-PARTY CONDUCT OR SERVICES; OR (G) ACTIONS OR INACTION OF PROTOCOL ROLES (INCLUDING OWNER OR TOREADOR) WITHIN THE CODED SURFACE.',
          'SOME JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS; IN THOSE CASES OUR LIABILITY IS LIMITED TO THE MAXIMUM EXTENT PERMITTED. EXCEPT WHERE PROHIBITED, OUR TOTAL LIABILITY FOR ALL CLAIMS RELATING TO THE PRODUCTS WILL NOT EXCEED ONE HUNDRED U.S. DOLLARS (US$100) OR THE EQUIVALENT IN LOCAL CURRENCY.',
        ],
      },
      {
        heading: '8. Governing Law and Disputes',
        body: [
          '8.1 Informal resolution. We will attempt to resolve disputes through informal good-faith discussion. Before filing a formal claim, contact us via the channels listed on https://docs.grindurus.xyz or our public social profiles (including https://x.com/grindurus) and allow sixty (60) days for an informal resolution attempt.',
          '8.2 Governing law. To the maximum extent permitted by law, this Agreement and any dispute arising out of or relating to the Products or this Agreement are governed by applicable law without regard to conflict-of-law principles that would require another jurisdiction’s law. Courts of competent jurisdiction may hear disputes that are not otherwise resolved, subject to any mandatory consumer protections that apply to you.',
          '8.3 Individual claims. To the fullest extent permitted by law, you bring claims only in your individual capacity and not as a plaintiff or class member in any class, collective, or representative proceeding, and you waive any right to a jury trial where waivable.',
        ],
      },
      {
        heading: '9. Miscellaneous',
        body: [
          '9.1 Entire agreement. This Agreement, together with the Privacy Policy and Risk Disclosure incorporated by reference, is the entire agreement between you and us regarding the Products and supersedes prior written or oral understandings on that subject. If there is a conflict between Interface descriptions and deployed bytecode, the bytecode controls for on-chain behavior.',
          '9.2 Assignment. You may not assign this Agreement without our prior written consent. We may assign this Agreement. Subject to that, this Agreement binds successors and permitted assigns.',
          '9.3 Not a registered exchange or broker. We are not registered with the U.S. Securities and Exchange Commission or any other agency as a national securities exchange, broker, dealer, or similar. We do not broker orders on your behalf. Settlement of on-chain transactions occurs on public networks according to smart contracts you invoke.',
          '9.4 No deposit insurance. Assets used with the protocol are generally not covered by FDIC, SIPC, or similar insurance or investor compensation schemes. There is no guaranteed bailout of GRAI holders, Grinders custodians, or Treasury affiliates.',
          '9.5 Notices. We may provide notices by commercially reasonable means, including posting on https://grindurus.xyz, https://docs.grindurus.xyz, or public channels. Notices are effective upon posting.',
          '9.6 Severability. If any provision is held invalid or unenforceable, it will be modified to the minimum extent necessary to achieve its purpose, and the remaining provisions will continue in effect.',
          '9.7 Privacy and risk. Our Privacy Policy at https://grindurus.xyz/privacy describes how we process information in connection with the Products. Our Risk Disclosure at https://grindurus.xyz/risk summarizes material risks of the Interfaces and on-chain mechanics and is incorporated by reference; it does not limit the disclaimers or liability limits in this Agreement.',
        ],
      },
    ],
  },
  risk: {
    title: 'Risk Disclosure',
    updated: '2 November 2026',
    sections: [
      {
        heading: 'General',
        body: [
          'This Risk Disclosure summarizes material risks of the GrindURUS Interfaces at https://grindurus.xyz and of the on-chain mechanics in grindurus-evm (primarily GRAI.sol, Grinders.sol, Treasury.sol, Custodian implementations, and PriceOracleRouter) and related Solana programs. It does not replace the Terms of Service, the Privacy Policy, or the deployed bytecode. Where marketing copy or older docs disagree with the contracts, the contracts control. Parameters, networks, and deployments may change — including before mainnet or TGE — and on-chain config can be updated by the GRAI owner within coded limits. Always verify https://docs.grindurus.xyz and live contract state.',
          'In addition to market and operational risks described below, protocol engineering risks include at least the following. We design and operate to reduce them; no process eliminates them.',
        ],
        bullets: [
          'State corruption. Incorrect, inconsistent, or stuck on-chain or off-chain state (escrows, books, custodians, heartbeats, indexes) can mis-route value or block exits. We carefully design state transitions, access control, and lifecycle guards around GRAI / Grinders / Treasury / custodians — including tests and operational checks — but residual state-corruption risk remains.',
          'Miscalculations. Errors in pricing, mint/ask math, cuts, penalties, quorum, bribe curves, dividend index, or redeem pro-rata can over- or under-allocate value. We carefully implement and review the protocol formulas against coded invariants — including audits, tests, and dual-path reviews where practical — but residual calculation risk remains.',
          'Third-party integrations. Oracles, adapters, routers, bridges, venues, RPCs, wallets, and other external systems can fail, censor, or be compromised in ways that affect fund NAV or UX. We do everything reasonably within our control to isolate and limit how third-party failures can compromise protocol accounting and custody boundaries — including adapter isolation and fail-closed paths where coded — but residual third-party risk remains.',
        ],
        after: [
          'Nothing here is investment, legal, tax, or accounting advice. Past or simulated performance (including /backtest) is not a guarantee of future results.',
        ],
      },
      {
        heading: 'Custodian and strategy risk (Grinders)',
        body: [
          'On deposit, assets are sent to the Grinders contract reserve and may later be allocated into Custodian proxies (NFT-indexed seats) that trade via adapters (CoW, Path / routers, LiFi, Aave, and other registered kinds — plus off-chain venues where an adapter is configured). Off-chain execution, trading keys, venue risk, counterparty risk, bridge risk, and operational error sit outside GRAI and can impair or wipe fund NAV even while on-chain bookkeeping looks healthy.',
          'Day-to-day Grinders ops (allocate / deallocate / mint custodians / heartbeat) are gated by the toreador role, not by GRAI holders. Protocol admin for Grinders is read from GRAI.owner(). A compromised or idle toreador can strand capital in custodians or keep heartbeats fresh forever — blocking liquidation — but cannot withdraw or steal assets from the contracts; toreador has ops keys only, not an owner drain path.',
          'Reported yield only lands on-chain when someone calls GRAI.distribute with assets. Delayed, incorrect, zero, or never-reported profit means lockers may receive little or no dividend for long periods even if markets moved.',
          'Grinders.grinding() is true while block.timestamp < heartbeatAt + grindPeriod (default grindPeriod = 7 days; owner may set 1–30 days). Heartbeat advances on distribute / allocate / deallocate / heartbeat. Active ops can block liquidation even with quorum; a stale heartbeat plus quorum can open liquidation when you did not expect it. Keeper hard sweeps do not themselves check grinding().',
        ],
      },
      {
        heading: 'What GRAI is (and is not)',
        body: [
          'GRAI (Grinders Artificial Index) is an elastic, non-rebasing fund-share ERC-20 (6 decimals on EVM). New deposits mint against USD book: book = depositUsd × totalSupply / totalValue (or 1:1 book when totalValue is zero). Assets move to Grinders; GRAI is a claim on fund accounting, not a dollar peg, stablecoin, or instant redeem of the basket.',
          'After mintPremiumAt, previewDeposit compounds an ask of config.mintPremiumBpsPerYear (default 5%/year, once per full year, capped). Full USD still credits totalValue, but later depositors receive fewer GRAI for the same money — early holders are not diluted 1:1. Owner can retune the rate; the clock is set at initialize / reinitialize.',
          'GRAI is not a directional prediction market. Yield is framed as harvesting realized volatility through Grinders custodians — that process can still lose money, though the protocol is designed with procedures intended to reduce those risks (dual-sided market-taking, custodian isolation, on-chain accounting, heartbeat / liquidation gates, and related controls). No design eliminates loss risk.',
          'While regime == GRINDING there is no live protocol redeem of the basket. Primary exits are secondary-market sales, unlock (with penalty), bribe of voted GRAI, or liquidate → redeem → (optional) revive as coded.',
        ],
      },
      {
        heading: 'GRAI risks',
        subsections: [
          {
            heading: 'Deposit, book price, and oracle risk',
            body: [
              'Deposits only work for owner-listed assets with live PriceOracleRouter feeds (Chainlink, Pyth, or custom). If a feed is paused, missing, stale, manipulated, or wrong, mint sizing and book NAV can be wrong. Paused feeds block deposit; they do not necessarily stop claim or distribute.',
              'Mint uses the amount actually received (fee-on-transfer assets can mint less than you expect). Native ETH and ERC-20 paths differ; WETH / settlement rules apply.',
              'totalValue and oracle USD prices are accounting constructs and can diverge from secondary-market GRAI. You may buy or sell at a premium or discount to book. Yield held on GRAI is excluded from totalValue.',
              'First Treasury.mint on deposit sticky-binds a referrer for that locker (or self-root if none / loop). Later deposits ignore the referrer argument. Affiliate payouts on claim walk that sticky tree and pay ownerOf of each upline cashflow NFT — not a guaranteed rebate and not paid from the locker’s dividend asset.',
              'Tree seat and cashflow NFT are two markets. Anyone may poach(locker) by paying GRAI equal to lockerBooks.value + l1Value (l2Value is not in the ask). A default poachFeeBps (1%) goes to Grinders; the rest goes to the current referrer; Treasury.rebind then sets referrerOf(locker) to the poacher and shifts L1/L2 books. Poach does not move the cashflow NFT. Conversely, an OTC transfer of the NFT changes who receives claim payouts for that node without changing referrerOf — so the person you “bought” as referrer can lose the seat via poach, and the seat you poached still pays the NFT owner until you buy or receive that NFT. Poach is blocked while liquidation is open; downline cannot poach an upline; cycles revert.',
            ],
          },
          {
            heading: 'Lock, unlock, and penalty GRAI',
            body: [
              'Wallet (unlocked) GRAI earns no dividends. Dividend accrual is on escrows.locked (totalLocked). Voting does not leave that base: locked + voted GRAI still earns dividends until unlocked or bribed away.',
              'unlock takes a flat penalty (default unlockPenaltyBps 1%). Penalty GRAI is transferred to Grinders — not rebated to you or Treasury. Repeated lock/unlock permanently reduces your shares.',
              'While penalty > 0, unlocks below an intentional dust floor revert (including attempting to unlock an entire escrow still below the floor). Dust can stick until you top up, owner sets penalty to 0, or you redeem in liquidation.',
              'New locks sync dividend debt so you cannot claim a past index; misunderstanding this can mean zero claims right after locking.',
            ],
          },
          {
            heading: 'Vote, quorum, and bribe',
            body: [
              'vote commits locked GRAI toward liquidation quorum (auto-locking shortfall from wallet). You keep dividend eligibility on the lock, but you signal exit pressure and become a bribe target.',
              'Quorum is strict: totalVoted × 10_000 > totalSupply() × quorumBps (default 6_667 ≈ 66.67%). Exact equality is not enough. New deposits grow supply and dilute progress. Voters alone cannot open liquidation without !grinders.grinding().',
              'bribe buys voted GRAI for a bribeable listed asset at a dynamic premium/discount vs half-quorum (slope bribePremiumBps, default 2%). Fee-on-transfer bribe assets revert (exact credit required). Bribes are blocked in REDEMPTION. Pricing, tax, and exit posture can all go against you; a successful bribe shrinks the voter’s locked (and future dividend) share.',
            ],
          },
          {
            heading: 'Dividends, distribute, and claim',
            body: [
              'distribute splits received yield by dividendCutBps / treasuryCutBps (defaults 50/50). Those two cuts are fixed at initialize and cannot be changed via setConfig. If totalLocked is zero or the reserved dividend increment rounds to zero, value can divert to Treasury.',
              'Dividends are per listed asset and must be claimed — they do not auto-compound. Unclaimed amounts sit in assets.totalClaimable (excluded from redeem / revive baskets). Claims may continue in liquidation subject to claimable balances.',
              'claim / claimAll may take claimTipBps (default 1%, max 5%) to the caller and route Treasury revenueShareBps (default 5% of yield vs the dividend slice) into the referrer tree / beneficiar — both reduce what the locker receives. You may receive volatile or illiquid listed assets, not only what you deposited. Claims need a usable oracle path for that asset.',
            ],
          },
          {
            heading: 'Liquidation, redeem, and revive',
            body: [
              'liquidate requires hasQuorum() and !grinders.grinding(). If either fails, you cannot force a basket redeem and remain on secondary markets, unlock, or bribe.',
              'After open, liquidationPeriod (default 24h) must elapse before redeem. Redeem burns wallet and/or locked GRAI for a pro-rata share of redeemable balances (excluding claim reserves). Failed custodian consolidation can leave assets stuck off GRAI.',
              'Redeem timing, asset mix, and NAV at redeem can leave a basket worth far less than entry. Empty baskets, unpaid custodians, or assets stuck in adapters worsen losses.',
              'After liquidationPeriod + redeemPeriod (default +7 days), anyone may revive: leftovers return toward Grinders and GRINDING resumes. Revive does not fairly reprice leftover NAV; unclaimed reserves and supply dynamics can dilute. On liquidate, orphan GRAI on the contract (balanceOf(this) − totalLocked) may be scooped by the opener — do not assume penalties accrue to you.',
            ],
          },
        ],
      },
      {
        heading: 'Governance, upgrade, and parameter risk',
        body: [
          'EVM GRAI is UUPS-upgradeable and Ownable2Step. Owner controls feeds, listings, pauses, upgrades, and setConfig fields that remain patchable (revenueShare, claim tip, bribe premium, quorum, unlock penalty, liquidation/redeem periods, poach fee, mint premium, per-asset bribeable). Malicious, captured, or careless admin keys can pause deposits, replace oracles, change economics, or upgrade logic.',
          'Yield cut identities (dividendCutBps / treasuryCutBps) are immutable after initialize. Ownership renounce is disabled because feeds / config / UUPS require an owner — concentrating operational power versus fully immutable systems.',
          'Grinders and Treasury admin resolve to GRAI.owner() (with fallbacks). Custodian implementations are UUPS and owner-swappable by kind. Implementations on Solana and EVM can differ even when economically aligned.',
        ],
      },
      {
        heading: 'Smart contract, bridge, and infrastructure risk',
        body: [
          'Contracts may contain bugs or economic design flaws. Audits reduce but do not eliminate risk. Reentrancy guards and access controls can still fail under unforeseen composition with other protocols.',
          'Bridges, RPC endpoints, indexers, wallets, and frontends can fail, censor, or be compromised. Interface downtime does not pause on-chain risk.',
          'Composability (including custodian adapters that call external DeFi) can introduce cascading failures.',
        ],
      },
      {
        heading: 'Market, liquidity, and tokenomics risk beyond GRAI',
        body: [
          'Secondary markets for GRAI may be thin or nonexistent. Price discovery can be discontinuous relative to book.',
          'Affiliate / Treasury fee routing depends on claims, revenueShareBps, L1/L2 share arrays, beneficiar, and cashflow NFT ownership (including poach). Rates and payees can change with upgrades and owner knobs.',
        ],
      },
      {
        heading: 'Regulatory, tax, and interface risk',
        body: [
          'Digital-asset rules change. Access from your jurisdiction may be restricted. Deposits, dividends, unlocks, bribes, liquidations, poaches, and token sales can create taxable events; you alone are responsible for reporting.',
          'The Interface can display stale RPC data, incorrect previews, or UX bugs. Always confirm transactions in your wallet. Backtests may require payment and are educational only.',
        ],
      },
      {
        heading: 'No insurance',
        body: [
          'Assets used with the protocol are generally not covered by FDIC, SIPC, or similar deposit insurance or investor compensation schemes. There is no guaranteed bailout of GRAI holders, Grinders custodians, or Treasury affiliates.',
        ],
      },
    ],
  },
}

const LEGAL_SLUGS = ['privacy', 'terms', 'risk'] as const

export default function LegalPage() {
  const { pathname } = useLocation()
  const slug = pathname.replace(/^\//, '')
  if (!LEGAL_SLUGS.includes(slug as (typeof LEGAL_SLUGS)[number])) {
    return <Navigate to="/privacy" replace />
  }

  const doc = LEGAL_DOCS[slug]

  return (
    <article className="legal-page">
      <header className="legal-page-header">
        <p className="legal-page-kicker">Legal</p>
        <h1 className="legal-page-title">{doc.title}</h1>
        <p className="legal-page-updated">Last updated {doc.updated}</p>
      </header>

      <nav className="legal-page-toc" aria-label="Legal documents">
        {LEGAL_SLUGS.map((item) => (
          <Link
            key={item}
            to={`/${item}`}
            className={`legal-page-toc-link${item === slug ? ' is-current' : ''}`}
          >
            {LEGAL_DOCS[item].title}
          </Link>
        ))}
      </nav>

      <div className="legal-page-body">
        {doc.sections.map((section) => (
          <section key={section.heading} className="legal-page-section">
            <h2>{section.heading}</h2>
            {section.body?.map((paragraph) => (
              <p key={paragraph.slice(0, 48)}>{renderLegalText(paragraph)}</p>
            ))}
            {section.bullets && section.bullets.length > 0 ? (
              <ul className="legal-page-bullets">
                {section.bullets.map((item) => (
                  <li key={item.slice(0, 48)}>{renderLegalText(item)}</li>
                ))}
              </ul>
            ) : null}
            {section.after?.map((paragraph) => (
              <p key={paragraph.slice(0, 48)}>{renderLegalText(paragraph)}</p>
            ))}
            {section.subsections?.map((sub) => (
              <div key={sub.heading} className="legal-page-subsection">
                <h3>{sub.heading}</h3>
                {sub.body?.map((paragraph) => (
                  <p key={paragraph.slice(0, 48)}>{renderLegalText(paragraph)}</p>
                ))}
                {sub.bullets && sub.bullets.length > 0 ? (
                  <ul className="legal-page-bullets">
                    {sub.bullets.map((item) => (
                      <li key={item.slice(0, 48)}>{renderLegalText(item)}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </section>
        ))}
      </div>
    </article>
  )
}
