import { Link, Navigate, useLocation } from 'react-router-dom'
import './LegalPage.css'

type LegalSection = {
  heading: string
  body?: string[]
  bullets?: string[]
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
    updated: '1 October 2026',
    sections: [
      {
        heading: 'Introduction',
        body: [
          'This Privacy Policy (the “Policy”) explains how GrindURUS (“GrindURUS,” the “Company,” “we,” “us,” or “our”) collects, uses, and shares data in connection with the services offered on https://grindurus.xyz (including the marketing landing page and product surfaces such as /grai, /grs, /grinders, /affiliate, and /backtest), documentation at https://docs.grindurus.xyz, and other GrindURUS properties, products, and services that link to this Policy (the “Services”). Your use of the Services is also subject to our Terms of Service at https://grindurus.xyz/terms.',
          'Please note that your use of the GrindURUS on-chain protocol (smart contracts and programs deployed on public blockchains, including GRAI, GRS / OFT, Grinders, Treasury / affiliate routing, and related deployments) is not governed by this Privacy Policy. On-chain activity is public by design and is outside our control once confirmed on a network.',
        ],
      },
      {
        heading: 'High Level Summary',
        body: [
          'We do not seek to collect information that directly identifies individuals (such as legal name, street address, date of birth, or precise geolocation) for typical use of the Services. You do not need a traditional user account, password, or KYC to browse or connect a non-custodial wallet.',
          'We collect limited non-identifying or weakly identifying data such as public on-chain addresses and activity, device/browser technical data, and aggregated product analytics — to operate, secure, and improve the Services, not to build a marketing profile of you.',
          'If you contact us or voluntarily provide an email or other contact detail, we may store that information to respond. We do not require email to use a wallet with the Services.',
          'Paid backtests (for example via x402 USDC or promocode) may involve payment-related metadata processed by us or payment infrastructure.',
          'You remain responsible for client-side privacy tools (browser settings, wallet choices, VPN/proxy, and similar). Material changes to this Policy will be reflected in an updated version on this page.',
        ],
      },
      {
        heading: 'Data We Collect',
        body: [
          'Privacy and transparency matter to us. We aspire to be clear about the limited data we process. We generally do not maintain traditional user accounts and do not ask for your name as a condition of using the Services. When you interact with the Services, we may collect or process:',
          'Publicly available blockchain data. When you connect a non-custodial wallet, we may read and log publicly available blockchain addresses and related on-chain data to provide product features (balances, positions, sales, vesting, affiliate state, and similar), understand usage of the Services, and, where applicable, screen for illicit activity using blockchain analytics intelligence. Blockchain addresses are public data not created by us and, by themselves, are not personal names.',
          'Wallet connection and transaction metadata. Interface sessions may involve wallet connection events and the payloads you authorize for signing. We do not receive your private keys or seed phrases, and we cannot move assets from your wallet without your signature.',
          'Technical and device data; localStorage and similar technologies. We and certain third-party providers may access information from cookies, localStorage, device or browser identifiers, and similar technologies to provide and personalize the Services across sessions (for example theme preference, UI state, or remembered selections). This may include browser type, referring/exit pages, operating system, language, and related device information. We may analyze journeys in aggregate to improve UX.',
          'Analytics. The Services may use analytics tooling (including third-party scripts loaded on https://grindurus.xyz, such as Google Analytics and similar product analytics) to understand traffic and feature usage.',
          'Information from other sources. We may receive information about wallet addresses or transactions from service providers (RPC nodes, indexers, explorers, bridge/messaging infrastructure, blockchain analytics) to operate the Services, comply with legal obligations, and help prevent fraud or illicit use.',
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
          'Provide the Services — operate, maintain, customize, and improve Interfaces for GRAI, GRS, Grinders, affiliates, backtests, and related features.',
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
          'With service providers. Vendors that help us deliver and improve the Services — for example RPC and infrastructure providers, CDNs, analytics providers, wallet connection tooling, bridge/messaging providers, blockchain analytics, and payment processors for paid backtests.',
          'To comply with legal obligations. In litigation, regulatory proceedings, compliance measures, or when compelled by subpoena, court order, or other legal process; and when we believe disclosure is necessary to prevent harm or to enforce our Terms of Service and policies.',
          'Safety and security. To investigate and stop fraud, unauthorized access, or illegal activity, and to address security incidents.',
          'Business changes. In connection with a merger, acquisition, financing, bankruptcy, reorganization, asset sale, or similar transaction.',
          'With your consent. Any other time you ask us to share information or clearly consent to sharing.',
          'We do not sell your personal information for money, and we do not share information with third parties for their own marketing purposes.',
        ],
      },
      {
        heading: 'Third-Party Cookies and Analytics',
        body: [
          'We use services provided by Google and other third parties that rely on cookies, device identifiers, localStorage, and similar technologies to collect information about your use of the Services. You can limit this, including by:',
          'Blocking or deleting cookies in your browser settings (see resources such as https://www.allaboutcookies.org).',
          'Using privacy-focused browsers, extensions, or tracking protection features.',
          'Using Google’s ad settings tools at https://adssettings.google.com and reviewing Google’s privacy policy at https://policies.google.com/privacy.',
          'Using industry opt-out tools where available (for example http://optout.aboutads.info and http://optout.networkadvertising.org) on each browser or device you use.',
        ],
      },
      {
        heading: 'Third-Party Links and Sites',
        body: [
          'The Services may integrate or link to technologies and sites operated by others (documentation hosts, explorers, wallets, social networks, GitHub, bridges, and similar). When you leave the Services or interact with those parties, they may collect information under their own privacy policies. This Policy does not control those parties.',
        ],
      },
      {
        heading: 'Security',
        body: [
          'We implement and maintain reasonable administrative, physical, and technical safeguards designed to help protect data from loss, theft, misuse, and unauthorized access. Transmission over the internet is never completely secure, and we cannot guarantee absolute security.',
          'You are responsible for your activity on the Services and for the security of your wallets, addresses, devices, and cryptographic keys. Never share seed phrases or private keys with anyone, including anyone purporting to represent GrindURUS.',
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
          'Blockchain limitation. We cannot edit or delete information stored on public blockchains (including wallet addresses and confirmed transactions).',
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
    updated: '1 October 2026',
    sections: [
      {
        heading: 'Agreement',
        body: [
          'These Terms of Service (the “Agreement”) explain the terms and conditions by which you may access and use the products and interfaces provided by GrindURUS (“GrindURUS,” “we,” “our,” or “us”).',
          'The Products include, without limitation: (a) the website at https://grindurus.xyz, including the marketing landing page and product surfaces such as /grai, /grs, /grinders, /affiliate, and /backtest (together, the “Interface” or “App”); (b) documentation at https://docs.grindurus.xyz; and (c) any other GrindURUS products or services that link to this Agreement (together, the “Products”). There is no separate app subdomain — the canonical product site is https://grindurus.xyz.',
          'You must read this Agreement carefully. By accessing or using any of the Products, you signify that you have read, understand, and agree to be bound by this Agreement in its entirety. If you do not agree, you are not authorized to access or use any of our Products.',
          'To access or use any of our Products, you must be able to form a legally binding contract with us. You represent that you are at least the age of majority in your jurisdiction and have full right, power, and authority to enter into and comply with this Agreement on behalf of yourself and any entity for which you may access the Products. If you enter into this Agreement on behalf of an entity, you represent that you have authority to bind that entity.',
          'You further represent that you are not (a) the subject of economic or trade sanctions administered or enforced by any governmental authority or otherwise designated on any list of prohibited or restricted parties, or (b) a citizen, resident, or organized in a jurisdiction or territory that is the subject of comprehensive country-wide, territory-wide, or regional economic sanctions by the United States or other applicable authorities. You represent that your access and use of the Products will fully comply with all applicable laws and regulations, and that you will not use the Products to conduct, promote, or facilitate any illegal activity.',
          'NOTICE: This Agreement contains important information, including disclaimers, liability limits, and dispute-related provisions that affect your rights. The Products are available to you only if you agree completely with these terms.',
        ],
      },
      {
        heading: '1. Our Products',
        body: [
          '1.1 The Interface. GrindURUS is an automated market-taking protocol that turns crypto price volatility into yield through dual-sided buy-low/sell-high and sell-high/buy-low strategies. The Interface at https://grindurus.xyz provides a web-based means of access to GrindURUS smart contracts and programs on public blockchains (including EVM networks and Solana) and related tools. Through the Interface you may, among other things: explore the landing overview; deposit into and interact with GRAI; lock and claim dividends; manage Grinders / custodian allocations where available; interact with GRS (including sales, bridging, grants, and vesting views); use affiliates / referral surfaces; and run strategy backtests.',
          'The Interface is distinct from the on-chain protocol. The protocol comprises open-source or source-available smart contracts and programs (including GRAI, GRS / OFT, Grinders, Treasury / affiliate routing, and related contracts) deployed on public networks. The Interface is one, but not the exclusive, means of accessing those contracts. By using the Interface, you understand that you are interacting with public blockchains and autonomous contracts — not buying or selling digital assets from us as a counterparty in the ordinary course, and not receiving custody services from us.',
          'Networks, listed assets, deployments, and tokenomics may change, including while the project is pre-mainnet or before TGE. Always verify current details against https://docs.grindurus.xyz and on-chain state.',
          'To access on-chain features of the Interface, you must use non-custodial wallet software. Your relationship with any third-party wallet provider is governed by that provider’s terms. We do not have custody or control over the contents of your wallet and have no ability to retrieve or transfer its contents. By connecting your wallet to the Interface, you agree to be bound by this Agreement.',
          '1.2 GRAI. GRAI (Grinders Artificial Index) is an elastic, dollar book-priced fund share. It is not a directional prediction product: yield is framed as harvesting realized volatility via Grinders custodians, not forecasting price. Deposits, locks, votes, dividends, unlocks, and post-quorum liquidation / redeem flows (where enabled) are executed by smart contracts according to their code and parameters.',
          'Unlocked wallet GRAI earns nothing. Only locked, unvoted GRAI is eligible for asset dividends after profit is reported via distribute (or equivalent). While the fund is live there is generally no protocol redeem of the full basket; exit paths include secondary markets, unlock (subject to penalties and rules), or post-quorum liquidation redeem where available. Book values, cuts, penalties, and metrics shown in the Interface are informational and may change.',
          '1.3 GRS. GRS is a fixed-supply protocol equity / governance token with a maximum genesis supply of 1,000,000,000. It is not the fund share. The Interface may show a published cap table, Token sale / Initial DEX Offerings / other listing plans, vesting, grants, and cross-chain OFT bridging. Soft policy sizes in the App (for example Sales and IDO slices) are planning displays; on-chain TokenSales rules are defined by the contracts. Participation in any sale, IDO, grant, vest, or bridge is at your own risk.',
          '1.4 Grinders and custodians. Grinders / custodian NFTs and related allocation flows connect fund capital to trading wallets and strategy infrastructure (including off-chain adapters and operators). Off-chain trading is not the Interface. Yield reported via distribute and similar flows depends on reported profit and contract logic; past or simulated performance is not a guarantee.',
          '1.5 Affiliates. Affiliate / referral features (including ref links tied to wallet addresses and revenue-share accounting on claims) are subject to on-chain Treasury / affiliate rules and the Interface surfaces at /affiliate. We may change eligibility, rates, or presentation consistent with contract upgrades and this Agreement.',
          '1.6 Backtest and educational tools. Backtests on /backtest, calculators, charts, and strategy previews are informational and educational only. They are not offers, solicitations, or promises of future returns. Access to backtests may require payment (for example x402 USDC) or a promocode and is not a free public data scrape API.',
          '1.7 Other Products. We may offer additional products from time to time; such products are “Products” under this Agreement whether or not specifically named here.',
          '1.8 Third-Party Services and Content. The Products may integrate or link to third-party services (RPC providers, wallets, bridges, explorers, oracles, analytics, documentation hosts, social sites, and similar). Your use of Third-Party Services may be subject to separate terms and privacy policies. We enable them for convenience and do not endorse or assume responsibility for them. Dealings with third parties are solely between you and them.',
        ],
      },
      {
        heading: '2. Modifications',
        body: [
          '2.1 Modifications of this Agreement. We may modify this Agreement from time to time. If we make material modifications, we will update the date at the top of this page and maintain a current version at https://grindurus.xyz/terms. Modifications are effective when posted. Continued access or use of any Products after posting constitutes acceptance. If you do not agree, you must stop using the Products.',
          '2.2 Modifications of our Products. We reserve the right, with or without notice: (a) to modify, substitute, eliminate, or add to any Products; and (b) to review, filter, disable, delete, or remove content and information from the Products. Smart contracts on public networks may remain accessible through other tools even if the Interface changes.',
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
          '4.2 Unsolicited transactions. All transactions you submit through the Products are unsolicited and initiated solely by you. You have not received investment advice from us in connection with any transaction, and we do not conduct suitability reviews.',
          '4.3 Non-custodial; no fiduciary duties. The Products are non-custodial applications: we do not take custody, possession, or control of your digital assets. You are solely responsible for your wallets, private keys, and seed phrases. Never share credentials with anyone. We accept no liability for wallet compromise or for how any Product interacts with a specific wallet.',
          'This Agreement does not create fiduciary duties. To the fullest extent permitted by law, any fiduciary duties that might otherwise exist are irrevocably disclaimed and waived. Our only duties to you are those expressly set out in this Agreement.',
          '4.4 Compliance and taxes. Availability of a Product or asset does not mean it is lawful or appropriate for you. You are solely responsible for complying with all laws that apply to you (including sanctions, securities, commodities, and tax rules) and for any transfer or trading restrictions. You are responsible for determining and remitting any taxes arising from your activity.',
          '4.5 Gas and network fees. Blockchain transactions require network fees. Except as we expressly state otherwise, you are solely responsible for fees for transactions you initiate, including LayerZero or bridge fees where applicable, and any fees charged for paid backtests.',
          '4.6 Release. You assume all risks of accessing and using the Products. To the fullest extent permitted by law, you waive and release us from liability, claims, and damages arising from or relating to your use of the Products.',
        ],
      },
      {
        heading: '5. Disclaimers',
        body: [
          '5.1 Assumption of risk. BY ACCESSING AND USING THE PRODUCTS, YOU REPRESENT THAT YOU UNDERSTAND THE INHERENT RISKS OF CRYPTOGRAPHIC AND BLOCKCHAIN SYSTEMS AND DIGITAL ASSETS. Markets are nascent and volatile. Smart contract transactions execute and settle automatically and are generally irreversible when confirmed. Network costs and speeds vary. Bridged or wrapped assets differ from native assets. Strategy, custodian, lock/unlock, liquidation, vesting, sale, IDO, and bridge mechanisms can result in partial or total loss.',
          'YOU ACKNOWLEDGE THAT WE DO NOT CONTROL PUBLIC BLOCKCHAINS OR THIRD-PARTY INFRASTRUCTURE, AND THAT YOU ASSUME FULL RESPONSIBILITY FOR RISKS OF USING THE INTERFACE TO INTERACT WITH THE PROTOCOL.',
          '5.2 No warranties. THE PRODUCTS AND THIRD-PARTY SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS, IMPLIED, OR STATUTORY, INCLUDING MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. WE DO NOT WARRANT UNINTERRUPTED, SECURE, OR ERROR-FREE ACCESS; ACCURATE OR COMPLETE INFORMATION; OR FREEDOM FROM HARMFUL CODE. NO STATEMENT WE MAKE CREATES A WARRANTY.',
          'PROTOCOL CONTRACTS AND PROGRAMS ARE LIKEWISE PROVIDED AT YOUR OWN RISK. WE DO NOT GUARANTEE BOOK PRICES, DIVIDENDS, SALE CLEARING, LIQUIDITY, BRIDGE SUCCESS, MAINNET TIMING, OR CONTINUED AVAILABILITY OF ANY FEATURE.',
          '5.3 No investment advice. Informational materials in the Products (including landing copy, tokenomics, cap tables, APY-like or yield figures, backtests, FDV or price displays, and docs) are for information only and are not investment, legal, tax, or accounting advice and are not a recommendation or solicitation. You alone decide whether any transaction is appropriate for your circumstances and risk tolerance.',
        ],
      },
      {
        heading: '6. Indemnification',
        body: [
          'You agree to hold harmless, defend, and indemnify GrindURUS and our affiliates, and our and their respective officers, directors, employees, contractors, agents, licensors, and representatives (the “GrindURUS Parties”) from and against claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys’ fees) arising from or relating to: (a) your access or use of the Products or Third-Party Services; (b) your violation of this Agreement, third-party rights, or applicable law; (c) any other party’s access or use of the Products using your assistance or a device or account you control; and (d) disputes between you and other users or your own customers. We may assume exclusive defense of any indemnified matter; you will cooperate reasonably. You may not settle a claim against a GrindURUS Party without our written consent.',
        ],
      },
      {
        heading: '7. Limitation of Liability',
        body: [
          'TO THE FULLEST EXTENT PERMITTED BY LAW, WE AND THE GRINDURUS PARTIES WILL NOT BE LIABLE FOR ANY INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES, INCLUDING LOSS OF PROFITS, GOODWILL, DATA, DIGITAL ASSETS, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATING TO ACCESS TO, USE OF, OR INABILITY TO USE THE PRODUCTS OR THIRD-PARTY SERVICES — WHETHER BASED IN CONTRACT, TORT, NEGLIGENCE, STRICT LIABILITY, OR OTHERWISE — EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.',
          'WITHOUT LIMITING THE FOREGOING, WE ASSUME NO LIABILITY FOR: (A) ERRORS OR INACCURACIES OF CONTENT; (B) UNAUTHORIZED ACCESS TO SERVERS OR DATA; (C) INTERRUPTION OF THE PRODUCTS; (D) BUGS OR MALWARE; (E) LOSS FROM ON-CHAIN PAYMENTS OR TRANSACTIONS YOU INITIATE; OR (F) THIRD-PARTY CONDUCT OR SERVICES.',
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
          '9.1 Entire agreement. This Agreement is the entire agreement between you and us regarding the Products and supersedes prior written or oral understandings on that subject.',
          '9.2 Assignment. You may not assign this Agreement without our prior written consent. We may assign this Agreement. Subject to that, this Agreement binds successors and permitted assigns.',
          '9.3 Not a registered exchange or broker. We are not registered with the U.S. Securities and Exchange Commission or any other agency as a national securities exchange, broker, dealer, or similar. We do not broker orders on your behalf. Settlement of on-chain transactions occurs on public networks according to smart contracts you invoke.',
          '9.4 No deposit insurance. Assets used with the protocol are generally not covered by FDIC, SIPC, or similar insurance or investor compensation schemes.',
          '9.5 Notices. We may provide notices by commercially reasonable means, including posting on https://grindurus.xyz, https://docs.grindurus.xyz, or public channels. Notices are effective upon posting.',
          '9.6 Severability. If any provision is held invalid or unenforceable, it will be modified to the minimum extent necessary to achieve its purpose, and the remaining provisions will continue in effect.',
          '9.7 Privacy and risk. Our Privacy Policy at https://grindurus.xyz/privacy describes how we process information in connection with the Products. Our Risk Disclosure at https://grindurus.xyz/risk summarizes material risks and is incorporated by reference for convenience; it does not limit the disclaimers in this Agreement.',
        ],
      },
    ],
  },
  risk: {
    title: 'Risk Disclosure',
    updated: '1 October 2026',
    sections: [
      {
        heading: 'General',
        body: [
          'Using GrindURUS involves substantial risk of loss. You can lose some or all of the digital assets you deploy. Only use funds you can afford to lose.',
          'This Risk Disclosure summarizes material risks of the GrindURUS Interfaces at https://grindurus.xyz and of the on-chain GRAI mechanics implemented in grindurus-evm (and related Solana programs). It does not replace the Terms of Service, the Privacy Policy, or the smart-contract code. Product parameters, networks, and deployments may change — including before mainnet or TGE — and on-chain config can be updated by the contract owner within coded limits. Always verify current docs at https://docs.grindurus.xyz and live contract state.',
          'Nothing here is investment, legal, tax, or accounting advice. Past or simulated performance (including /backtest) is not a guarantee of future results.',
        ],
      },
      {
        heading: 'Custodian and strategy risk (Grinders)',
        body: [
          'Deposited assets are forwarded to Grinders and may be allocated to custodian wallets that trade via adapters (on-chain venues, solvers, bridges, and optionally CEX where configured). Off-chain execution, custody of trading keys, venue risk, counterparty risk, and operational error are outside the Interface and can impair or wipe fund NAV.',
          'Reported yield depends on permissionless or operator-driven distribute calls that credit on-chain inventory. Delayed, incorrect, or zero reported profit means lockers may receive little or no dividend for long periods even if markets moved.',
          'Grinders heartbeat / grindingPeriod logic gates liquidation. Active operational heartbeats can prevent liquidation even when many holders want to exit. Conversely, stale heartbeat plus quorum can open liquidation when you did not expect it.',
        ],
      },
      {
        heading: 'What GRAI is (and is not)',
        body: [
          'GRAI (Grinders Artificial Index) is an elastic, non-rebasing fund-share token. On EVM it uses 6 decimals. New deposits mint GRAI at book value: roughly depositUsd × totalSupply / totalValue (with first-deposit 1:1 USD book semantics when totalValue is zero). Assets move to Grinders reserve; GRAI represents a claim on the fund’s accounting, not a promise of dollar peg, stablecoin redemption, or instant withdraw.',
          'GRAI is not GRS. GRS is fixed-supply protocol equity (1,000,000,000 genesis max). GRAI is not a directional prediction market. Yield is framed as harvesting realized volatility through Grinders custodians — that process can still lose money.',
          'While the fund is in the normal GRINDING regime there is generally no live protocol redeem of the basket. Primary exits are secondary-market sales of GRAI, unlock (with penalty), bribe mechanics for voted GRAI, or the liquidation → redeem path described below.',
        ],
      },
      {
        heading: 'GRAI risks',
        subsections: [
          {
            heading: 'Deposit, book price, and oracle risk',
            body: [
              'Deposits only work for owner-listed assets with live oracle feeds (Chainlink, Pyth, or custom views). If a feed is paused, missing, stale, manipulated, or wrong, mint sizing and book NAV can be wrong. Paused feeds block deposit; they do not necessarily stop claim or distribute.',
              'Mint uses the amount actually received (fee-on-transfer assets can mint less than you expect). Native and ERC-20 paths differ; wrapping / settlement asset rules apply on EVM.',
              'totalValue and oracle USD prices are accounting constructs. They can diverge from secondary-market GRAI prices. You may buy or sell GRAI at a premium or discount to book.',
              'First-deposit referrer binding in Treasury is permanent for that locker. Choosing or omitting a referrer affects affiliate routing on later claims; it does not create a guaranteed rebate.',
            ],
          },
          {
            heading: 'Lock, unlock, and dead GRAI',
            body: [
              'Wallet (unlocked) GRAI earns no dividends. Only locked, unvoted GRAI is in the dividend base (eligible ≈ totalLocked − totalVoted).',
              'unlock takes a flat penalty (default 1%, capped in code). The penalty stays on-contract as dead inventory — not rebated to you or Treasury. Repeated lock/unlock permanently destroys share value for the unlocking party.',
              'While penalty > 0, tiny unlocks can revert on an intentional dust floor (including unlocking an entire escrow still below the floor). Dust can stick until you top up, governance sets penalty to 0, or you redeem in liquidation.',
              'New locks sync dividend debt so you cannot claim past index; misunderstanding this can mean zero claims right after locking.',
            ],
          },
          {
            heading: 'Vote, quorum, and bribe',
            body: [
              'vote commits locked GRAI toward liquidation quorum (auto-locking from wallet if needed). Voted GRAI leaves the dividend base: you trade yield for exit pressure.',
              'Quorum is strict: totalVoted × 10_000 > totalSupply × quorumBps (default 6_667 / 66.67%). New deposits dilute progress. Voters alone cannot open liquidation without a stale Grinders heartbeat.',
              'Bribe buys voted GRAI for settlementAsset at a dynamic premium/discount versus half-quorum and can be blocked during liquidation. Pricing, exit posture, and tax treatment can all go against you.',
            ],
          },
          {
            heading: 'Dividends, distribute, and claim',
            body: [
              'distribute splits yield by config cuts (defaults: 50% to lockers, 50% to Treasury; must sum to 100% BPS). Owner can retune within validation. With no eligible unvoted locked base, or if index increments round to zero, value can divert to Treasury.',
              'Dividends are per listed asset and must be claimed — they do not auto-compound. Unclaimed amounts sit in claim reserves; claims during liquidation may be capped by totalClaimable.',
              'claim / claimAll may tip (default claimTipBps 1%) and route affiliate revenueShare (default 5% of yield against cuts) when a referrer tree exists — both reduce what the locker receives. You may receive volatile or illiquid listed assets, not only what you deposited.',
            ],
          },
          {
            heading: 'Liquidation, redeem, and revive',
            body: [
              'Liquidation needs both vote quorum and a stale Grinders heartbeat (!grinding). If either fails, you cannot force a basket redeem and stay on secondary markets or unlock.',
              'After liquidate, a consolidation window (default liquidationPeriod 24h) runs before redeem. Redeem burns wallet and/or locked GRAI for a pro-rata share of redeemable balances (excluding claim reserves). Failed custodian hard sweeps can roll back the regime change.',
              'Redeem timing, asset mix, and NAV at redeem can leave a basket worth far less than entry. Empty baskets, unpaid custodians, or assets stuck off-contract worsen losses.',
              'After liquidationPeriod + redeemPeriod (default +7 days), anyone may revive: leftovers return toward Grinders and GRINDING resumes. Revive does not fairly reprice leftover NAV; dead GRAI, unclaimed reserves, and supply dynamics can leave dilution. The opener may scoop dead inventory — do not assume penalties accrue to you.',
            ],
          },
        ],
      },
      {
        heading: 'Governance, upgrade, and parameter risk',
        body: [
          'EVM GRAI is UUPS-upgradeable and Ownable2Step. Owner controls feeds, listings, pauses, and config within _requireValidConfig limits (including cut identities, quorum, bribe premium, unlock penalty caps, and periods). Malicious, captured, or careless admin keys can pause deposits, replace oracles, change economics, or upgrade logic.',
          'Ownership renounce is disabled because feeds/config/UUPS require an owner. That concentrates operational power relative to fully immutable systems.',
          'Implementations on Solana and EVM can differ in packaging and operational detail even when economically aligned. Cross-chain assumptions can be wrong.',
        ],
      },
      {
        heading: 'Smart contract, bridge, and infrastructure risk',
        body: [
          'Contracts may contain bugs or economic design flaws. Audits reduce but do not eliminate risk. Reentrancy guards and access controls can still fail under unforeseen composition.',
          'Bridges (including OFT / LayerZero paths used elsewhere in the stack), RPC endpoints, indexers, wallets, and frontends can fail, censor, or be compromised. Interface downtime does not pause on-chain risk.',
          'Composability with other protocols can introduce cascading failures.',
        ],
      },
      {
        heading: 'Market, liquidity, and tokenomics risk beyond GRAI',
        body: [
          'Secondary markets for GRAI or GRS may be thin or nonexistent. Price discovery can be discontinuous.',
          'GRS sales, IDOs, vesting, grants, and bridges have separate liquidity, unlock, and bridge risks. Soft cap-table displays in the App are planning figures, not guarantees of listing, raise size, or clearing price.',
          'Affiliate / Treasury fee routing depends on claims and tree state; rates and eligibility can change with upgrades and config.',
        ],
      },
      {
        heading: 'Regulatory, tax, and interface risk',
        body: [
          'Digital-asset rules change. Access from your jurisdiction may be restricted. Deposits, dividends, unlocks, bribes, liquidations, and token sales can create taxable events; you alone are responsible for reporting.',
          'The Interface can display stale RPC data, incorrect previews, or UX bugs. Always confirm transactions in your wallet. Backtests may require payment and are educational only.',
        ],
      },
      {
        heading: 'No insurance',
        body: [
          'Assets used with the protocol are generally not covered by FDIC, SIPC, or similar deposit insurance or investor compensation schemes. There is no guaranteed bailout of GRAI holders, Grinders custodians, or GRS holders.',
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
              <p key={paragraph.slice(0, 48)}>{paragraph}</p>
            ))}
            {section.bullets && section.bullets.length > 0 ? (
              <ul className="legal-page-bullets">
                {section.bullets.map((item) => (
                  <li key={item.slice(0, 48)}>{item}</li>
                ))}
              </ul>
            ) : null}
            {section.subsections?.map((sub) => (
              <div key={sub.heading} className="legal-page-subsection">
                <h3>{sub.heading}</h3>
                {sub.body?.map((paragraph) => (
                  <p key={paragraph.slice(0, 48)}>{paragraph}</p>
                ))}
                {sub.bullets && sub.bullets.length > 0 ? (
                  <ul className="legal-page-bullets">
                    {sub.bullets.map((item) => (
                      <li key={item.slice(0, 48)}>{item}</li>
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
