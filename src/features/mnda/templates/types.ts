export interface AgreementSection {
  heading: string;
  body: string;
}

/** A blank on the template PDF, in points from the bottom left. */
export interface Blank {
  x: number;
  /** Baseline of the printed line the blank sits on. */
  y: number;
  width: number;
}

/** One published version of the MNDA: the text shown for review, the PDF it's stamped on, and where the blanks are. */
export interface MndaTemplate {
  /** Stored on each signed row as mndas.template_version and printed on its certificate. */
  version: `zode-mnda-v${number}`;
  /** File name in ../assets/. */
  pdf: string;
  preamble: string;
  sections: readonly AgreementSection[];
  closing: string;
  blanks: {
    /** Page 1, the preamble's first two lines. */
    preamble: { date: Blank; year: Blank; entityName: Blank; entityType: Blank };
    /** Page 3, the signature blocks; `y` is each rule's height. */
    signatures: {
      zodeBy: Blank;
      zodeName: Blank;
      zodeTitle: Blank;
      entityName: Blank;
      entityBy: Blank;
      entityPrintedName: Blank;
      entityAddress: readonly Blank[];
    };
  };
}
