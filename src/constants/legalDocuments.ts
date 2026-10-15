/**
 * The Terms of Service and Privacy Policy, as plain data.
 *
 * One copy of the text for every surface that shows it: the portal's /terms
 * and /privacy pages render it here, and the Customer App renders the same
 * file from its own src/constants/legalDocuments.ts. The two files must stay
 * identical; change both together and move LEGAL_EFFECTIVE_DATE when the
 * wording changes, so a reader can tell which version they agreed to.
 *
 * Kept free of JSX and HTML so React (web) and React Native (app) can both
 * render it. A block's optional `lead` is shown bold in front of its text.
 *
 * Every factual claim here was checked against the system on 2026-10-15
 * (what the server stores, which providers it calls, where it is hosted, what
 * the app asks the phone for). When a practice changes, change the text: a
 * privacy notice that describes a system that no longer exists is worse than
 * a short one.
 */

export type LegalBlock =
  | { kind: "paragraph"; text: string; lead?: string }
  | { kind: "list"; items: Array<{ text: string; lead?: string }> }
  | { kind: "note"; text: string; lead?: string };

export interface LegalSection {
  id: string;
  title: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  id: "terms" | "privacy";
  title: string;
  /** One or two sentences shown under the title. */
  summary: string;
  sections: LegalSection[];
}

export const LEGAL_EFFECTIVE_DATE = "October 15, 2026";

export const LEGAL_CONTACT = {
  organization: "Sugo Express",
  location: "Tacurong City, Sultan Kudarat, Philippines 9800",
  email: "aljayveeversola@gmail.com",
  portal: "https://portal.sugo-express.org",
} as const;

