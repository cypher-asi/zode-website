import { AS_OF } from "./research";

/**
 * The deck's securities legends. The deck is public, so the raise relies on
 * Rule 506(c) of Regulation D, which permits general solicitation when every
 * purchaser is a verified accredited investor, and in Canada on the
 * accredited investor exemption in NI 45-106. Any change to the offering's
 * exemption, issuer or jurisdictions needs counsel to revisit this text.
 */

/** Set in fine print on the cover. */
export const LEGAL_LEGEND =
  "For accredited investors only. This presentation is not an offer to sell or a solicitation of an offer to buy securities. Any offer will be made only through definitive offering documents, to accredited investors verified under Rule 506(c) of Regulation D and, in Canada, under NI 45-106. The securities are not registered and have not been approved by the SEC or any state or Canadian regulator.";

/** Under the raise's terms, for readers who land on that slide by a shared link. */
export const RAISE_NOTE =
  "For accredited investors only, under Rule 506(c) and NI 45-106. Not an offer to sell securities; see the legal information on page 01.";

export const DISCLAIMER: readonly { heading: string; body: string }[] = [
  {
    heading: "No offer",
    body: "This presentation is provided by ZODE Inc. and its affiliates (\"ZODE\") for information only. It is not an offer to sell, or a solicitation of an offer to buy, any security of ZODE or of any project entity, and no such offer or solicitation will be made in any jurisdiction where it would be unlawful. Any offer will be made only through a private placement memorandum, subscription agreement and related documents (the \"offering documents\"), which will contain material information not in this presentation, including risk factors, and which govern in the event of any conflict. Investors should rely only on the offering documents.",
  },
  {
    heading: "Accredited investors only",
    body: "Any offering in the United States will be made under Section 4(a)(2) of the Securities Act of 1933, as amended (the \"Securities Act\"), and Rule 506(c) of Regulation D. Securities will be sold only to \"accredited investors\" as defined in Rule 501(a) of Regulation D whose status ZODE has taken reasonable steps to verify, as Rule 506(c)(2)(ii) requires, such as by reviewing tax returns or financial statements, or by obtaining written confirmation from a registered broker-dealer, an SEC-registered investment adviser, a licensed attorney or a certified public accountant. Self-certification alone is not sufficient verification.",
  },
  {
    heading: "Not registered or approved",
    body: "The securities have not been registered under the Securities Act or the securities laws of any state or other jurisdiction, and no prospectus has been filed with any securities regulatory authority in Canada. Neither the U.S. Securities and Exchange Commission, nor any state securities commission, nor any Canadian securities regulatory authority has approved or disapproved of the securities, passed upon the merits of any offering, or passed upon the accuracy or adequacy of this presentation. Any representation to the contrary is a criminal offense.",
  },
  {
    heading: "Restricted, illiquid and high risk",
    body: "The securities will be \"restricted securities\" within the meaning of Rule 144 under the Securities Act and may not be transferred or resold except under registration or an exemption from it, as permitted by the Securities Act and applicable state and foreign securities laws. There is no public market for the securities and none is expected to develop. An investment is speculative, involves a high degree of risk, and is suitable only for investors who can bear its economic risk for an indefinite period and can afford to lose their entire investment.",
  },
  {
    heading: "Forward-looking statements",
    body: "This presentation contains forward-looking statements, including projections of revenue, profit and returns, unit economics, market size, cost per megawatt, deployment timelines, site pipeline and capacity, and the terms of the proposed financing. They rest on ZODE's current assumptions and estimates, are subject to significant business, economic, regulatory and competitive risks and uncertainties, many beyond ZODE's control, and are not guarantees of future performance; actual results may differ materially. Letters of intent, pipeline sites and sites in diligence are non-binding and may never result in definitive agreements. Signed contracts are subject to conditions, including financing and delivery, and may not be performed as expected. Illustrative examples and targets are not predictions, and the prior ventures of ZODE's management are not indicative of ZODE's results. ZODE undertakes no obligation to update any forward-looking statement.",
  },
  {
    heading: "Third-party information and trademarks",
    body: "Market and industry data in this presentation come from third-party sources that ZODE believes to be reliable but has not independently verified, and ZODE makes no representation as to their accuracy or completeness. Third-party names and logos are the trademarks of their respective owners. Their appearance, including under \"LOI\" or \"Pipeline\", does not imply endorsement of, affiliation with or any commitment to ZODE, except as expressly stated.",
  },
  {
    heading: "No advice",
    body: "Nothing in this presentation is investment, legal, tax or accounting advice. Prospective investors should conduct their own investigation and consult their own advisers about any investment. To the fullest extent permitted by law, no representation or warranty, express or implied, is made as to the accuracy or completeness of this presentation, except as set out in the offering documents.",
  },
  {
    heading: "Canadian investors",
    body: "In Canada, securities will be offered only to purchasers who are \"accredited investors\" purchasing as principal, in reliance on the prospectus exemption in section 2.3 of National Instrument 45-106 Prospectus Exemptions or, in Ontario, section 73.3 of the Securities Act (Ontario). Resale of the securities will be subject to restrictions under National Instrument 45-102 Resale of Securities. Securities legislation in certain provinces may give purchasers remedies for rescission or damages if an offering memorandum, which may include a presentation such as this one delivered to a prospective purchaser, contains a misrepresentation. These remedies must be exercised within the time limits set out in the applicable legislation, which purchasers should refer to or consult a legal adviser about. Further details will be set out in the offering documents.",
  },
  {
    heading: "Date",
    body: `Information is as of ${AS_OF} unless stated otherwise, and may change without notice.`,
  },
];
