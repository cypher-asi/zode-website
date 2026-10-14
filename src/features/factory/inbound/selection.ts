/** What's selected on the dock: a truck or an HU, by index into the inbound trace. */
export type DockSelection = { kind: "truck"; truck: number } | { kind: "hu"; hu: number } | null;