export const TERMS_OF_SERVICE: LegalDocument = {
  id: "terms",
  title: "Terms of Service",
  summary:
    "The rules for using Sugo Express: what we do, what you agree to when you order an errand, how fees and payments work, and what happens when something goes wrong.",
  sections: [
    {
      id: "about",
      title: "About these Terms",
      blocks: [
        {
          kind: "paragraph",
          text: "These Terms are an agreement between you and Sugo Express, an errand and delivery service based in Tacurong City, Sultan Kudarat. They apply when you use the Sugo Express Customer App, the Rider App or the web portal at portal.sugo-express.org.",
        },
        {
          kind: "paragraph",
          text: "By creating an account, signing in or placing an errand, you agree to these Terms and confirm that you have read our Privacy Policy, which explains how we handle your personal data. If you do not agree, please do not use the service.",
        },
        {
          kind: "paragraph",
          text: "Riders and dispatchers who use our staff tools also follow these Terms, together with their separate arrangements with Sugo Express.",
        },
      ],
    },
    {
      id: "service",
      title: "What Sugo Express does",
      blocks: [
        {
          kind: "paragraph",
          text: "Sugo Express runs pabili (buy-for-me) errands and deliveries. You tell us what to buy and where to deliver it. A dispatcher reviews your request, a verified rider buys the items, and the rider brings them to you.",
        },
        {
          kind: "list",
          items: [
            {
              lead: "Service area.",
              text: "We deliver within Tacurong City, covering all 20 barangays. We may decline a request outside this area or when no rider is available.",
            },
            {
              lead: "We buy on your behalf.",
              text: "Sugo Express pays the store for your items first, and you pay us back on delivery or by transfer. The store, not Sugo Express, is the seller of the goods and remains responsible for their quality, safety and warranty.",
            },
            {
              lead: "Services we do not offer.",
              text: "Riders cannot pay bills, make bank or remittance (padala) transactions, or handle school transactions for you.",
            },
          ],
        },
      ],
    },
    {
      id: "account",
      title: "Your account",
      blocks: [
        {
          kind: "list",
          items: [
            {
              lead: "Accurate details.",
              text: "Give your real name, a mobile number you own and a working email address, and keep them up to date. We verify your number with a one-time code and may verify your email the same way.",
            },
            {
              lead: "Age.",
              text: "You must be at least 18 years old, or use Sugo Express with the permission and supervision of a parent or guardian.",
            },
            {
              lead: "One person, one account.",
              text: "Do not share your account or create accounts to get around a restriction.",
            },
            {
              lead: "Keep it secure.",
              text: "You are responsible for activity on your account. Keep your password private, and tell us right away if you think someone else has used it.",
            },
            {
              lead: "Signing in with Google.",
              text: "If you use Google Sign-In, Google's own terms also apply to that sign-in.",
            },
          ],
        },
      ],
    },
    {
      id: "ordering",
      title: "Placing an errand",
      blocks: [
        {
          kind: "list",
          items: [
            {
              lead: "Describe items clearly.",
              text: "Include the brand, size, quantity and any instructions. We buy what your list says, so a vague item may be bought differently from what you had in mind.",
            },
            {
              lead: "Review by a dispatcher.",
              text: "Every request is reviewed before a rider is assigned. Your dispatcher may message you to clarify items or stores, or decline the request with a reason you can see in the app.",
            },
            {
              lead: "Prices are estimates until bought.",
              text: "Item prices you enter or see before purchase are estimates. The item amount you pay is what the store's receipt shows. Riders photograph receipts so you can check them.",
            },
            {
              lead: "Stay reachable.",
              text: "While your errand is in progress, please keep notifications on and answer messages from your dispatcher or rider, so that unavailable items, substitutions and price changes can be checked with you.",
            },
          ],
        },
      ],
    },
    {
      id: "fees",
      title: "Fees",
      blocks: [
        {
          kind: "paragraph",
          text: "The amount you pay is the cost of your items, as shown on the store receipts, plus our service fees. Depending on your errand, the fees can include:",
        },
        {
          kind: "list",
          items: [
            { lead: "Base delivery fee.", text: "The starting fee for every errand." },
            { lead: "Distance fee.", text: "Based on the road distance from the stores to your delivery pin." },
            { lead: "Multi-store fee.", text: "When your errand needs more than one store." },
            { lead: "Shopping service fee.", text: "For larger shopping errands, based on the value and number of items." },
            { lead: "Online payment fee.", text: "When you pay by e-wallet or bank transfer instead of cash." },
          ],
        },
        {
          kind: "paragraph",
          text: "The app shows an estimated total first. The distance fee is added once your dispatcher confirms the stores, and the total becomes final once the items are bought. We may change our fee amounts in the future; the fees shown for your errand are the ones that apply to it.",
        },
      ],
    },
    {
      id: "payment",
      title: "Payment",
      blocks: [
        {
          kind: "list",
          items: [
            {
              lead: "Payment methods.",
              text: "You can pay by cash on delivery, GCash or Maya, or bank transfer. Card payments are not available.",
            },
            {
              lead: "Transfers.",
              text: "Send the exact amount to the account shown in the app and upload a clear screenshot of the confirmation. We read the reference number, amount and date from the image, and a payment counts only once it is confirmed. A rider may also photograph a transfer confirmation at your door.",
            },
            {
              lead: "Honest proof only.",
              text: "Editing, reusing or faking a payment screenshot is fraud. It leads to suspension and may be reported to the authorities.",
            },
            {
              lead: "Pay in full.",
              text: "Please settle the full total when your items arrive. An unpaid balance may restrict your account until it is settled.",
            },
          ],
        },
      ],
    },
    {
      id: "cancellations",
      title: "Cancellations and refunds",
      blocks: [
        {
          kind: "list",
          items: [
            {
              lead: "Before anything is bought.",
              text: "Ask your dispatcher, for example through the in-app chat. If the rider has not bought any items yet, the errand can be cancelled without charge.",
            },
            {
              lead: "After items are bought.",
              text: "We have already paid the store, so you may be asked to pay for the items bought and the fees already incurred. The items remain yours.",
            },
            {
              lead: "When we cancel.",
              text: "We may decline or cancel an errand, for example when items are unavailable, the address is outside our service area, no rider is available, or a rider's safety is at risk. You will see the reason in the app.",
            },
            {
              lead: "Refunds.",
              text: "If you paid by transfer and the errand is cancelled, we refund the amount for items not bought and fees not incurred as soon as reasonably possible.",
            },
          ],
        },
      ],
    },
    {
      id: "delivery",
      title: "Delivery",
      blocks: [
        {
          kind: "list",
          items: [
            {
              lead: "Be at your pin.",
              text: "Make sure your delivery pin, landmark and notes are correct, and be available to receive the items. You can follow your rider's location live in the app while the errand is active.",
            },
            {
              lead: "Check your items.",
              text: "Please check your items and receipts when they arrive. Report a missing, wrong or damaged item through the app as soon as you can, preferably before the rider leaves.",
            },
            {
              lead: "If we cannot reach you.",
              text: "If the rider cannot deliver because you cannot be reached or the location is wrong, you may still be asked to pay for items bought and fees incurred.",
            },
          ],
        },
      ],
    },
    {
      id: "conduct",
      title: "Prohibited items and conduct",
      blocks: [
        {
          kind: "note",
          lead: "Never order:",
          text: "illegal drugs, firearms, ammunition, explosives, hazardous chemicals, stolen or counterfeit goods, protected wildlife, or anything else the laws of the Philippines prohibit. Medicines that need a prescription are bought only against a valid prescription you provide. Riders will not buy alcohol or tobacco for anyone under 18.",
        },
        {
          kind: "paragraph",
          text: "You also agree not to harass, threaten or abuse riders, dispatchers or store staff; not to place fake errands; not to misuse chat or ratings; and not to interfere with, copy or reverse-engineer the apps or overload our systems.",
        },
      ],
    },
    {
      id: "suspension",
      title: "Suspension and closing your account",
      blocks: [
        {
          kind: "paragraph",
          text: "We may restrict, suspend or close an account that breaks these Terms, leaves balances unpaid, submits false payment proof, abuses staff, or puts the security of the service at risk. Where it is safe to do so, we will tell you why.",
        },
        {
          kind: "paragraph",
          text: "You may stop using Sugo Express at any time. To close your account and have your personal data deleted, email us from the address on your account. Our Privacy Policy explains what we must keep.",
        },
      ],
    },
    {
      id: "liability",
      title: "Our responsibility to you",
      blocks: [
        {
          kind: "paragraph",
          text: "We work to deliver quickly and accurately, but we are not responsible for delays or failures caused by things outside our reasonable control, such as weather, traffic, road closures, store stock, power or network outages, or events of force majeure.",
        },
        {
          kind: "paragraph",
          text: "To the extent the law allows, our liability for any errand is limited to the total you paid for that errand. Nothing in these Terms limits your rights under the Consumer Act of the Philippines (Republic Act No. 7394) or any other law that protects you.",
        },
        {
          kind: "paragraph",
          text: "The apps, their design and their content belong to Sugo Express. You may use them for your own errands and for no other purpose.",
        },
      ],
    },
    {
      id: "changes",
      title: "Changes to these Terms",
      blocks: [
        {
          kind: "paragraph",
          text: "We may update these Terms as the service changes. The effective date at the top shows the current version, and we will tell you in the app before a significant change takes effect. If you keep using Sugo Express after that, the updated Terms apply.",
        },
      ],
    },
    {
      id: "law",
      title: "Governing law and disputes",
      blocks: [
        {
          kind: "paragraph",
          text: "These Terms are governed by the laws of the Republic of the Philippines. If something goes wrong, please contact us first so we can try to resolve it together. Disputes that cannot be settled that way go to the proper courts of Tacurong City, Sultan Kudarat, without affecting any right you have to bring a complaint before a government agency.",
        },
      ],
    },
    {
      id: "contact",
      title: "Contact us",
      blocks: [
        {
          kind: "paragraph",
          text: "Questions about these Terms, a problem with an errand, or a request to close your account: email us at the address below, or use the chat and feedback options in the app.",
        },
      ],
    },
  ],
};

export const PRIVACY_POLICY: LegalDocument = {
  id: "privacy",
  title: "Privacy Policy",
  summary:
    "What personal data Sugo Express collects, why, who else handles it, how long we keep it, and the rights you have under the Data Privacy Act of 2012.",
  sections: [
    {
      id: "scope",
      title: "Who we are and what this covers",
      blocks: [
        {
          kind: "paragraph",
          text: "Sugo Express, based in Tacurong City, Sultan Kudarat, is the personal information controller for the data described here. This policy covers the Sugo Express Customer App, the Rider App and the web portal at portal.sugo-express.org.",
        },
        {
          kind: "paragraph",
          text: "We process personal data in line with the Data Privacy Act of 2012 (Republic Act No. 10173) and the rules of the National Privacy Commission. You can reach our Data Protection Officer at the email address at the end of this policy.",
        },
      ],
    },
    {
      id: "collect",
      title: "Information we collect",
      blocks: [
        {
          kind: "list",
          items: [
            {
              lead: "Account details.",
              text: "Your name, username, email address, mobile number, birthdate, password (stored only as a one-way hash, never in readable form) and profile photo if you add one. If you sign in with Google, we receive your Google account ID, name, email address and profile photo.",
            },
            {
              lead: "Verification.",
              text: "One-time codes sent to your phone or email to confirm they belong to you.",
            },
            {
              lead: "Delivery locations.",
              text: "The addresses you save, with their map pins, landmarks and notes.",
            },
            {
              lead: "Device location.",
              text: "Only if you allow it, the Customer App reads your location once to place your delivery pin. It does not track you in the background or after you close the app.",
            },
            {
              lead: "Errands.",
              text: "The stores, items, sizes, quantities, instructions and prices of each errand, its status history, and the photos riders take as proof, such as store receipts and delivered items.",
            },
            {
              lead: "Payments.",
              text: "Your payment method, amounts paid and owed, and any payment screenshots you upload, including the details we read from them, such as the reference number, amount, date and the names shown.",
            },
            {
              lead: "Messages.",
              text: "Your chats with dispatchers and riders.",
            },
            {
              lead: "Ratings and feedback.",
              text: "Ratings and comments you give riders, and app feedback you send, with your phone model and operating system.",
            },
            {
              lead: "Device and security information.",
              text: "Your IP address, a device identifier, app or browser details, sign-in times, the devices you have signed in from, password reset requests, and a token that lets us send you push notifications.",
            },
          ],
        },
      ],
    },
    {
      id: "staff",
      title: "If you are a rider or dispatcher",
      blocks: [
        {
          kind: "paragraph",
          text: "We also collect riders' locations while they are on duty and during assigned errands, the route of each errand, shift and availability status, profile photos, ratings, and earnings and settlement records. During an active errand, the customer sees the rider's live location and name. For all staff, we keep records of sign-ins and the actions taken in the portal.",
        },
      ],
    },
    {
      id: "use",
      title: "How we use your information",
      blocks: [
        {
          kind: "list",
          items: [
            { lead: "To run your account:", text: "creating it, verifying your number and email, and keeping it signed in securely." },
            { lead: "To fulfil errands:", text: "reviewing, pricing, assigning, buying, routing and delivering, including maps, distances and arrival estimates." },
            { lead: "To handle payments:", text: "confirming transfers, recording cash collection, and processing refunds." },
            { lead: "To keep you informed:", text: "push notifications about your errands, chat messages, verification codes, password reset emails and new sign-in alerts." },
            { lead: "To give support:", text: "answering questions, investigating complaints and resolving disputes." },
            { lead: "To keep the service safe:", text: "preventing fraud and fake payment proof, limiting repeated failed attempts, and blocking abusive traffic." },
            { lead: "To improve the service:", text: "using past errand data, such as item names, store visits and trip times, to improve item categories, store suggestions and arrival estimates." },
            { lead: "To meet legal obligations:", text: "keeping records the law requires and responding to lawful requests." },
          ],
        },
        {
          kind: "note",
          lead: "We do not sell your personal data",
          text: "or use it for advertising.",
        },
      ],
    },
    {
      id: "basis",
      title: "Why we are allowed to use it",
      blocks: [
        {
          kind: "paragraph",
          text: "Under the Data Privacy Act, we process your data because it is needed to provide the service you asked for under our Terms of Service; because you consented, for example to location access, notifications and camera use; because we have a legitimate interest in keeping the service secure and improving it; or because the law requires it. You can withdraw a consent at any time in your phone's settings or by contacting us. Withdrawing it does not affect processing done before.",
        },
      ],
    },
    {
      id: "share",
      title: "Who we share it with",
      blocks: [
        {
          kind: "list",
          items: [
            {
              lead: "Your dispatcher and rider.",
              text: "They see your name, mobile number, delivery pin and notes, items and payment status for your errand, and use them only to fulfil it.",
            },
            {
              lead: "Google.",
              text: "Google Maps and Places help us show maps, find stores and measure road distances. Google Cloud Vision reads the text on receipts and payment screenshots. Google's Gemini AI models tidy the item lists you type; only the item text is sent, not your name, number or address. Firebase verifies phone numbers, carries chat and live rider tracking, and delivers push notifications. We send emails, such as verification codes, through Gmail.",
            },
            {
              lead: "Hosting and network providers.",
              text: "Contabo hosts our servers, and Cloudflare protects and delivers our website and app traffic. Expo may deliver push notifications on some devices.",
            },
            {
              lead: "Authorities.",
              text: "When the law requires it, for example under a court order or a lawful request from a government agency.",
            },
          ],
        },
        {
          kind: "paragraph",
          text: "Stores do not receive your contact details from us. Our providers handle data on our instructions and under their own security and privacy commitments.",
        },
      ],
    },
    {
      id: "transfers",
      title: "Data stored outside the Philippines",
      blocks: [
        {
          kind: "paragraph",
          text: "Our servers and our real-time database are located in Singapore, and Google's services may process data in other countries. We use providers that protect data to a standard comparable to Philippine law, and we remain responsible for your data wherever it is processed.",
        },
      ],
    },
    {
      id: "retention",
      title: "How long we keep it",
      blocks: [
        {
          kind: "list",
          items: [
            {
              lead: "Account details",
              text: "are kept while your account is open.",
            },
            {
              lead: "Errand, payment and chat records",
              text: "are kept after an errand ends for as long as we need them for disputes, accounting and legal requirements. When they are no longer needed, we delete or anonymize them.",
            },
            {
              lead: "Sign-in sessions",
              text: "end after 30 days without use, and verification codes expire within minutes.",
            },
            {
              lead: "Backups",
              text: "of our database are kept for 7 days and then deleted.",
            },
          ],
        },
        {
          kind: "paragraph",
          text: "If you close your account, we delete or anonymize your personal data, except records we must keep for legal, accounting or dispute purposes. Those are kept only as long as required.",
        },
      ],
    },
    {
      id: "security",
      title: "How we protect it",
      blocks: [
        {
          kind: "paragraph",
          text: "Data travels over encrypted HTTPS connections. Passwords are stored as bcrypt hashes. Sign-ins use short-lived access tokens and refresh tokens that change with every use, so a stolen token stops working. We limit repeated failed attempts, block abusive traffic, and give staff access only to what their role needs.",
        },
        {
          kind: "paragraph",
          text: "No system is perfectly secure. If a breach affects your personal data, we will notify you and the National Privacy Commission as the law requires.",
        },
      ],
    },
    {
      id: "choices",
      title: "Your choices",
      blocks: [
        {
          kind: "list",
          items: [
            { lead: "Location:", text: "you can refuse location access and set your delivery pin on the map yourself instead." },
            { lead: "Notifications:", text: "you can turn them off in the app's Settings or your phone's settings, though you may miss errand updates." },
            { lead: "Camera and photos:", text: "used only when you choose to upload a photo." },
            { lead: "Google Sign-In:", text: "optional; you can register with your email address instead." },
          ],
        },
      ],
    },
    {
      id: "rights",
      title: "Your rights",
      blocks: [
        {
          kind: "paragraph",
          text: "Under the Data Privacy Act, you have the right to:",
        },
        {
          kind: "list",
          items: [
            { lead: "Be informed", text: "about how your data is processed, which is what this policy does." },
            { lead: "Access", text: "your personal data and get a copy of it." },
            { lead: "Correct", text: "inaccurate data. You can edit most account details in the app." },
            { lead: "Object", text: "to processing, including withdrawing consent." },
            { lead: "Erasure or blocking", text: "of data that is no longer needed or was processed unlawfully, including deletion when you close your account." },
            { lead: "Data portability:", text: "receive your data in a commonly used electronic format." },
            { lead: "Damages", text: "if you are harmed by inaccurate or unlawfully processed data." },
            { lead: "Complain", text: "to the National Privacy Commission (privacy.gov.ph)." },
          ],
        },
        {
          kind: "paragraph",
          text: "To use any of these rights, email our Data Protection Officer from the address on your account. We may ask you to confirm your identity first, and we will reply within the period the law requires.",
        },
      ],
    },
    {
      id: "children",
      title: "Children",
      blocks: [
        {
          kind: "paragraph",
          text: "Sugo Express is meant for adults. Children under 18 may use it only with a parent's or guardian's permission. If we learn that we hold a child's data without that permission, we will delete it.",
        },
      ],
    },
    {
      id: "changes",
      title: "Changes to this policy",
      blocks: [
        {
          kind: "paragraph",
          text: "When our practices change, we update this policy and its effective date, and we tell you in the app before a significant change takes effect.",
        },
      ],
    },
    {
      id: "contact",
      title: "Contact our Data Protection Officer",
      blocks: [
        {
          kind: "paragraph",
          text: "For questions about this policy or your personal data, or to make a request, email our Data Protection Officer at the address below.",
        },
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS = {
  terms: TERMS_OF_SERVICE,
  privacy: PRIVACY_POLICY,
} as const;

export type LegalDocumentId = keyof typeof LEGAL_DOCUMENTS;
